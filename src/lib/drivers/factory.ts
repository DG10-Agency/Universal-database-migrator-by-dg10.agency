import { IDatabaseDriver } from './interface';
import { PostgresDriver } from './postgres';
import { MySQLDriver } from './mysql';
import { SQLiteDriver } from './sqlite';

export type DriverType = 'postgres' | 'mysql' | 'sqlite';

export class DriverFactory {
    static getDriver(type: DriverType): IDatabaseDriver {
        switch (type) {
            case 'postgres':
                return new PostgresDriver();
            case 'mysql':
                return new MySQLDriver();
            case 'sqlite':
                return new SQLiteDriver();
            default:
                throw new Error(`Unsupported driver type: ${type}`);
        }
    }

    static detectType(config: any): DriverType {
        if (config.connectionString) {
            const lower = config.connectionString.toLowerCase();
            if (lower.startsWith('postgres')) return 'postgres';
            if (lower.startsWith('mysql')) return 'mysql';
            if (lower.endsWith('.db') || lower.endsWith('.sqlite')) return 'sqlite';
        }
        return 'postgres';
    }
}
