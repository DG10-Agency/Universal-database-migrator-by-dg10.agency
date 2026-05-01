import { NextResponse } from 'next/server';
import { patchProjectConfig, fetchProjectConfig } from '@/lib/migration-steps/settings';
import { migrateDatabase } from '@/lib/migration-steps/database';
import { ConnectionConfig } from '@/lib/drivers/interface';
import { DriverFactory } from '@/lib/drivers/factory';
import { syncStorage } from '@/lib/migration-steps/storage';
import { migrateEdgeFunctions } from '@/lib/migration-steps/edge-functions';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

export async function POST(req: Request) {
    try {
        const body = await req.json();

        const {
            // Universal fields
            sourceType = 'supabase',
            targetType = 'supabase',
            sourceConnectionString,
            targetConnectionString,
            // Supabase-specific fields
            sourcePat,
            targetPat,
            sourceProject,
            sourceRegion,
            sourceDbPassword,
            sourceServiceRole,
            targetProject,
            targetRegion,
            targetDbPassword,
            targetServiceRole,
            resume
        } = body;

        // --- Build ConnectionConfig objects based on type ---
        let sourceConfig: ConnectionConfig;
        let targetConfig: ConnectionConfig;

        if (sourceType === 'supabase') {
            if (!sourcePat || !sourceProject || !sourceRegion || !sourceDbPassword) {
                return NextResponse.json({ error: 'Missing required Source Supabase fields (PAT, Project Ref, Region, DB Password)' }, { status: 400 });
            }
            sourceConfig = {
                projectRef: sourceProject,
                region: sourceRegion,
                password: sourceDbPassword,
                pat: sourcePat,
            };
        } else {
            if (!sourceConnectionString) {
                return NextResponse.json({ error: 'Missing Source connection string' }, { status: 400 });
            }
            sourceConfig = { connectionString: sourceConnectionString };
        }

        if (targetType === 'supabase') {
            if (!targetPat || !targetProject || !targetRegion || !targetDbPassword) {
                return NextResponse.json({ error: 'Missing required Target Supabase fields (PAT, Project Ref, Region, DB Password)' }, { status: 400 });
            }
            targetConfig = {
                projectRef: targetProject,
                region: targetRegion,
                password: targetDbPassword,
                pat: targetPat,
            };
        } else {
            if (!targetConnectionString) {
                return NextResponse.json({ error: 'Missing Target connection string' }, { status: 400 });
            }
            targetConfig = { connectionString: targetConnectionString };
        }

        // Determine driver types for feature gating
        const sourceDriverType = DriverFactory.detectType(sourceConfig);
        const targetDriverType = DriverFactory.detectType(targetConfig);
        const isSupabaseToSupabase = sourceType === 'supabase' && targetType === 'supabase';

        // Initialize progress stream
        const encoder = new TextEncoder();
        const stream = new ReadableStream({
            async start(controller) {
                const emit = (progress: number, message: string) => {
                    const data = JSON.stringify({ progress, message });
                    controller.enqueue(encoder.encode(`data: ${data}\n\n`));
                };

                const emitLog = (logChunk: string) => {
                    // Redact passwords from postgresql://, mysql:// and other URI formats
                    let safeLog = logChunk;
                    
                    // Redact postgresql://user:PASSWORD@host
                    safeLog = safeLog.replace(/(postgresql:\/\/[^:]+:)[^@]+(@)/gi, '$1***$2');
                    // Redact postgres://user:PASSWORD@host
                    safeLog = safeLog.replace(/(postgres:\/\/[^:]+:)[^@]+(@)/gi, '$1***$2');
                    // Redact mysql://user:PASSWORD@host
                    safeLog = safeLog.replace(/(mysql:\/\/[^:]+:)[^@]+(@)/gi, '$1***$2');
                    // Redact PGPASSWORD=value
                    safeLog = safeLog.replace(/PGPASSWORD=[^\s]+/g, 'PGPASSWORD=***');
                    // Redact MYSQL_PWD=value
                    safeLog = safeLog.replace(/MYSQL_PWD=[^\s]+/g, 'MYSQL_PWD=***');
                    // Redact SUPABASE_ACCESS_TOKEN=value
                    safeLog = safeLog.replace(/SUPABASE_ACCESS_TOKEN=[^\s]+/g, 'SUPABASE_ACCESS_TOKEN=***');
                    // Redact -pPASSWORD (MySQL CLI flag) - but not -P (port flag)
                    safeLog = safeLog.replace(/-p(?![\s])[^\s]+/g, '-p***');
                    // Redact --password=PASSWORD
                    safeLog = safeLog.replace(/--password=[^\s]+/gi, '--password=***');

                    const data = JSON.stringify({ log: safeLog });
                    controller.enqueue(encoder.encode(`data: ${data}\n\n`));
                };

                try {
                    const signal = req.signal;
                    const stateKey = sourceConfig.projectRef || sourceConfig.connectionString?.slice(0, 20) || 'src';
                    const targetKey = targetConfig.projectRef || targetConfig.connectionString?.slice(0, 20) || 'tgt';
                    const stateFile = path.join(os.tmpdir(), `migration_state_${Buffer.from(stateKey).toString('base64url').slice(0, 16)}_${Buffer.from(targetKey).toString('base64url').slice(0, 16)}.json`);
                    let completedSteps: string[] = [];

                    if (resume) {
                        try {
                            const data = await fs.readFile(stateFile, 'utf-8');
                            completedSteps = JSON.parse(data);
                        } catch (e) { }
                    } else {
                        await fs.rm(stateFile, { force: true }).catch(() => { });
                    }

                    const markCompleted = async (step: string) => {
                        if (!completedSteps.includes(step)) {
                            completedSteps.push(step);
                            await fs.writeFile(stateFile, JSON.stringify(completedSteps));
                        }
                    };

                    // 1. Authenticating & Fetching Settings (Supabase-to-Supabase only)
                    if (isSupabaseToSupabase) {
                        if (!completedSteps.includes('settings')) {
                            emit(10, "Fetching Source Project Settings...");
                            const sourceSettings = await fetchProjectConfig(sourcePat!, sourceProject!);

                            if (signal.aborted) throw new Error("Migration aborted by user");
                            emit(20, "Patching Target Project Settings...");
                            try {
                                await patchProjectConfig(targetPat!, targetProject!, sourceSettings);
                            } catch (e: any) {
                                console.warn('Non-fatal: Config patch failed. Continuing migration...', e.message);
                                emit(20, `Settings sync skipped (Non-fatal warning)`);
                            }
                            await markCompleted('settings');
                        } else {
                            emit(20, "Skipping Settings Sync (Already completed in prior run)");
                        }
                    } else {
                        emit(10, `Cross-engine migration: ${sourceDriverType} → ${targetDriverType}. Skipping Supabase settings sync.`);
                        await markCompleted('settings');
                    }

                    // 2 & 3. Migrating Database Roles, Schema & Data
                    if (!completedSteps.includes('database')) {
                        if (signal.aborted) throw new Error("Migration aborted by user");

                        await migrateDatabase(
                            sourceConfig,
                            targetConfig,
                            { onProgress: emit, onLog: emitLog, signal }
                        );
                        await markCompleted('database');
                    } else {
                        emit(70, "Skipping Database Sync (Already completed in prior run)");
                    }

                    // 4. Synchronizing Storage (Supabase-to-Supabase only)
                    if (isSupabaseToSupabase) {
                        if (!completedSteps.includes('storage')) {
                            if (signal.aborted) throw new Error("Migration aborted by user");
                            emit(80, "Synchronizing Storage Buckets & Files...");
                            await syncStorage(sourceProject!, targetProject!, sourceServiceRole!, targetServiceRole!, emit, signal);
                            await markCompleted('storage');
                        } else {
                            emit(90, "Skipping Storage Sync (Already completed in prior run)");
                        }
                    } else {
                        emit(85, "Storage sync skipped (only available for Supabase-to-Supabase migrations).");
                        await markCompleted('storage');
                    }

                    // 5. Deploying Edge Functions (Supabase-to-Supabase only)
                    if (isSupabaseToSupabase) {
                        if (!completedSteps.includes('edge_functions')) {
                            if (signal.aborted) throw new Error("Migration aborted by user");
                            emit(95, "Deploying Edge Functions...");
                            try {
                                await migrateEdgeFunctions(sourcePat!, targetPat!, sourceProject!, targetProject!, emit, emitLog, signal);
                            } catch (e: any) {
                                console.warn('Non-fatal: Edge function migration failed. Continuing...', e.message);
                                emit(95, `Edge Functions skipped (Non-fatal error)`);
                            }
                            await markCompleted('edge_functions');
                        } else {
                            emit(95, "Skipping Edge Functions (Already completed in prior run)");
                        }
                    } else {
                        emit(95, "Edge Functions skipped (only available for Supabase-to-Supabase migrations).");
                        await markCompleted('edge_functions');
                    }

                    emit(100, "Migration Completed Successfully");
                    await fs.rm(stateFile, { force: true }).catch(() => { });
                    controller.close();
                } catch (error: any) {
                    const errData = JSON.stringify({ error: error.message || 'Migration failed' });
                    controller.enqueue(encoder.encode(`data: ${errData}\n\n`));
                    controller.close();
                }
            }
        });

        return new Response(stream, {
            headers: {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                Connection: 'keep-alive',
            },
        });

    } catch (error) {
        console.error('Migration API Error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
