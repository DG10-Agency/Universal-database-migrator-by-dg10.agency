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

    private getConnectionString(config: ConnectionConfig) {
        if (config.connectionString) return config.connectionString;
        // Construct from parts
        return `--host=${config.host || 'localhost'} --port=${config.port || 3306} --user=${config.user} --password=${config.password} ${config.database}`;
    }

    async testConnection(config: ConnectionConfig) {
        try {
            const mysqlPath = await getBinaryPath('mysql');
            const cmd = config.connectionString 
                ? `${mysqlPath} "${config.connectionString}" -e "SELECT 1"`
                : `${mysqlPath} -h ${config.host || 'localhost'} -P ${config.port || 3306} -u ${config.user} -p${config.password} -e "SELECT 1"`;
            
            await this.spawnAsync(cmd, {}, () => {});
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

        onProgress(40, "Dumping MySQL Database...");
        const cmd = config.connectionString
            ? `${mysqldumpPath} "${config.connectionString}" > "${dataFile}"`
            : `${mysqldumpPath} -h ${config.host || 'localhost'} -P ${config.port || 3306} -u ${config.user} -p${config.password} --databases ${config.database} > "${dataFile}"`;

        await this.spawnAsync(cmd, { signal }, onLog);

        return { dataFile, tempDir: tmpDir };
    }

    async restore(config: ConnectionConfig, artifacts: MigrationArtifacts, options: MigrationOptions): Promise<void> {
        const { onProgress, onLog, signal } = options;
        const mysqlPath = await getBinaryPath('mysql');

        if (artifacts.dataFile) {
            onProgress(80, "Restoring MySQL Database...");
            const cmd = config.connectionString
                ? `${mysqlPath} "${config.connectionString}" < "${artifacts.dataFile}"`
                : `${mysqlPath} -h ${config.host || 'localhost'} -P ${config.port || 3306} -u ${config.user} -p${config.password} ${config.database} < "${artifacts.dataFile}"`;

            await this.spawnAsync(cmd, { signal }, onLog);
        }
    }

    async cleanup(artifacts: MigrationArtifacts): Promise<void> {
        await fs.rm(artifacts.tempDir, { recursive: true, force: true }).catch(() => {});
    }
}
