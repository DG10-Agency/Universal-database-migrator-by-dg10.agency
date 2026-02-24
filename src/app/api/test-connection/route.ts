import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import { getBinaryPath } from '@/lib/utils/binaries';

const execAsync = promisify(exec);

export async function POST(req: Request) {
    try {
        const { projectRef, password, pat, region } = await req.json();

        if (!projectRef || !password || !pat) {
            return NextResponse.json({ error: 'Missing required credentials' }, { status: 400 });
        }

        const trimmedRef = projectRef.trim().toLowerCase();

        // Sanitize region format: "US East (N. Virginia)" -> "us-east-1", "us east 1" -> "us-east-1"
        let trimmedRegion = region?.trim().toLowerCase() || '';
        trimmedRegion = trimmedRegion.replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');

        /**
         * 🛡️ MULTI-STRATEGY CONNECTIVITY (Version 3)
         * We cycle through every known Supabase host pattern.
         */
        const strategies: any[] = [];
        let allErrors: string[] = [];

        // Strategy 1: SMART DISCOVERY (API) - Get the exact pooler host Supabase recommends
        try {
            const configResp = await fetch(`https://api.supabase.com/v1/projects/${trimmedRef}/config/database/pooler`, {
                headers: { 'Authorization': `Bearer ${pat}` }
            });
            if (configResp.ok) {
                const config = await configResp.json();
                if (config.db_host) {
                    strategies.push({ host: config.db_host, port: config.db_port || 6543, user: `postgres.${trimmedRef}`, note: 'Management API discovery' });
                } else {
                    allErrors.push(`[Management API]: Succeeded but db_host missing from response: ${JSON.stringify(config)}`);
                }
            } else {
                const errText = await configResp.text();
                allErrors.push(`[Management API]: HTTP ${configResp.status} - ${errText}`);
            }
        } catch (e: any) {
            console.warn('Management API skip:', e);
            allErrors.push(`[Management API]: Fetch failed - ${e.message}`);
        }

        // Strategy 2: UNIVERSAL POOLER (The "New Standard" - Region Independent)
        strategies.push({ host: `${trimmedRef}.pooler.supabase.com`, port: 6543, user: `postgres.${trimmedRef}`, note: 'Universal Pooler' });

        // Strategy 3: REGIONAL POOLER (Manual construction)
        if (trimmedRegion) {
            strategies.push({ host: `aws-0-${trimmedRegion}.pooler.supabase.com`, port: 6543, user: `postgres.${trimmedRef}`, note: 'Regional Pooler (aws-0)' });
            strategies.push({ host: `aws-1-${trimmedRegion}.pooler.supabase.com`, port: 6543, user: `postgres.${trimmedRef}`, note: 'Regional Pooler (aws-1)' });
        }

        // Strategy 4: UNIVERSAL DIRECT (Port 5432 - Often blocked by local ISPs/Firewalls)
        strategies.push({ host: `db.${trimmedRef}.supabase.co`, port: 5432, user: 'postgres', note: 'Direct Connection' });

        let attemptedHosts: string[] = [];

        for (const strategy of strategies) {
            const { host, port, user, note } = strategy;
            attemptedHosts.push(`${host}:${port} [${note}]`);

            // SECURITY: Never pass password in shell args, use env
            const env = {
                ...process.env,
                PGPASSWORD: password,
                PGSSLMODE: 'require',
                PGCONNECT_TIMEOUT: '5'
            };

            // We use -l (list) as it's lighter than -c "SELECT 1" for verification
            const psqlPath = await getBinaryPath('psql');
            const command = `${psqlPath} -h ${host} -p ${port} -U ${user} -d postgres -c "SELECT 1"`;

            try {
                await execAsync(command, { env });
                return NextResponse.json({
                    success: true,
                    message: `Connection successful via ${note}!`,
                    details: { host, port, user, strategy: note }
                });
            } catch (err: any) {
                const stderr = err.message || '';
                allErrors.push(`[${note}]: ${stderr}`);

                // If it's a password error, IT'S A PASSWORD ERROR. The host is valid!
                if (stderr.toLowerCase().includes('password authentication failed')) {
                    return NextResponse.json({
                        error: `Auth Failed: Your password was rejected by the database at ${host}. This confirms the region/host is CORRECT, but your password is not.`,
                        raw: stderr,
                        attempted: strategy
                    }, { status: 401 });
                }
            }
        }

        // All strategies failed
        return NextResponse.json({
            error: 'Connectivity failed. We tried 4 different host patterns but could not reach your database.',
            suggestion: '1. Ensure your region is correct. 2. If you are on a restricted office network, use a personal hotspot. 3. Verify your project is not paused.',
            debug: allErrors.join('\n\n'),
            attempts: attemptedHosts
        }, { status: 500 });

    } catch (error: any) {
        console.error('API Error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
