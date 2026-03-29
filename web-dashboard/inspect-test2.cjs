const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findUnique({ where: { username: 'test2' } });
  if (!user) {
    console.log("User 'test2' not found");
    return;
  }
  
  const lastLog = await prisma.callLog.findFirst({
    where: { agentId: user.id },
    orderBy: { id: 'desc' }
  });
  
  if (!lastLog) {
    console.log("No logs found for test2");
    return;
  }
  
  console.log("--- LAST LOG FOR test2 ---");
  console.log(`ID: ${lastLog.id}`);
  console.log(`Type: ${lastLog.type}`);
  console.log(`Duration: ${lastLog.duration}`);
  console.log(`By: ${lastLog.disconnectedBy}`);
  console.log(`Metadata: ${lastLog.metadata}`);
}

main().finally(() => prisma.$disconnect());
