const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const logs = await prisma.callLog.findMany({
    where: { 
        metadata: { contains: 'v11' }
    },
    orderBy: { id: 'desc' },
    take: 5
  });
  
  if (logs.length === 0) {
    console.log("No v11 logs found yet.");
    return;
  }
  
  console.log("--- RECENT v11 LOGS ---");
  logs.forEach(log => {
      console.log(`ID: ${log.id} | By: ${log.disconnectedBy} | Metadata Sample: ${log.metadata.substring(0, 200)}`);
  });
}

main().finally(() => prisma.$disconnect());
