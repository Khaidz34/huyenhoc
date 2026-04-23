/**
 * Database Factory
 * Creates appropriate database service based on environment
 */

const DatabaseServiceInterface = require('./database.interface');

class DatabaseFactory {
    /**
     * Create database service based on environment
     * @param {string} environment - Environment (development, production, test)
     * @returns {DatabaseServiceInterface}
     */
    static createService(environment = process.env.NODE_ENV) {
        const env = environment || 'development';
        
        console.log(`[DatabaseFactory] Creating database service for environment: ${env}`);
        
        // Check if SQLite is forced via environment variable
        if (process.env.USE_SQLITE === 'true') {
            console.log('[DatabaseFactory] USE_SQLITE flag detected, using SQLite for all environments');
            return this._createSQLiteService();
        }
        
        switch (env.toLowerCase()) {
            case 'production':
                // USE_SQLITE=true always overrides DATABASE_URL — checked above already,
                // but double-check here for clarity in production path.
                if (process.env.USE_SQLITE === 'true') {
                    console.log('[DatabaseFactory] USE_SQLITE=true — forcing SQLite in production');
                    return this._createSQLiteService();
                }

                // Only use PostgreSQL if DATABASE_URL is provided AND USE_SQLITE is not set
                if (process.env.DATABASE_URL) {
                    try {
                        const PostgreSQLAdapter = require('./database.service.postgres');
                        console.log('[DatabaseFactory] Using PostgreSQL adapter for production');
                        return PostgreSQLAdapter;
                    } catch (error) {
                        console.warn('[DatabaseFactory] PostgreSQL adapter not available, falling back to SQLite');
                        return this._createSQLiteService();
                    }
                } else {
                    console.log('[DatabaseFactory] No DATABASE_URL found, using SQLite for production');
                    return this._createSQLiteService();
                }
                
            case 'test':
                // Use in-memory SQLite for tests
                console.log('[DatabaseFactory] Using in-memory SQLite for tests');
                return this._createTestSQLiteService();
                
            case 'development':
            default:
                // Use file-based SQLite for development
                console.log('[DatabaseFactory] Using file-based SQLite for development');
                return this._createSQLiteService();
        }
    }

    /**
     * Create SQLite service (file-based)
     * @returns {DatabaseServiceInterface}
     */
    static _createSQLiteService() {
        const SQLiteAdapter = require('./database.service');
        return SQLiteAdapter;
    }

    /**
     * Create test SQLite service (in-memory)
     * @returns {DatabaseServiceInterface}
     */
    static _createTestSQLiteService() {
        // For now, use the same SQLite service
        // In the future, we can create a specialized test adapter with in-memory database
        const SQLiteAdapter = require('./database.service');
        return SQLiteAdapter;
    }

    /**
     * Get configuration for environment
     * @param {string} environment
     * @returns {Object}
     */
    static getConfig(environment = process.env.NODE_ENV) {
        const env = environment || 'development';
        
        const configs = {
            development: {
                type: 'sqlite',
                database: './data/bazi_consultant.db',
                options: {
                    journal_mode: 'WAL',
                    synchronous: 'NORMAL',
                    cache_size: -64000, // 64MB cache
                    temp_store: 'MEMORY'
                }
            },
            
            test: {
                type: 'sqlite',
                database: ':memory:', // In-memory for tests
                options: {
                    journal_mode: 'MEMORY',
                    synchronous: 'OFF', // Faster for tests
                    cache_size: -32000  // 32MB cache for tests
                }
            },
            
            production: {
                type: 'postgresql',
                connectionString: process.env.DATABASE_URL,
                ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
                pool: {
                    max: 20,                    // Maximum connections
                    idleTimeoutMillis: 30000,   // Close idle connections after 30s
                    connectionTimeoutMillis: 15000 // Timeout after 15s
                }
            }
        };

        return configs[env.toLowerCase()] || configs.development;
    }

    /**
     * Validate database service implements interface
     * @param {Object} service - Database service instance
     * @returns {boolean}
     */
    static validateService(service) {
        const requiredMethods = [
            'init', 'close', 'run', 'get', 'all', 'healthCheck', 'getHealthStatus',
            'findOrCreateCustomer', 'saveConsultation', 'getCustomer', 'getStats',
            'getCustomerHistory', 'getAllCustomers', 'saveAccessLog', 'cleanOldAccessLogs'
        ];

        for (const method of requiredMethods) {
            if (typeof service[method] !== 'function') {
                console.error(`[DatabaseFactory] Service missing required method: ${method}`);
                return false;
            }
        }

        console.log('[DatabaseFactory] Service validation passed');
        return true;
    }

    /**
     * Create and initialize database service
     * @param {string} environment
     * @returns {Promise<DatabaseServiceInterface>}
     */
    static async createAndInitialize(environment = process.env.NODE_ENV) {
        const service = this.createService(environment);
        
        // Validate service implements interface
        if (!this.validateService(service)) {
            throw new Error('Database service does not implement required interface');
        }

        // Initialize the service
        await service.init();
        
        console.log('[DatabaseFactory] Database service created and initialized successfully');
        return service;
    }
}

module.exports = DatabaseFactory;