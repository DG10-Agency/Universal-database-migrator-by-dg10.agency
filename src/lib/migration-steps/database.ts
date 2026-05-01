import { DriverFactory, DriverType } from '@/lib/drivers/factory';
import { ConnectionConfig, MigrationOptions } from '@/lib/drivers/interface';

export async function migrateDatabase(
    sourceConfig: ConnectionConfig,
    targetConfig: ConnectionConfig,
    options: MigrationOptions
) {
    const { onProgress, onLog, signal } = options;
    
    onProgress(5, "Initializing Migration Engine...");

    const sourceDriverType = DriverFactory.detectType(sourceConfig);
    const targetDriverType = DriverFactory.detectType(targetConfig);

    const sourceDriver = DriverFactory.getDriver(sourceDriverType);
    const targetDriver = DriverFactory.getDriver(targetDriverType);

    onProgress(10, `Connecting to Source (${sourceDriverType})...`);
    const sourceStatus = await sourceDriver.testConnection(sourceConfig);
    if (!sourceStatus.success) throw new Error(`Source Connection Failed: ${sourceStatus.message}`);

    onProgress(15, `Connecting to Target (${targetDriverType})...`);
    const targetStatus = await targetDriver.testConnection(targetConfig);
    if (!targetStatus.success) throw new Error(`Target Connection Failed: ${targetStatus.message}`);

    let artifacts;
    try {
        // 1. Extract
        onProgress(20, "Extracting data from Source...");
        artifacts = await sourceDriver.dump(sourceConfig, options);

        // 2. Transform (Future implementation for cross-DB)
        if (sourceDriverType !== targetDriverType) {
            onProgress(70, `Transforming Dialect: ${sourceDriverType} → ${targetDriverType}...`);
            throw new Error(`Cross-dialect migrations (${sourceDriverType} to ${targetDriverType}) are not currently supported. Please ensure source and target are the same database type.`);
        }

        // 3. Load
        onProgress(80, "Restoring data to Target...");
        await targetDriver.restore(targetConfig, artifacts, options);

        onProgress(100, "Database Migration Successful");
    } catch (error: any) {
        console.error("Migration Engine Error:", error);
        throw error;
    } finally {
        if (artifacts) {
            await sourceDriver.cleanup(artifacts);
        }
    }
}

