import { IDatabaseDriver, ConnectionConfig, MigrationOptions, MigrationArtifacts } from './interface';
import { spawn } from 'child_process';
import os from 'os';
import path from 'path';
import fs from 'fs/promises';
import { getBinaryPath } from '@/lib/utils/binaries';

export class MySQLDriver implements IDatabaseDriver {
    private async spawnAsync(command: string, options: any, onLog: (data: string) => void) {
        return new Promise<void>((resolve, reject) => {
            const proc = spawn(command, { ...options, shell: true });
            proc.stdout.on('data', (data) => onLog(data.toString()));
            proc.stderr.on('data', (data) => onLog(data.toString()));
            proc.on('close', (code) => code === 0 ? resolve() : reject(new Error(`Command failed with code ${code}`)));
            proc.on('error', reject);
        });
    }

    private parseConnectionString(cs: string) {
        try {
            // mysql://user:pass@host:port/database
            const url = new URL(cs);
            return {
                host: url.hostname || 'localhost',
                port: url.port || '3306',
                user: url.username,
                password: decodeURIComponent(url.password),
                database: url.pathname.slice(1),
            };
        } catch (e) {
            return null;
        }
    }

    private getConnectFlags(config: ConnectionConfig) {
        if (config.connectionString) {
            const parsed = this.parseConnectionString(config.connectionString);
            if (parsed) {
                return `-h ${parsed.host} -P ${parsed.port} -u ${parsed.user} -p${parsed.password} ${parsed.database}`;
            }
            return config.connectionString; // Fallback to raw if not URI
        }
        return `-h ${config.host || 'localhost'} -P ${config.port || 3306} -u ${config.user} -p${config.password} ${config.database}`;
    }

    async testConnection(config: ConnectionConfig) {
        try {
            const mysqlPath = await getBinaryPath('mysql');
            const flags = this.getConnectFlags(config);
            // We use -e "SELECT 1" to test
            await this.spawnAsync(`${mysqlPath} ${flags} -e "SELECT 1"`, {}, () => {});
            return { success: true, message: "Connected to MySQL successfully" };
        } catch (e: any) {
            return { success: false, message: e.message };
        }
    }

    async dump(config: ConnectionConfig, options: MigrationOptions): Promise<MigrationArtifacts> {
        const { onProgress, onLog, signal } = options;
        const tmpDir = path.join(os.tmpdir(), `mysql_dump_${Date.now()}`);
        await fs.mkdir(tmpDir, { recursive: true });

        const dataFile = path.join(tmpDir, 'data.sql');
        const mysqldumpPath = await getBinaryPath('mysqldump');
        const flags = this.getConnectFlags(config);

        onProgress(40, "Dumping MySQL Database (with consistent snapshot)...");
        // Added --single-transaction for consistency without locking
        // Added --routines and --triggers for full migration
        const cmd = `${mysqldumpPath} ${flags} --single-transaction --routines --triggers > "${dataFile}"`;

        await this.spawnAsync(cmd, { signal }, onLog);

        return { dataFile, tempDir: tmpDir };
    }

    async restore(config: ConnectionConfig, artifacts: MigrationArtifacts, options: MigrationOptions): Promise<void> {
        const { onProgress, onLog, signal } = options;
        const mysqlPath = await getBinaryPath('mysql');
        const flags = this.getConnectFlags(config);

        if (artifacts.dataFile) {
            onProgress(80, "Restoring MySQL Database (ignoring FK constraints)...");
            // Wrap in FK check bypass
            const restoreCmd = `(echo "SET FOREIGN_KEY_CHECKS = 0;"; cat "${artifacts.dataFile}"; echo "SET FOREIGN_KEY_CHECKS = 1;") | ${mysqlPath} ${flags}`;

            await this.spawnAsync(restoreCmd, { signal }, onLog);
        }
    }

    async cleanup(artifacts: MigrationArtifacts): Promise<void> {
        await fs.rm(artifacts.tempDir, { recursive: true, force: true }).catch(() => {});
    }
}
