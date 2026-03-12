const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: "postgresql://postgres.jbfuctzueybopaltwxmm:%21XG2QkV4NKvMgq4@aws-1-eu-central-1.pooler.supabase.com:6543/postgres"
    }
  }
});

async function main() {
  try {
    const users = await prisma.user.findMany({
      select: {
        username: true,
        lastSeen: true
      }
    });
    
    const now = new Date();
    console.log('Current server time:', now.toISOString());
    console.log('\nUsers Status:');
    
    users.forEach(u => {
      const diffMs = now.getTime() - new Date(u.lastSeen).getTime();
      const diffSec = Math.floor(diffMs / 1000);
      const isOnline = diffMs < 120000;
      console.log(`${u.username.padEnd(20)} | Last Seen: ${u.lastSeen.toISOString()} | ${diffSec}s ago | ${isOnline ? 'ONLINE' : 'OFFLINE'}`);
    });

  } catch (err) {
    console.error('Check failed:', err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
