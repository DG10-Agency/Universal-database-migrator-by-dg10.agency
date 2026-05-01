import { IDatabaseDriver, ConnectionConfig, MigrationOptions, MigrationArtifacts } from './interface';
import { exec, spawn } from 'child_process';
import util from 'util';
import os from 'os';
import path from 'path';
import fs from 'fs/promises';
import { getBinaryPath } from '@/lib/utils/binaries';

const execAsync = util.promisify(exec);

export class PostgresDriver implements IDatabaseDriver {
    private async spawnAsync(command: string, options: any, onLog: (data: string) => void) {
        return new Promise<void>((resolve, reject) => {
            const proc = spawn(command, { ...options, shell: true });
            proc.stdout.on('data', (data) => onLog(data.toString()));
            proc.stderr.on('data', (data) => onLog(data.toString()));
            proc.on('close', (code) => code === 0 ? resolve() : reject(new Error(`Command failed with code ${code}`)));
            proc.on('error', reject);
        });
    }

    /**
     * 🛰️ MULTI-STRATEGY HOST RESOLUTION
     */
    private async resolveBestConfig(config: ConnectionConfig) {
        if (config.connectionString) {
            const psqlPath = await getBinaryPath('psql');
            try {
                // Test connectivity silently
                await execAsync(`${psqlPath} "${config.connectionString}" -c "SELECT 1"`);
                return { url: config.connectionString, strategy: 'Direct URI' };
            } catch (err: any) {
                // Remove password from error message
                let safeError = err.message.replace(/(postgresql:\/\/[^:]+:)[^@]+(@)/g, '$1***$2');
                safeError = safeError.replace(/(postgres:\/\/[^:]+:)[^@]+(@)/g, '$1***$2');
                throw new Error(`Connectivity failed for connection string. ${safeError}`);
            }
        }
        if (!config.projectRef) throw new Error("PostgresDriver requires either connectionString or projectRef");

        const trimmedRef = config.projectRef.trim().toLowerCase();
        let trimmedRegion = config.region?.trim().toLowerCase() || '';
        trimmedRegion = trimmedRegion.replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');

        const strategies = [];
        
        // 1. API Discovery
        if (config.pat) {
            try {
                const response = await fetch(`https://api.supabase.com/v1/projects/${trimmedRef}/config/database/pooler`, {
                    headers: { 'Authorization': `Bearer ${config.pat}` }
                });
                if (response.ok) {
                    const poolerConfig = await response.json();
                    if (poolerConfig.db_host) {
                        strategies.push({ host: poolerConfig.db_host, port: poolerConfig.db_port || 6543, user: `postgres.${trimmedRef}`, note: 'API Discovery' });
                    }
                }
            } catch (e) {}
        }

        // 2. Universal & Regional Poolers
        strategies.push({ host: `${trimmedRef}.pooler.supabase.com`, port: 6543, user: `postgres.${trimmedRef}`, note: 'Universal Pooler' });
        if (trimmedRegion) {
            strategies.push({ host: `aws-0-${trimmedRegion}.pooler.supabase.com`, port: 6543, user: `postgres.${trimmedRef}`, note: 'Regional Pooler' });
        }
        
        // 3. Direct Host
        strategies.push({ host: `db.${trimmedRef}.supabase.co`, port: 5432, user: 'postgres', note: 'Direct Host' });

        for (const strategy of strategies) {
            const env = { ...process.env, PGPASSWORD: config.password, PGCONNECT_TIMEOUT: '3' };
            const psqlPath = await getBinaryPath('psql');
            try {
                await execAsync(`${psqlPath} -h ${strategy.host} -p ${strategy.port} -U ${strategy.user} -d postgres -c "SELECT 1"`, { env });
                return {
                    url: `postgresql://${strategy.user}@${strategy.host}:${strategy.port}/postgres?sslmode=require`,
                    strategy: strategy.note
                };
            } catch (err: any) {
                if (err.message.includes('password authentication failed')) {
                    throw new Error(`Auth failed for ${trimmedRef}. Password rejected at ${strategy.host}.`);
                }
            }
        }
        throw new Error(`Connectivity failed for ${trimmedRef}. Check region and project status.`);
    }

    async testConnection(config: ConnectionConfig) {
        try {
            const res = await this.resolveBestConfig(config);
            return { success: true, message: `Connected via ${res.strategy}`, details: res };
        } catch (e: any) {
            return { success: false, message: e.message };
        }
    }

    async dump(config: ConnectionConfig, options: MigrationOptions): Promise<MigrationArtifacts> {
        const { onProgress, onLog, signal } = options;
        const res = await this.resolveBestConfig(config);
        const tmpDir = path.join(os.tmpdir(), `pg_dump_${Date.now()}`);
        await fs.mkdir(tmpDir, { recursive: true });

        const rolesFile = path.join(tmpDir, 'roles.sql');
        const schemaFile = path.join(tmpDir, 'schema.sql');
        const dataFile = path.join(tmpDir, 'data.sql');

        const pgDumpPath = await getBinaryPath('pg_dump');
        const pgDumpAllPath = await getBinaryPath('pg_dumpall');
        const env = { ...process.env, PGPASSWORD: config.password };

        // 1. Roles
        onProgress(35, `Dumping Roles...`);
        await this.spawnAsync(`${pgDumpAllPath} --roles-only --no-role-passwords --dbname="${res.url}" --file="${rolesFile}"`, { env, signal }, onLog);

        // Filter roles
        let rolesData = await fs.readFile(rolesFile, 'utf8');
        const protectedRoles = ['anon', 'authenticator', 'authenticated', 'service_role', 'postgres', 'supabase_admin'];
        for (const role of protectedRoles) {
            const roleRegex = new RegExp(`^(CREATE|ALTER|DROP)\\s+(ROLE|USER)\\s+"?${role}"?[^;]*;`, 'gim');
            rolesData = rolesData.replace(roleRegex, `-- Skipped protected role definition: ${role}`);
        }
        await fs.writeFile(rolesFile, rolesData);

        // 2. Schema
        onProgress(45, "Dumping Schema...");
        const exclude = `--exclude-schema="supabase_migrations" --exclude-schema="pgbouncer" --exclude-schema="graphql*" --exclude-schema="realtime" --exclude-schema="vault"`;
        await this.spawnAsync(`${pgDumpPath} --schema-only --clean --if-exists ${exclude} --dbname="${res.url}" --file="${schemaFile}"`, { env, signal }, onLog);

        // 3. Data
        onProgress(65, "Dumping Data...");
        await this.spawnAsync(`${pgDumpPath} --data-only ${exclude} --dbname="${res.url}" --file="${dataFile}"`, { env, signal }, onLog);

        return { rolesFile, schemaFile, dataFile, tempDir: tmpDir };
    }

    async restore(config: ConnectionConfig, artifacts: MigrationArtifacts, options: MigrationOptions): Promise<void> {
        const { onProgress, onLog, signal } = options;
        const res = await this.resolveBestConfig(config);
        const psqlPath = await getBinaryPath('psql');
        const env = { ...process.env, PGPASSWORD: config.password };

        if (artifacts.rolesFile) {
            onProgress(40, "Restoring Roles...");
            await this.spawnAsync(`${psqlPath} --file="${artifacts.rolesFile}" --dbname="${res.url}"`, { env, signal }, onLog);
        }

        if (artifacts.schemaFile) {
            onProgress(55, "Restoring Schema...");
            await this.spawnAsync(`${psqlPath} --file="${artifacts.schemaFile}" --dbname="${res.url}"`, { env, signal }, onLog);
        }

        if (artifacts.dataFile) {
            onProgress(75, "Restoring Data...");
            const dataEnv = { ...env, PGOPTIONS: '-c session_replication_role=replica' };
            await this.spawnAsync(`${psqlPath} --file="${artifacts.dataFile}" --dbname="${res.url}"`, { env: dataEnv, signal }, onLog);
        }
    }

    async cleanup(artifacts: MigrationArtifacts): Promise<void> {
        await fs.rm(artifacts.tempDir, { recursive: true, force: true }).catch(() => {});
    }
}
