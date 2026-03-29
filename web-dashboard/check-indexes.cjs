const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    const activityIndexes = await prisma.$queryRawUnsafe(`
      SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'AgentSession'
    `);
    const loginIndexes = await prisma.$queryRawUnsafe(`
      SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'LoginSession'
    `);
    
    console.log('--- AgentSession Indexes ---');
    console.log(JSON.stringify(activityIndexes, null, 2));
    console.log('--- LoginSession Indexes ---');
    console.log(JSON.stringify(loginIndexes, null, 2));
  } catch (e) {
    console.error('Error checking indexes:', e.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
