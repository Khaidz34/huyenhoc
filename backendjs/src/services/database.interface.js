/**
 * Database Service Interface
 * Defines the contract that all database adapters must implement
 */

class DatabaseServiceInterface {
    /**
     * Initialize database connection
     * @returns {Promise<void>}
     */
    async init() {
        throw new Error('Method init() must be implemented');
    }

    /**
     * Close database connection
     * @returns {Promise<void>}
     */
    async close() {
        throw new Error('Method close() must be implemented');
    }

    /**
     * Execute a query that doesn't return data (INSERT, UPDATE, DELETE)
     * @param {string} sql - SQL query
     * @param {Array} params - Query parameters
     * @returns {Promise<{id: number, changes: number}>}
     */
    async run(sql, params = []) {
        throw new Error('Method run() must be implemented');
    }

    /**
     * Get first row result
     * @param {string} sql - SQL query
     * @param {Array} params - Query parameters
     * @returns {Promise<Object|undefined>}
     */
    async get(sql, params = []) {
        throw new Error('Method get() must be implemented');
    }

    /**
     * Get all rows
     * @param {string} sql - SQL query
     * @param {Array} params - Query parameters
     * @returns {Promise<Array>}
     */
    async all(sql, params = []) {
        throw new Error('Method all() must be implemented');
    }

    /**
     * Health check
     * @returns {Promise<Object>}
     */
    async healthCheck() {
        throw new Error('Method healthCheck() must be implemented');
    }

    /**
     * Get health status
     * @returns {Object}
     */
    getHealthStatus() {
        throw new Error('Method getHealthStatus() must be implemented');
    }

    // Business logic methods that all adapters should implement

    /**
     * Find or create a customer
     * @param {Object} userData - Customer data
     * @returns {Promise<number>} Customer ID
     */
    async findOrCreateCustomer(userData) {
        throw new Error('Method findOrCreateCustomer() must be implemented');
    }

    /**
     * Save consultation
     * @param {number} customerId
     * @param {string} themeId
     * @param {string} questionId
     * @param {string} questionText
     * @param {string|Array} answer
     * @param {boolean} useAI
     * @param {number} creditsUsed
     * @param {number} userId
     * @param {string} persona
     * @param {Array} followUps
     * @param {Object} extraData
     * @returns {Promise<number>} Consultation ID
     */
    async saveConsultation(customerId, themeId, questionId, questionText, answer, useAI = true, creditsUsed = 0, userId = null, persona = 'huyen_co', followUps = [], extraData = {}) {
        throw new Error('Method saveConsultation() must be implemented');
    }

    /**
     * Get customer by ID
     * @param {number} customerId
     * @returns {Promise<Object|null>}
     */
    async getCustomer(customerId) {
        throw new Error('Method getCustomer() must be implemented');
    }

    /**
     * Get statistics
     * @returns {Promise<Object>}
     */
    async getStats() {
        throw new Error('Method getStats() must be implemented');
    }

    /**
     * Get customer history
     * @param {number} customerId
     * @param {number} limit
     * @returns {Promise<Array>}
     */
    async getCustomerHistory(customerId, limit = 50) {
        throw new Error('Method getCustomerHistory() must be implemented');
    }

    /**
     * Get all customers
     * @param {number} limit
     * @returns {Promise<Array>}
     */
    async getAllCustomers(limit = 100) {
        throw new Error('Method getAllCustomers() must be implemented');
    }

    /**
     * Save access log
     * @param {Object} data - Log data
     */
    saveAccessLog(data) {
        throw new Error('Method saveAccessLog() must be implemented');
    }

    /**
     * Clean old access logs
     * @param {number} days - Number of days to keep
     * @returns {Promise<number>} Number of deleted records
     */
    async cleanOldAccessLogs(days = 30) {
        throw new Error('Method cleanOldAccessLogs() must be implemented');
    }
}

module.exports = DatabaseServiceInterface;