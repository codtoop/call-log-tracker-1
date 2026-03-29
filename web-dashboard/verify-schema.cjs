
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function test() {
  try {
    console.log('Testing database schema...');
    
    // Check if LoginSession model is available
    const loginSessionsCount = await prisma.loginSession.count();
    console.log('LoginSessions count:', loginSessionsCount);
    
    // Check if AgentSession model is available
    const agentSessionsCount = await prisma.agentSession.count();
    console.log('AgentSessions count:', agentSessionsCount);
    
    console.log('Database verification successful!');
  } catch (error) {
    console.error('Database verification failed:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

test();
