const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const logs = await prisma.callLog.findMany({
    orderBy: { id: 'desc' },
    take: 10,
    include: { agent: true }
  });
  
  console.log("--- RECENT LOGS METADATA ---");
  logs.forEach(log => {
      // Look for any mention of URL or VERSION in metadata
      console.log(`ID: ${log.id} | Agent: ${log.agent.username} | Metadata Sample: ${log.metadata ? log.metadata.substring(0, 100) : 'NULL'}`);
  });
}

main().finally(() => prisma.$disconnect());
