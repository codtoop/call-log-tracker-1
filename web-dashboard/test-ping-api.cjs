


async function testPing() {
  console.log('Testing ping API...');
  try {
    // 1. Login to get token
    const loginRes = await fetch('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'newagent', password: 'newpassword' }),
    });
    const { token } = await loginRes.json();
    console.log('Logged in, token received.');

    // 2. Send ping
    const pingRes = await fetch('http://localhost:3000/api/agent/ping', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({}),
    });
    
    const data = await pingRes.json();
    console.log('Ping response:', data);
  } catch (err) {
    console.error('Error testing ping API:', err.message);
  }
}

testPing();
