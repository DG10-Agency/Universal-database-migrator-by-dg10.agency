import { createClient, SupabaseClient } from '@supabase/supabase-js';
import path from 'path';

// Recursive function to fetch all files traversing folders
async function listAllFiles(client: SupabaseClient, bucketName: string, path: string = ''): Promise<any[]> {
    const allFiles: any[] = [];
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
        const { data, error } = await client.storage.from(bucketName).list(path, {
            limit: 100,
            offset,
            sortBy: { column: 'name', order: 'asc' },
        });

        if (error) throw error;
        if (!data || data.length === 0) break;

        for (const item of data) {
            // Ignore Supabase internal placeholders
            if (item.name === '.emptyFolderPlaceholder') continue;

            const fullPath = path ? `${path}/${item.name}` : item.name;

            // In Supabase storage list(), folders typically lack an `id`
            if (!item.id) {
                const subFiles = await listAllFiles(client, bucketName, fullPath);
                allFiles.push(...subFiles);
            } else {
                allFiles.push({ ...item, fullPath });
            }
        }

        offset += data.length;
        if (data.length < 100) hasMore = false;
    }

    return allFiles;
}

export async function syncStorage(
    sourceProject: string,
    targetProject: string,
    sourceServiceRoleKey: string,
    targetServiceRoleKey: string,
    onProgress: (progress: number, message: string) => void,
    signal?: AbortSignal
) {
    onProgress(82, "Initializing Storage Clients...");

    const sourceUrl = `https://${sourceProject}.supabase.co`;
    const targetUrl = `https://${targetProject}.supabase.co`;

    // Service Role Keys are required to bypass RLS and create buckets
    if (!sourceServiceRoleKey || !targetServiceRoleKey) {
        throw new Error("Storage sync cannot proceed without valid Service Role Keys for both Source and Target.");
    }

    const sourceClient = createClient(sourceUrl, sourceServiceRoleKey, {
        auth: { persistSession: false }
    });

    const targetClient = createClient(targetUrl, targetServiceRoleKey, {
        auth: { persistSession: false }
    });

    try {
        // 1. Fetch Buckets
        if (signal?.aborted) throw new Error("Storage sync aborted");
        onProgress(83, "Fetching Buckets from Source...");
        const { data: buckets, error: bucketsError } = await sourceClient.storage.listBuckets();
        if (bucketsError) throw bucketsError;

        if (!buckets || buckets.length === 0) {
            onProgress(85, "No buckets found to migrate.");
            return;
        }

        // 2. Process each Bucket
        for (const bucket of buckets) {
            if (signal?.aborted) throw new Error("Storage sync aborted");
            onProgress(84, `Processing Bucket: ${bucket.name}...`);

            // Try to fetch bucket on target, if not exists, create it
            const { error: targetBucketFetchError } = await targetClient.storage.getBucket(bucket.name);

            if (targetBucketFetchError && targetBucketFetchError.message.includes('not found')) {
                const { error: createError } = await targetClient.storage.createBucket(bucket.name, {
                    public: bucket.public,
                    allowedMimeTypes: bucket.allowed_mime_types || undefined,
                    fileSizeLimit: bucket.file_size_limit || undefined
                });
                if (createError) {
                    console.warn(`Could not create bucket ${bucket.name} on target:`, createError.message);
                    throw new Error(`Failed to create bucket ${bucket.name}: ${createError.message}`);
                }
            }

            // 3. Recursively List Objects in Bucket
            onProgress(85, `Listing files in bucket ${bucket.name}...`);
            const objects = await listAllFiles(sourceClient, bucket.name);

            if (objects.length === 0) continue;

            // 4. Download and Upload Objects
            let processed = 0;
            const total = objects.length;

            for (const obj of objects) {
                if (signal?.aborted) throw new Error("Storage sync aborted");
                // Progress mapped between 85 and 95 based on total files
                const currentProgress = 85 + Math.floor((processed / total) * 10);
                onProgress(currentProgress, `Syncing File: ${bucket.name}/${obj.fullPath} (${processed + 1}/${total})`);

                // Download from source
                const { data: fileBlob, error: downloadError } = await sourceClient.storage.from(bucket.name).download(obj.fullPath);
                if (downloadError) {
                    console.warn(`Failed to download ${obj.fullPath} from source:`, downloadError.message);
                    continue; // Skip file if download fails
                }

                if (!fileBlob) continue;

                // Upload to target
                const { error: uploadError } = await targetClient.storage.from(bucket.name).upload(obj.fullPath, fileBlob, {
                    contentType: obj.metadata?.mimetype,
                    upsert: true
                });

                if (uploadError) {
                    console.warn(`Failed to upload ${obj.fullPath} to target:`, uploadError.message);
                } else {
                    // Step 5: Simple Verification - check if file exists on target
                    const pathParts = obj.fullPath.split('/');
                    const fileName = pathParts.pop();
                    const dirName = pathParts.join('/') || '';

                    const { data: exists } = await targetClient.storage.from(bucket.name).list(dirName, {
                        search: fileName
                    });
                    if (!exists || exists.length === 0) {
                        console.warn(`Verification failed for ${obj.fullPath}: File not found on target after upload.`);
                    }
                }
                processed++;
            }
        }

        onProgress(95, "Storage Sync Completed.");

    } catch (error: any) {
        console.error("Storage Sync Error:", error);
        throw new Error(`Storage sync failed: ${error.message}`);
    }
}
