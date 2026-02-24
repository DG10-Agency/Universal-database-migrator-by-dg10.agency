import { exec, spawn } from 'child_process';
import util from 'util';
import os from 'os';
import path from 'path';
import fs from 'fs/promises';
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

/**
 * 🛰️ MULTI-STRATEGY HOST RESOLUTION
 * Attempts to find the best connection host for a Supabase project by trying:
 * 1. Management API discovery (Precise)
 * 2. Manual Pooler Host construction (using Region)
 * 3. Direct Host fallback
 */
async function resolveBestConfig(projectRef: string, pat: string, region: string, password: string) {
    const trimmedRef = projectRef.trim().toLowerCase();

    // Sanitize region format: "US East (N. Virginia)" -> "us-east-1", "us east 1" -> "us-east-1"
    let trimmedRegion = region?.trim().toLowerCase() || '';
    trimmedRegion = trimmedRegion.replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');

    const strategies = [];

    // Strategy 1: Smart Discovery
    try {
        const response = await fetch(`https://api.supabase.com/v1/projects/${trimmedRef}/config/database/pooler`, {
            headers: { 'Authorization': `Bearer ${pat}` }
        });
        if (response.ok) {
            const config = await response.json();
            if (config.db_host) {
                strategies.push({ host: config.db_host, port: config.db_port || 6543, user: `postgres.${trimmedRef}`, note: 'API Discovery' });
            }
        }
    } catch (e) {
        console.warn(`Management API skip for ${trimmedRef}`);
    }

    // Strategy 2: UNIVERSAL POOLER (The modern region-agnostic standard)
    strategies.push({ host: `${trimmedRef}.pooler.supabase.com`, port: 6543, user: `postgres.${trimmedRef}`, note: 'Universal Pooler' });

    // Strategy 3: Manual Pooler construction (Legacy/Specific)
    if (trimmedRegion) {
        strategies.push({ host: `aws-0-${trimmedRegion}.pooler.supabase.com`, port: 6543, user: `postgres.${trimmedRef}`, note: 'Manual aws-0' });
        strategies.push({ host: `aws-1-${trimmedRegion}.pooler.supabase.com`, port: 6543, user: `postgres.${trimmedRef}`, note: 'Manual aws-1' });
    }

    // Strategy 3: Direct Host
    strategies.push({ host: `db.${trimmedRef}.supabase.co`, port: 5432, user: 'postgres', note: 'Direct Host' });

    for (const strategy of strategies) {
        const { host, port, user } = strategy;
        const env = { ...process.env, PGPASSWORD: password, PGCONNECT_TIMEOUT: '3' };
        const psqlPath = await getBinaryPath('psql');
        const command = `${psqlPath} -h ${host} -p ${port} -U ${user} -d postgres -c "SELECT 1"`;

        try {
            await execAsync(command, { env });
            console.log(`Resolved ${trimmedRef} via ${strategy.host} (${strategy.port}) using ${strategy.note}`);
            return {
                url: `postgresql://${user}@${host}:${port}/postgres?sslmode=require`,
                strategy: strategy.note
            };
        } catch (err: any) {
            // If it's a password error, it persists across all host strategies.
            if (err.message.includes('password authentication failed')) {
                throw new Error(`Authentication failed for project ${trimmedRef}. The project was found at ${host}, but your Database Password was rejected.`);
            }
        }
    }

    throw new Error(`Connectivity failed for ${trimmedRef}. We tried API discovery, regional Poolers, and Direct connection but all failed. Please check your Region (${trimmedRegion}) and ensure your project is not paused.`);
}

export async function migrateDatabase(
    sourceProjectRef: string,
    sourceRegion: string,
    sourceDbPassword: string,
    sourcePat: string,
    targetProjectRef: string,
    targetRegion: string,
    targetDbPassword: string,
    targetPat: string,
    onProgress: (progress: number, message: string) => void,
    onLog: (data: string) => void,
    signal?: AbortSignal
) {
    onProgress(5, "Resolving most reliable connection paths...");

    const psqlPath = await getBinaryPath('psql');
    const pgDumpPath = await getBinaryPath('pg_dump');
    const pgDumpAllPath = await getBinaryPath('pg_dumpall');

    const sourceRes = await resolveBestConfig(sourceProjectRef, sourcePat, sourceRegion, sourceDbPassword);
    const targetRes = await resolveBestConfig(targetProjectRef, targetPat, targetRegion, targetDbPassword);

    const sourceDbUrl = sourceRes.url;
    const targetDbUrl = targetRes.url;

    const tmpDir = os.tmpdir();
    const rolesFile = path.join(tmpDir, `roles_${Date.now()}.sql`);
    const schemaFile = path.join(tmpDir, `schema_${Date.now()}.sql`);
    const dataFile = path.join(tmpDir, `data_${Date.now()}.sql`);

    const execOptions = {
        maxBuffer: 1024 * 1024 * 500, // 500MB buffer for large migrations
    };

    const cleanup = async () => {
        const files = [rolesFile, schemaFile, dataFile];
        for (const file of files) {
            try {
                await fs.unlink(file);
            } catch (e) { }
        }
    };

    try {
        // --- 1. Roles ---
        onProgress(35, `Dumping Source Roles (via ${sourceRes.strategy})...`);
        await spawnAsync(`${pgDumpAllPath} --clean --roles-only --quote-all-identifiers --no-role-passwords --dbname="${sourceDbUrl}" --file="${rolesFile}"`, {
            ...execOptions,
            signal,
            env: { ...process.env, PGPASSWORD: sourceDbPassword, PGCONNECT_TIMEOUT: '5' }
        }, onLog);

        // 1.5 Filter protected Supabase roles
        // We cannot blindly execute DROP/ALTER against reserved internal Supabase roles (anon, postgres, authenticator, etc.)
        onProgress(38, `Stripping protected Supabase internal roles from dump...`);
        let rolesData = await fs.readFile(rolesFile, 'utf8');

        // Remove statements affecting reserved roles.
        // E.g., DROP ROLE "anon"; ALTER ROLE "anon" WITH ...; CREATE ROLE "anon"; 
        const protectedRoles = [
            'anon', 'authenticator', 'authenticated', 'service_role', 'postgres',
            'pgbouncer', 'pg_database_owner', 'pg_execute_server_program',
            'pg_monitor', 'pg_read_all_data', 'pg_read_all_settings',
            'pg_read_all_stats', 'pg_read_server_files', 'pg_signal_backend',
            'pg_stat_scan_tables', 'pg_write_all_data', 'pg_write_server_files',
            'pgsodium_keyiduser', 'pgsodium_keymaker', 'supabase_admin',
            'supabase_auth_admin', 'supabase_functions_admin', 'supabase_read_only_user',
            'supabase_replication_admin', 'supabase_storage_admin'
        ];

        // These regexes aggressively target common commands targeting those roles.
        for (const role of protectedRoles) {
            // Matches CREATE ROLE, ALTER ROLE, DROP ROLE
            const roleRegex = new RegExp(`^(CREATE|ALTER|DROP)\\s+(ROLE|USER)\\s+"?${role}"?[^;]*;`, 'gim');
            rolesData = rolesData.replace(roleRegex, `-- Skipped protected role definition: ${role}`);

            // Matches GRANT role TO ... or GRANT ... TO role
            const grantRegex = new RegExp(`^GRANT\\s+[^;]*"?${role}"?[^;]*;`, 'gim');
            rolesData = rolesData.replace(grantRegex, `-- Skipped protected role grant: ${role}`);

            // Matches ALTER ROLE foo SET ... 
            const setRegex = new RegExp(`^ALTER\\s+(ROLE|USER)\\s+"?${role}"?\\s+SET[^;]*;`, 'gim');
            rolesData = rolesData.replace(setRegex, `-- Skipped protected role setting: ${role}`);
        }

        await fs.writeFile(rolesFile, rolesData, 'utf8');

        onProgress(40, `Restoring Roles to Target (via ${targetRes.strategy})...`);
        // We remove ON_ERROR_STOP=1 here because Supabase may throw harmless warnings about role permissions that we want postgres to ignore and continue.
        await spawnAsync(`${psqlPath} --quiet --single-transaction --file="${rolesFile}" --dbname="${targetDbUrl}"`, {
            ...execOptions,
            signal,
            env: { ...process.env, PGPASSWORD: targetDbPassword, PGCONNECT_TIMEOUT: '5' }
        }, onLog);

        // --- 2. Schema ---
        onProgress(45, "Dumping Source Database Schema...");
        const excludeSchemas = `--exclude-schema="supabase_migrations" --exclude-schema="pgbouncer" --exclude-schema="graphql" --exclude-schema="graphql_public" --exclude-schema="pgsodium" --exclude-schema="pgsodium_masks" --exclude-schema="realtime" --exclude-schema="vault"`;

        await spawnAsync(`${pgDumpPath} --clean --if-exists --quote-all-identifiers --schema-only ${excludeSchemas} --dbname="${sourceDbUrl}" --file="${schemaFile}"`, {
            ...execOptions,
            signal,
            env: { ...process.env, PGPASSWORD: sourceDbPassword, PGCONNECT_TIMEOUT: '5' }
        }, onLog);

        // 2.5 Filter protected Supabase event triggers
        onProgress(50, "Stripping Supabase internal event triggers from schema dump...");
        let schemaData = await fs.readFile(schemaFile, 'utf8');
        const triggerRegex = /^(CREATE|ALTER|DROP|COMMENT ON)\s+EVENT TRIGGER[\s\S]*?;/gim;
        schemaData = schemaData.replace(triggerRegex, '-- Skipped event trigger');
        await fs.writeFile(schemaFile, schemaData, 'utf8');

        onProgress(55, "Restoring Schema to Target...");
        await spawnAsync(`${psqlPath} --quiet --file="${schemaFile}" --dbname="${targetDbUrl}"`, {
            ...execOptions,
            signal,
            env: { ...process.env, PGPASSWORD: targetDbPassword, PGCONNECT_TIMEOUT: '5' }
        }, onLog);

        // --- 3. Data ---
        onProgress(65, "Dumping Source Database Data...");
        await spawnAsync(`${pgDumpPath} --quote-all-identifiers --data-only ${excludeSchemas} --dbname="${sourceDbUrl}" --file="${dataFile}"`, {
            ...execOptions,
            signal,
            env: { ...process.env, PGPASSWORD: sourceDbPassword, PGCONNECT_TIMEOUT: '5' }
        }, onLog);

        onProgress(75, "Restoring Data to Target...");
        await spawnAsync(`${psqlPath} --quiet --file="${dataFile}" --dbname="${targetDbUrl}"`, {
            ...execOptions,
            signal,
            env: {
                ...process.env,
                PGPASSWORD: targetDbPassword,
                PGCONNECT_TIMEOUT: '5',
                PGOPTIONS: '-c session_replication_role=replica'
            }
        }, onLog);

        await cleanup();
    } catch (error: any) {
        await cleanup();
        console.error("Database Migration Error:", error);
        throw new Error(`Database migration failed: ${error.message}`);
    }
}
