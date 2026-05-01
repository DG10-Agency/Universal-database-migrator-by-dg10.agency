import { IDatabaseDriver, ConnectionConfig, MigrationOptions, MigrationArtifacts } from './interface';
import { spawn } from 'child_process';
import os from 'os';
import path from 'path';
import fs from 'fs/promises';
import { getBinaryPath } from '@/lib/utils/binaries';

export class SQLiteDriver implements IDatabaseDriver {
    private async spawnAsync(command: string, options: any, onLog: (data: string) => void) {
        return new Promise<void>((resolve, reject) => {
            const proc = spawn(command, { ...options, shell: true });
            proc.stdout.on('data', (data) => onLog(data.toString()));
            proc.stderr.on('data', (data) => onLog(data.toString()));
            proc.on('close', (code) => code === 0 ? resolve() : reject(new Error(`Command failed with code ${code}`)));
            proc.on('error', reject);
        });
    }

    async testConnection(config: ConnectionConfig) {
        try {
            const sqlitePath = await getBinaryPath('sqlite3');
            const dbPath = config.connectionString || config.database || 'local.db';
            await this.spawnAsync(`${sqlitePath} ${dbPath} "SELECT 1"`, {}, () => {});
            return { success: true, message: `Connected to SQLite file: ${dbPath}` };
        } catch (e: any) {
            return { success: false, message: e.message };
        }
    }

    async dump(config: ConnectionConfig, options: MigrationOptions): Promise<MigrationArtifacts> {
        const { onProgress, onLog, signal } = options;
        const tmpDir = path.join(os.tmpdir(), `sqlite_dump_${Date.now()}`);
        await fs.mkdir(tmpDir, { recursive: true });

        const dataFile = path.join(tmpDir, 'dump.sql');
        const sqlitePath = await getBinaryPath('sqlite3');
        const dbPath = config.connectionString || config.database || 'local.db';

        onProgress(40, "Dumping SQLite Database...");
        await this.spawnAsync(`${sqlitePath} ${dbPath} ".dump" > "${dataFile}"`, { signal }, onLog);

        return { dataFile, tempDir: tmpDir };
    }

    async restore(config: ConnectionConfig, artifacts: MigrationArtifacts, options: MigrationOptions): Promise<void> {
        const { onProgress, onLog, signal } = options;
        const sqlitePath = await getBinaryPath('sqlite3');
        const dbPath = config.connectionString || config.database || 'target.db';

        if (artifacts.dataFile) {
            onProgress(80, "Restoring SQLite Database...");
            await this.spawnAsync(`${sqlitePath} ${dbPath} < "${artifacts.dataFile}"`, { signal }, onLog);
        }
    }

    async cleanup(artifacts: MigrationArtifacts): Promise<void> {
        await fs.rm(artifacts.tempDir, { recursive: true, force: true }).catch(() => {});
    }
}
