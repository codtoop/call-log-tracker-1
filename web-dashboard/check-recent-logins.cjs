const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const sessions = await prisma.loginSession.findMany({
    orderBy: { startTime: 'desc' },
    take: 5,
    include: { agent: true }
  });
  
  console.log("--- RECENT LOGIN SESSIONS ---");
  sessions.forEach(s => {
    console.log(`User: ${s.agent.username.padEnd(10)} | Start: ${s.startTime.toLocaleString()} | End: ${s.endTime ? s.endTime.toLocaleString() : 'ACTIVE'}`);
  });
}

main().finally(() => prisma.$disconnect());
