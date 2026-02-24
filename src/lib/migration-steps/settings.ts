export async function fetchProjectConfig(pat: string, projectRef: string) {
    // 1. Fetch PostgREST config
    const postgrestResponse = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/postgrest`, {
        headers: {
            'Authorization': `Bearer ${pat}`
        }
    });

    if (!postgrestResponse.ok) {
        throw new Error(`Failed to fetch PostgREST config: ${postgrestResponse.status} ${await postgrestResponse.text()}`);
    }

    // 2. Fetch Auth config
    const authResponse = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/config/auth`, {
        headers: {
            'Authorization': `Bearer ${pat}`
        }
    });

    if (!authResponse.ok) {
        throw new Error(`Failed to fetch Auth config: ${authResponse.status} ${await authResponse.text()}`);
    }

    const postgrestConfig = await postgrestResponse.json();
    const authConfig = await authResponse.json();

    return { postgrestConfig, authConfig };
}

export async function patchProjectConfig(pat: string, projectRef: string, config: any) {
    const { postgrestConfig, authConfig } = config;

    // Clean up PostgREST config (remove nulls to prevent 400 errors from Supabase API)
    const cleanPostgrestConfig: Record<string, any> = {};
    for (const [key, value] of Object.entries(postgrestConfig || {})) {
        if (value !== null && value !== undefined) {
            cleanPostgrestConfig[key] = value;
        }
    }

    // 1. Patch PostgREST config
    const patchPostgrest = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/postgrest`, {
        method: 'PATCH',
        headers: {
            'Authorization': `Bearer ${pat}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(cleanPostgrestConfig)
    });

    if (!patchPostgrest.ok) {
        let errMessage = patchPostgrest.statusText;
        try { errMessage = await patchPostgrest.text(); } catch (e) { }
        throw new Error(`Failed to patch PostgREST config: ${patchPostgrest.status} ${errMessage}`);
    }

    // Prepare Auth Config, stripping out generic read-only fields
    const readOnlyFields = ['id', 'project_id', 'created_at', 'updated_at', 'last_sign_in_at', 'api_id', 'base_url', 'db_host', 'db_name'];

    const cleanAuthConfig: Record<string, any> = {};
    for (const [key, value] of Object.entries(authConfig || {})) {
        if (value !== null && value !== undefined && !readOnlyFields.includes(key)) {
            // Drop SMTP & Rate Limit fields as they require the SMTP_PASS which isn't exported
            if (key.startsWith('SMTP_') || key.startsWith('RATE_LIMIT_') || key.startsWith('MAILER_')) {
                continue;
            }
            cleanAuthConfig[key] = value;
        }
    }

    // 2. Patch Auth config
    const patchAuth = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/config/auth`, {
        method: 'PATCH',
        headers: {
            'Authorization': `Bearer ${pat}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(cleanAuthConfig)
    });

    if (!patchAuth.ok) {
        throw new Error(`Failed to patch Auth config: ${patchAuth.status} ${await patchAuth.text()}`);
    }
}
