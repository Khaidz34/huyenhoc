/**
 * Database Singleton
 * All routes should import THIS file instead of database.service directly.
 * This ensures the correct adapter (SQLite or PostgreSQL) is used based on environment.
 */
const DatabaseFactory = require('./database.factory');
module.exports = DatabaseFactory.createService();
