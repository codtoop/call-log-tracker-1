const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const agents = await prisma.user.findMany({ take: 3 });
  for (const agent of agents) {
    await prisma.user.update({
      where: { id: agent.id },
      data: { lastSeen: new Date() }
    });
    console.log(`Set ${agent.username} to online.`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
