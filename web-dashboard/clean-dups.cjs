const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const allLogs = await prisma.callLog.findMany({
        orderBy: { id: 'asc' } // Keep the oldest log
    });

    console.log(`Checking ${allLogs.length} total logs for exact duplicates...`);

    const seen = new Set();
    const duplicateIds = [];

    for (const log of allLogs) {
        const key = `${log.agentId}|${log.phoneNumber}|${log.type}|${log.timestamp.toISOString()}`;
        if (seen.has(key)) {
            duplicateIds.push(log.id);
        } else {
            seen.add(key);
        }
    }

    console.log(`Found ${duplicateIds.length} exact duplicates.`);

    if (duplicateIds.length > 0) {
        console.log('Deleting duplicates...');
        const result = await prisma.callLog.deleteMany({
            where: {
                id: { in: duplicateIds }
            }
        });
        console.log(`Deleted ${result.count} duplicates.`);
    }
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
