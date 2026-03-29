const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const logs = await prisma.callLog.findMany({
    where: { id: { in: [2480, 2481] } },
    orderBy: { id: 'asc' }
  });
  
  console.log(JSON.stringify(logs, null, 2));
}

main().finally(() => prisma.$disconnect());
