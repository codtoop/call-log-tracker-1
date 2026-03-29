
async function testLogin() {
  try {
    console.log('Testing login API...');
    const res = await fetch('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username: 'newagent', password: 'newpassword' }),
    });

    const status = res.status;
    const data = await res.json();
    console.log(`Status: ${status}`);
    console.log('Response:', JSON.stringify(data, null, 2));

  } catch (error) {
    console.error('Error testing login API:', error.message);
  }
}

testLogin();
