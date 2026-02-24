import { NextResponse } from 'next/server';
import { patchProjectConfig, fetchProjectConfig } from '@/lib/migration-steps/settings';
import { migrateDatabase } from '@/lib/migration-steps/database';
import { syncStorage } from '@/lib/migration-steps/storage';
import { migrateEdgeFunctions } from '@/lib/migration-steps/edge-functions';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

export async function POST(req: Request) {
    try {
        const {
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
        } = await req.json();

        if (!sourcePat || !targetPat || !sourceProject || !sourceRegion || !sourceDbPassword || !targetProject || !targetRegion || !targetDbPassword || !sourceServiceRole || !targetServiceRole) {
            return NextResponse.json({ error: 'Missing required configuration fields' }, { status: 400 });
        }

        // Initialize progress stream
        const encoder = new TextEncoder();
        const stream = new ReadableStream({
            async start(controller) {
                const emit = (progress: number, message: string) => {
                    const data = JSON.stringify({ progress, message });
                    controller.enqueue(encoder.encode(`data: ${data}\n\n`));
                };

                const emitLog = (logChunk: string) => {
                    // Redact passwords from postgresql:// URLs and PGPASSWORD= values
                    let safeLog = logChunk;
                    // Redact postgresql://user:PASSWORD@host
                    safeLog = safeLog.replace(/(postgresql:\/\/[^:]+:)[^@]+(@)/g, '$1***$2');
                    // Redact PGPASSWORD=value
                    safeLog = safeLog.replace(/PGPASSWORD=[^\s]+/g, 'PGPASSWORD=***');

                    const data = JSON.stringify({ log: safeLog });
                    controller.enqueue(encoder.encode(`data: ${data}\n\n`));
                };

                try {
                    const signal = req.signal;
                    const stateFile = path.join(os.tmpdir(), `migration_state_${sourceProject}_${targetProject}.json`);
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

                    // 1. Authenticating & Fetching Settings
                    if (!completedSteps.includes('settings')) {
                        emit(10, "Fetching Source Project Settings...");
                        const sourceConfig = await fetchProjectConfig(sourcePat, sourceProject);

                        if (signal.aborted) throw new Error("Migration aborted by user");
                        emit(20, "Patching Target Project Settings...");
                        try {
                            await patchProjectConfig(targetPat, targetProject, sourceConfig);
                        } catch (e: any) {
                            console.warn('Non-fatal: Config patch failed. Continuing migration...', e.message);
                            emit(20, `Settings sync skipped (Non-fatal warning)`);
                        }
                        await markCompleted('settings');
                    } else {
                        emit(20, "Skipping Settings Sync (Already completed in prior run)");
                    }

                    // 2 & 3. Migrating Database Roles, Schema & Data
                    if (!completedSteps.includes('database')) {
                        if (signal.aborted) throw new Error("Migration aborted by user");
                        await migrateDatabase(
                            sourceProject,
                            sourceRegion,
                            sourceDbPassword,
                            sourcePat,
                            targetProject,
                            targetRegion,
                            targetDbPassword,
                            targetPat,
                            emit,
                            emitLog,
                            signal
                        );
                        await markCompleted('database');
                    } else {
                        emit(70, "Skipping Database Sync (Already completed in prior run)");
                    }

                    // 4. Synchronizing Storage
                    if (!completedSteps.includes('storage')) {
                        if (signal.aborted) throw new Error("Migration aborted by user");
                        emit(80, "Synchronizing Storage Buckets & Files...");
                        await syncStorage(sourceProject, targetProject, sourceServiceRole, targetServiceRole, emit, signal);
                        await markCompleted('storage');
                    } else {
                        emit(90, "Skipping Storage Sync (Already completed in prior run)");
                    }

                    // 5. Deploying Edge Functions
                    if (!completedSteps.includes('edge_functions')) {
                        if (signal.aborted) throw new Error("Migration aborted by user");
                        emit(95, "Deploying Edge Functions...");
                        try {
                            await migrateEdgeFunctions(sourcePat, targetPat, sourceProject, targetProject, emit, emitLog, signal);
                        } catch (e: any) {
                            console.warn('Non-fatal: Edge function migration failed. Continuing...', e.message);
                            emit(95, `Edge Functions skipped (Non-fatal error)`);
                        }
                        await markCompleted('edge_functions');
                    } else {
                        emit(95, "Skipping Edge Functions (Already completed in prior run)");
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
