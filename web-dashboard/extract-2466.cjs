const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const log = await prisma.callLog.findUnique({
    where: { id: 2466 }
  });
  
  if (!log) {
    console.log("Log 2466 not found");
    return;
  }
  
  console.log("--- FULL METADATA FOR ID 2466 ---");
  console.log(log.metadata);
}

main().finally(() => prisma.$disconnect());
