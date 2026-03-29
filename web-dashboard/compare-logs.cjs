const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // 1:58:28 PM and 1:59:10 PM
  // These are roughly 1773925108000 range in timestamp (approx)
  // I'll just get the last 10 logs and match by approximate time
  
  const logs = await prisma.callLog.findMany({
    orderBy: { id: 'desc' },
    take: 10,
    include: { agent: true }
  });
  
  console.log("--- RECENT LOGS COMPARISON ---");
  logs.forEach(log => {
      const date = new Date(Number(log.timestamp));
      console.log(`ID: ${log.id} | Time: ${date.toLocaleString()} | By: ${log.disconnectedBy} | Metadata: ${log.metadata ? log.metadata.substring(0, 300) : 'NULL'}`);
  });
}

main().finally(() => prisma.$disconnect());
