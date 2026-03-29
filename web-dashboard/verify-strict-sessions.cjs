
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function verify() {
  const username = 'testuser';
  const password = 'testpassword';
  const baseUrl = 'http://localhost:3000';

  console.log(`Verifying strict session logic for user: ${username}`);
  
  try {
    const user = await prisma.user.findUnique({ where: { username } });
    if (!user) {
      console.log('User not found');
      return;
    }

    // 1. Clean up
    await prisma.loginSession.updateMany({
      where: { agentId: user.id, endTime: null },
      data: { endTime: new Date() }
    });
    console.log('Cleaned up previous sessions.');

    // 2. Login
    console.log('Step 1: Logging in...');
    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    
    const loginData = await loginRes.json();
    console.log('Login result status:', loginRes.status);
    if (!loginRes.ok) {
        console.error('Login failed:', JSON.stringify(loginData));
        return;
    }
    const { token } = loginData;
    console.log('Login successful.');
    
    // Check DB
    const sessionAfterLogin = await prisma.loginSession.findFirst({
      where: { agentId: user.id, endTime: null },
      orderBy: { startTime: 'desc' }
    });
    console.log('Session after login:', sessionAfterLogin ? 'CREATED (OK)' : 'MISSING (FAIL)');
    if (sessionAfterLogin) console.log('Session ID:', sessionAfterLogin.id);

    // 3. Ping
    console.log('Step 2: Pinging (should NOT affect LoginSession)...');
    const pingRes = await fetch(`${baseUrl}/api/agent/ping`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    console.log('Ping status:', pingRes.status);
    
    const sessionAfterPing = await prisma.loginSession.findFirst({
      where: { agentId: user.id, endTime: null },
      orderBy: { startTime: 'desc' }
    });
    console.log('Session after ping ID:', sessionAfterPing?.id);
    console.log('Session after ping Status:', sessionAfterPing?.id === sessionAfterLogin?.id ? 'UNCHANGED (OK)' : 'MODIFIED (FAIL)');

    // 4. Logout
    console.log('Step 3: Logging out...');
    const logoutRes = await fetch(`${baseUrl}/api/agent/logout`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    console.log('Logout status:', logoutRes.status);
    
    // Check DB
    const closedSession = await prisma.loginSession.findUnique({
      where: { id: sessionAfterLogin.id }
    });
    console.log('Session after logout status:', closedSession?.endTime ? 'CLOSED (OK)' : 'STILL OPEN (FAIL)');

  } catch (err) {
    console.error('Verification failed:', err.message);
  } finally {
    await prisma.$disconnect();
  }
}

verify();
