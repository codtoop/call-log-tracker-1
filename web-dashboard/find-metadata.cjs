const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const logs = await prisma.callLog.findMany({
    where: { metadata: { not: null } },
    orderBy: { id: 'desc' },
    take: 10,
    include: { agent: true }
  });
  
  if (logs.length === 0) {
    console.log("No logs with metadata found yet.");
    return;
  }
  
  console.log("--- LATEST LOGS WITH METADATA ---");
  logs.forEach(log => {
      console.log(`ID: ${log.id} | Agent: ${log.agent.username} | By: ${log.disconnectedBy} | Metadata: ${log.metadata}`);
  });
}

main().finally(() => prisma.$disconnect());
