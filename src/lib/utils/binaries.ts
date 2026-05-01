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
export async function getBinaryPath(name: 'psql' | 'pg_dump' | 'pg_dumpall' | 'supabase' | 'mysql' | 'mysqldump' | 'sqlite3'): Promise<string> {
    // 1. Try standard PATH
    try {
        await execAsyncRaw(`${name} ${name === 'sqlite3' ? '--version' : '--version'}`);
        return name;
    } catch (e) {
        // Not in PATH
    }

    // 2. Try common Windows paths
    if (process.platform === 'win32') {
        const paths = [...COMMON_WINDOWS_PATHS];
        if (name === 'mysql' || name === 'mysqldump') {
            paths.push('C:\\Program Files\\MySQL\\MySQL Server 8.4\\bin');
            paths.push('C:\\Program Files\\MySQL\\MySQL Server 8.0\\bin');
            paths.push('C:\\xampp\\mysql\\bin');
        }
        
        for (const basePath of paths) {
            const fullPath = path.join(basePath, `${name}.exe`);
            if (fs.existsSync(fullPath)) {
                return `"${fullPath}"`;
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
