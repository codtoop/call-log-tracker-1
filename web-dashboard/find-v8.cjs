const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const logs = await prisma.callLog.findMany({
    where: { metadata: { contains: 'v8_IntentExtras' } },
    orderBy: { id: 'desc' },
    take: 5
  });
  
  if (logs.length === 0) {
    console.log("No v8 logs yet.");
    return;
  }
  
  console.log("--- LATEST v8 LOGS ---");
  logs.forEach(log => {
      console.log(`ID: ${log.id} | Type: ${log.type} | Dur: ${log.duration} | By: ${log.disconnectedBy} | Time: ${new Date(Number(log.timestamp)).toLocaleString()}`);
  });
}

main().finally(() => prisma.$disconnect());
