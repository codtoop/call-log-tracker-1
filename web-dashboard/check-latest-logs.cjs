const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const logs = await prisma.callLog.findMany({
    where: {
      metadata: { not: null }
    },
    orderBy: { timestamp: 'desc' },
    take: 10,
    include: { agent: true }
  });
  
  console.log('--- LATEST 10 LOGS WITH METADATA ---');
  logs.forEach(l => {
    const version = l.metadata ? (l.metadata.match(/VERSION: (v\d+_[a-zA-Z]+)/)?.[1] || 'Unknown Ver') : 'No Meta';
    console.log(`ID: ${l.id} | ${l.agent?.username} | ${l.type} | Version: ${version} | Time: ${l.timestamp}`);
  });
}

main().finally(() => prisma.$disconnect());
