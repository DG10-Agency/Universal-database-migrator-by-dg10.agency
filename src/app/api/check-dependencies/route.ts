import { NextResponse } from 'next/server';
import { getBinaryPath } from '@/lib/utils/binaries';

export async function GET() {
    try {
        const psqlPath = await getBinaryPath('psql');
        const pgDumpPath = await getBinaryPath('pg_dump');
        const mysqlPath = await getBinaryPath('mysql');
        const mysqlDumpPath = await getBinaryPath('mysqldump');
        const sqlitePath = await getBinaryPath('sqlite3');
        const supabasePath = await getBinaryPath('supabase');

        const results = {
            psql: await checkStatus(psqlPath),
            pg_dump: await checkStatus(pgDumpPath),
            mysql: await checkStatus(mysqlPath),
            mysqldump: await checkStatus(mysqlDumpPath),
            sqlite: await checkStatus(sqlitePath),
            supabase: await checkStatus(supabasePath)
        };

        return NextResponse.json({
            ready: true, // Frontend will determine readiness based on selected driver
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
