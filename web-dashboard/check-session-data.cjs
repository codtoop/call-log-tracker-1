
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkData() {
  try {
    console.log('Checking AgentSession data...');
    const agentSessions = await prisma.agentSession.findMany({
      take: 5,
      orderBy: { startTime: 'desc' }
    });
    console.log('Recent AgentSessions:', JSON.stringify(agentSessions, null, 2));

    console.log('\nChecking LoginSession data...');
    const loginSessions = await prisma.loginSession.findMany({
      take: 5,
      orderBy: { startTime: 'desc' }
    });
    console.log('Recent LoginSessions:', JSON.stringify(loginSessions, null, 2));

  } catch (error) {
    console.error('Error checking database data:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkData();
