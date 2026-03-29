const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const logs = await prisma.callLog.findMany({
    orderBy: { timestamp: 'desc' },
    take: 5
  });
  
  if (logs.length === 0) {
    console.log("No logs found.");
    return;
  }
  
  console.log("--- LATEST 5 LOGS ---");
  logs.forEach(log => {
      const version = log.metadata?.match(/VERSION: ([^\s-]+)/)?.[1] || "OLD";
      console.log(`ID: ${log.id} | Type: ${log.type} | Dur: ${log.duration} | By: ${log.disconnectedBy} | Ver: ${version} | Time: ${new Date(Number(log.timestamp)).toLocaleString()}`);
  });
}

main().finally(() => prisma.$disconnect());
