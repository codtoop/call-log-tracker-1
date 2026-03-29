const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const logs = await prisma.callLog.findMany({
    where: { 
        duration: 0,
        type: 'OUTGOING',
        metadata: { not: null }
    },
    orderBy: { id: 'desc' },
    take: 10
  });
  
  if (logs.length === 0) {
    console.log("No 0-duration matching logs found");
    return;
  }
  
  console.log("--- 0-DURATION MATCHING LOGS ---");
  logs.forEach(log => {
      console.log(`ID: ${log.id} | By: ${log.disconnectedBy} | Metadata: ${log.metadata}`);
  });
}

main().finally(() => prisma.$disconnect());
