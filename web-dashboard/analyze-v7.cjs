const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const logs = await prisma.callLog.findMany({
    where: {
      metadata: { contains: 'v7' },
      disconnectedBy: 'UNKNOWN'
    },
    orderBy: { timestamp: 'desc' },
    take: 10
  });
  
  console.log(`--- ANALYZING ${logs.length} UNKNOWN v7 LOGS ---`);
  logs.forEach(l => {
    console.log(`ID: ${l.id} | Type: ${l.type} | Dur: ${l.duration} | Phone: ${l.phoneNumber}`);
    if (l.metadata) {
       const lines = l.metadata.split('\n');
       const cause = lines.find(ln => ln.startsWith('disconnect_cause')) || 'no cause';
       const reason = lines.find(ln => ln.startsWith('disconnect_reason')) || 'no d_reason';
       const shortReason = lines.find(ln => ln.startsWith('reason:')) || 'no reason';
       console.log(`  Data: ${cause} | ${reason} | ${shortReason}`);
    }
  });
}

main().finally(() => prisma.$disconnect());
