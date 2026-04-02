/**
 * Test Supabase PostgreSQL Connection
 * Usage: node scripts/test-supabase-connection.js
 */

require('dotenv').config({ path: '.env.production' });
const { Pool } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL;

console.log('Testing Supabase connection...');
console.log('DATABASE_URL:', DATABASE_URL ? 'Set' : 'NOT SET');

if (!DATABASE_URL) {
    console.error('ERROR: DATABASE_URL not found in environment');
    process.exit(1);
}

const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function testConnection() {
    try {
        console.log('Connecting to PostgreSQL...');
        const result = await pool.query('SELECT NOW() as current_time, version() as version');
        console.log('✓ Connection successful!');
        console.log('Current time:', result.rows[0].current_time);
        console.log('PostgreSQL version:', result.rows[0].version);
        
        // Test if tables exist
        const tables = await pool.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public'
            ORDER BY table_name
        `);
        
        console.log('\nExisting tables:', tables.rows.length);
        tables.rows.forEach(row => console.log('  -', row.table_name));
        
    } catch (err) {
        console.error('✗ Connection failed!');
        console.error('Error:', err.message);
        console.error('Code:', err.code);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

testConnection();
