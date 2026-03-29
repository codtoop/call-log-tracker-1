const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const logs = await prisma.callLog.findMany({
    orderBy: { id: 'asc' },
    take: 10
  });
  
  console.log("--- OLDEST LOGS METADATA ---");
  logs.forEach(log => {
      console.log(`ID: ${log.id} | Metadata: ${log.metadata ? log.metadata.substring(0, 50) : 'NULL'}`);
  });
}

main().finally(() => prisma.$disconnect());
