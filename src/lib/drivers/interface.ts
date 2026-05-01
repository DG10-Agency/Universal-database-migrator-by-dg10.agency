export interface MigrationOptions {
    onProgress: (progress: number, message: string) => void;
    onLog: (data: string) => void;
    signal?: AbortSignal;
}

export interface ConnectionConfig {
    host?: string;
    port?: number;
    user?: string;
    password?: string;
    database?: string;
    connectionString?: string; // Universal URI support
    region?: string; // Supabase specific
    projectRef?: string; // Supabase specific
    pat?: string; // Supabase specific
}

export interface MigrationArtifacts {
    rolesFile?: string;
    schemaFile?: string;
    dataFile?: string;
    tempDir: string;
}

export interface IDatabaseDriver {
    /**
     * Verifies connectivity to the database.
     */
    testConnection(config: ConnectionConfig): Promise<{ 
        success: boolean; 
        message: string; 
        details?: any 
    }>;

    /**
     * Dumps the database content (Roles, Schema, Data).
     */
    dump(config: ConnectionConfig, options: MigrationOptions): Promise<MigrationArtifacts>;

    /**
     * Restores the database content from artifacts.
     */
    restore(config: ConnectionConfig, artifacts: MigrationArtifacts, options: MigrationOptions): Promise<void>;

    /**
     * Performs cleanup of temporary artifacts.
     */
    cleanup(artifacts: MigrationArtifacts): Promise<void>;
}
