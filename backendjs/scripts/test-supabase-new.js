// Test Supabase connection
const { Pool } = require('pg');

const connectionString = 'postgresql://postgres.mrquumgqbngcwjrtmtdu:Chubedidaonay@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres';

const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
});

async function testConnection() {
    console.log('🔍 Testing Supabase connection...');
    console.log('Connection string:', connectionString.replace(/:[^:@]+@/, ':****@'));
    
    try {
        const client = await pool.connect();
        console.log('✅ Connected successfully!');
        
        const result = await client.query('SELECT NOW() as current_time, version() as pg_version');
        console.log('✅ Query successful!');
        console.log('Current time:', result.rows[0].current_time);
        console.log('PostgreSQL version:', result.rows[0].pg_version);
        
        client.release();
        await pool.end();
        
        console.log('\n✅ Database is working perfectly!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Connection failed:', error.message);
        console.error('Error code:', error.code);
        await pool.end();
        process.exit(1);
    }
}

testConnection();
