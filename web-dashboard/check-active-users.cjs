const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    orderBy: { lastSeen: 'desc' },
    take: 10
  });
  
  console.log("--- AGENT ACTIVITY (LAST 10) ---");
  users.forEach(u => {
    const time = u.lastSeen ? u.lastSeen.toLocaleString() : 'NEVER';
    console.log(`User: ${u.username.padEnd(10)} | Last Seen: ${time}`);
  });
}

main().finally(() => prisma.$disconnect());
