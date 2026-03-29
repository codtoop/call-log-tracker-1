const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const log = await prisma.callLog.findUnique({
    where: { id: 2481 }
  });
  
  if (!log) {
    console.log("Log 2481 not found");
    return;
  }
  
  console.log("--- FULL DETAIL FOR ID 2481 ---");
  console.log(`ID: ${log.id}`);
  console.log(`By: '${log.disconnectedBy}'`); // Quote to see whitespace/exact value
  console.log(`Metadata: ${log.metadata}`);
}

main().finally(() => prisma.$disconnect());
