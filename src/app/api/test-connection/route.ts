import { NextResponse } from 'next/server';
import { DriverFactory, DriverType } from '@/lib/drivers/factory';

function getSuggestionForDriver(driverType: DriverType): string {
    switch (driverType) {
        case 'postgres':
            return '1. Ensure your region is correct. 2. If you are on a restricted office network, use a personal hotspot. 3. Verify your project is not paused. 4. Double-check your database password.';
        case 'mysql':
            return '1. Verify the MySQL server is running and accepting connections. 2. Check that the host, port, username, and password are correct. 3. Ensure the MySQL user has remote access privileges. 4. Check firewall rules on the server.';
        case 'sqlite':
            return '1. Verify the database file path exists and is accessible. 2. Ensure the file is not locked by another process. 3. Check file permissions.';
        default:
            return 'Verify your connection details and try again.';
    }
}

export async function POST(req: Request) {
    try {
        const config = await req.json();

        // Validate: either Supabase-style (projectRef+password+pat) or generic (connectionString)
        if ((!config.projectRef || !config.password || !config.pat) && !config.connectionString) {
            return NextResponse.json({ error: 'Missing required credentials. Provide either a Connection String or Supabase Project Ref + Password + PAT.' }, { status: 400 });
        }

        const driverType = DriverFactory.detectType(config);
        const driver = DriverFactory.getDriver(driverType);

        const result = await driver.testConnection(config);

        if (result.success) {
            return NextResponse.json({
                success: true,
                message: result.message,
                driver: driverType,
                details: result.details
            });
        } else {
            return NextResponse.json({
                error: result.message,
                driver: driverType,
                suggestion: getSuggestionForDriver(driverType)
            }, { status: 500 });
        }

    } catch (error: any) {
        console.error('API Error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
