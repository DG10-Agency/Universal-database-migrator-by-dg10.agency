import { exec, spawn } from 'child_process';
import util from 'util';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { getBinaryPath } from '@/lib/utils/binaries';

const execAsync = util.promisify(exec);

const spawnAsync = (command: string, options: any, onLog: (data: string) => void) => {
    return new Promise<void>((resolve, reject) => {
        const { maxBuffer, ...spawnOptions } = options;
        const proc = spawn(command, { ...spawnOptions, shell: true });

        proc.stdout.on('data', (data) => {
            if (onLog) onLog(data.toString());
        });

        proc.stderr.on('data', (data) => {
            if (onLog) onLog(data.toString());
        });

        proc.on('close', (code) => {
            if (code === 0) {
                resolve();
            } else {
                reject(new Error(`Command failed with code ${code}`));
            }
        });

        proc.on('error', (err) => {
            reject(err);
        });
    });
};

export async function migrateEdgeFunctions(
    sourcePat: string,
    targetPat: string,
    sourceProjectRef: string,
    targetProjectRef: string,
    onProgress: (progress: number, message: string) => void,
    onLog: (data: string) => void,
    signal?: AbortSignal
) {
    const tempDir = path.join(os.tmpdir(), `supabase_functions_${Date.now()}`);

    try {
        const supabasePath = await getBinaryPath('supabase');

        // Step 6: CLI sanity check
        try {
            await execAsync(`${supabasePath} --version`);
        } catch (e) {
            throw new Error("Supabase CLI not found. Please install it to migrate Edge Functions.");
        }

        // 1. Setup temporary directory
        await fs.mkdir(tempDir, { recursive: true });

        // Setup environment variables for the Supabase CLI
        const sourceEnv = {
            ...process.env,
            SUPABASE_ACCESS_TOKEN: sourcePat
        };
        const targetEnv = {
            ...process.env,
            SUPABASE_ACCESS_TOKEN: targetPat
        };

        // 2. Fetch the list of edge functions from the Source Project via Management API
        if (signal?.aborted) throw new Error("Edge functions migration aborted");
        onProgress(92, "Fetching list of Edge Functions from Source...");
        const response = await fetch(`https://api.supabase.com/v1/projects/${sourceProjectRef}/functions`, {
            headers: {
                'Authorization': `Bearer ${sourcePat}`
            },
            signal: signal ? (signal as any) : undefined
        });

        if (!response.ok) {
            const errorBody = await response.text();
            throw new Error(`Failed to fetch edge functions: ${response.status} ${errorBody}`);
        }

        const functions: any[] = await response.json();

        if (!functions || functions.length === 0) {
            onProgress(98, "No Edge Functions found. Skipping.");
            await fs.rm(tempDir, { recursive: true, force: true }).catch(() => { });
            return;
        }

        onProgress(93, `Found ${functions.length} function(s). Initializing local workspace...`);
        // Init a dummy supabase project in the temp dir to use the CLI effectively
        await spawnAsync(`${supabasePath} init`, { cwd: tempDir, env: sourceEnv, signal }, onLog);

        // 3. Download functions from Source
        let downloadedCount = 0;
        for (const func of functions) {
            if (signal?.aborted) throw new Error("Edge functions migration aborted");
            onProgress(94 + Math.floor((downloadedCount / functions.length) * 3), `Downloading Function: ${func.name || func.slug}...`);
            // Download the function source code
            try {
                await spawnAsync(`${supabasePath} functions download ${func.slug} --project-ref ${sourceProjectRef}`, { cwd: tempDir, env: sourceEnv, signal }, onLog);
                downloadedCount++;
            } catch (downloadErr: any) {
                console.warn(`Failed to download function ${func.slug}:`, downloadErr.message);
            }
        }

        if (downloadedCount === 0) {
            onProgress(98, "No functions could be downloaded. Skipping deploy.");
            await fs.rm(tempDir, { recursive: true, force: true }).catch(() => { });
            return;
        }

        // 4. Deploy functions to Target
        if (signal?.aborted) throw new Error("Edge functions migration aborted");
        onProgress(97, "Deploying Edge Functions to Target...");
        // `supabase functions deploy` without names deploys all functions found in `supabase/functions/`
        await spawnAsync(`${supabasePath} functions deploy --project-ref ${targetProjectRef}`, { cwd: tempDir, env: targetEnv, signal }, onLog);

        // Clean up
        await fs.rm(tempDir, { recursive: true, force: true }).catch(() => { });
        onProgress(99, "Edge Functions deployed successfully!");

    } catch (error: any) {
        console.error("Edge Function Migration Error:", error);
        // Clean up on error
        await fs.rm(tempDir, { recursive: true, force: true }).catch(() => { });
        throw new Error(`Edge Function migration failed: ${error.message}`);
    }
}
