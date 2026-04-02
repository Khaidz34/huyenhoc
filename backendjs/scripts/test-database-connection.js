#!/usr/bin/env node

/**
 * Test script to verify database connection using environment variables
 * This script tests the database service connection parsing
 */

// Load environment variables the same way as server.js
// First clear any existing DATABASE_URL to ensure we use the .env file
delete process.env.DATABASE_URL;
require('dotenv').config();

const DatabaseService = require('../src/services/database.service.postgres.js');

async function testConnection() {
    console.log('Testing database connection...');
    console.log('DATABASE_URL:', process.env.DATABASE_URL ? 'Set' : 'Not set');
    console.log('NODE_ENV:', process.env.NODE_ENV);
    console.log('Current working directory:', process.cwd());
    
    // Debug: show first part of DATABASE_URL to identify which one is being used
    if (process.env.DATABASE_URL) {
        const url = new URL(process.env.DATABASE_URL.replace('postgresql://', 'postgres://'));
        console.log('Database host from env:', url.hostname);
    }
    
    try {
        // Initialize database connection
        await DatabaseService.init();
        
        // Test a simple query
        const result = await DatabaseService.get('SELECT NOW() as current_time, version() as pg_version');
        console.log('✅ Database connection successful!');
        console.log('Current time:', result.current_time);
        console.log('PostgreSQL version:', result.pg_version);
        
        // Test table existence
        const tables = await DatabaseService.all(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            ORDER BY table_name
        `);
        
        console.log('\n📋 Available tables:');
        tables.forEach(table => {
            console.log(`  - ${table.table_name}`);
        });
        
        // Close connection
        await DatabaseService.close();
        console.log('\n✅ Connection test completed successfully!');
        
    } catch (error) {
        console.error('❌ Database connection failed:', error.message);
        console.error('Stack trace:', error.stack);
        process.exit(1);
    }
}

// Run the test
testConnection();