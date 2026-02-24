import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';

const execAsyncRaw = promisify(exec);

const COMMON_WINDOWS_PATHS = [
    'C:\\Program Files\\PostgreSQL\\18\\bin',
    'C:\\Program Files\\PostgreSQL\\17\\bin',
    'C:\\Program Files\\PostgreSQL\\16\\bin',
    'C:\\Program Files\\PostgreSQL\\15\\bin',
];

/**
 * Finds a system binary, checking PATH first and then common installation directories.
 */
export async function getBinaryPath(name: 'psql' | 'pg_dump' | 'pg_dumpall' | 'supabase'): Promise<string> {
    // 1. Try standard PATH
    try {
        await execAsyncRaw(`${name} --version`);
        return name;
    } catch (e) {
        // Not in PATH
    }

    // 2. Try common Windows paths
    if (process.platform === 'win32') {
        for (const basePath of COMMON_WINDOWS_PATHS) {
            const fullPath = path.join(basePath, `${name}.exe`);
            if (fs.existsSync(fullPath)) {
                return `"${fullPath}"`; // Quote path for shell safety
            }
        }
    }

    // 3. Fallback to just the name (will fail if not in path, but consistent)
    if (name === 'supabase') {
        return 'npx --yes supabase@latest';
    }
    return name;
}

export const execAsync = execAsyncRaw;
