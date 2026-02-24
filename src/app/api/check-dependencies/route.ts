import { NextResponse } from 'next/server';
import { getBinaryPath } from '@/lib/utils/binaries';

export async function GET() {
    try {
        const psqlPath = await getBinaryPath('psql');
        const pgDumpPath = await getBinaryPath('pg_dump');
        const supabasePath = await getBinaryPath('supabase');

        console.log(`[Deps Check] psql: ${psqlPath}, pg_dump: ${pgDumpPath}, supabase: ${supabasePath}`);

        const results = {
            psql: psqlPath !== 'psql' || (await checkStatus(psqlPath)),
            pg_dump: pgDumpPath !== 'pg_dump' || (await checkStatus(pgDumpPath)),
            supabase: supabasePath !== 'supabase' || (await checkStatus(supabasePath)),
            psqlPath: psqlPath,
            pgDumpPath: pgDumpPath,
            supabasePath: supabasePath
        };

        console.log(`[Deps Check] Results:`, results);

        return NextResponse.json({
            // Core database tools are mandatory for the app to function. Supabase CLI is optional (Edge Functions).
            ready: results.psql && results.pg_dump,
            dependencies: results
        });
    } catch (error) {
        console.error(`[Deps Check] Error:`, error);
        return NextResponse.json({ ready: false, error: 'Failed to verify system dependencies' }, { status: 500 });
    }
}

async function checkStatus(command: string) {
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);
    try {
        await execAsync(`${command} --version`);
        return true;
    } catch (e) {
        return false;
    }
}
