const jwt = require('jsonwebtoken');

const token = jwt.sign({ userId: 'something', role: 'ADMIN' }, process.env.JWT_SECRET || 'super_secret_jwt_key_change_me_in_prod', { expiresIn: '1h' });

async function testFetchAgents() {
  const res = await fetch('http://localhost:3000/api/agents', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const data = await res.json();
  console.log(JSON.stringify(data, null, 2));
}

testFetchAgents().catch(console.error);
