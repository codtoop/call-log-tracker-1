
const { Client } = require('pg');

async function testConnection() {
  const connectionString = "postgresql://postgres.jbfuctzueybopaltwxmm:%21XG2QkV4NKvMgq4@aws-1-eu-central-1.pooler.supabase.com:6543/postgres";
  console.log('Testing connection to pooler (6543)...');
  const client = new Client({ connectionString });
  try {
    await client.connect();
    console.log('Connected successfully!');
    const res = await client.query('SELECT NOW()');
    console.log('Query result:', res.rows[0]);
    await client.end();
  } catch (err) {
    console.error('Connection error:', err.message);
  }
}

testConnection();
