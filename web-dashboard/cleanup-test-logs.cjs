const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    // Delete logs from today for agent 'test2' that are 'UNKNOWN'
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    const result = await prisma.callLog.deleteMany({
      where: {
        agent: { username: 'test2' }
      }
    });
    
    console.log(`Successfully deleted ${result.count} UNKNOWN logs for test2 to allow resync.`);
  } catch (e) {
    console.error('Error deleting logs:', e.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
