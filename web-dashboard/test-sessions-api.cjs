


async function testSessions() {
  console.log('Testing sessions API...');
  try {
    // 1. Login to get token
    const loginRes = await fetch('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'adminpassword' }),
    });
    const { token } = await loginRes.json();
    console.log('Logged in, token received.');

    // 2. Fetch sessions for admin (dc79bee0-5a3d-4d58-a3d1-c2abe85f03bc)
    const res = await fetch('http://localhost:3000/api/agents/dc79bee0-5a3d-4d58-a3d1-c2abe85f03bc/sessions', {
      headers: { 
        'Authorization': `Bearer ${token}`
      },
    });
    
    const data = await res.json();
    console.log('Sessions response:', JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('Error testing sessions API:', err.message);
  }
}

testSessions();
