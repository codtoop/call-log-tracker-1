const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const startDate = "2026-03-07";
    const endDate = "2026-03-08";

    const whereClause = {};
    if (startDate || endDate) {
        whereClause.timestamp = {};
        if (startDate) {
            const startObj = new Date(`${startDate}T00:00:00.000Z`);
            whereClause.timestamp.gte = startObj;
        }
        if (endDate) {
            const endObj = new Date(`${endDate}T23:59:59.999Z`);
            whereClause.timestamp.lte = endObj;
        }
    }

    console.log("Where:", JSON.stringify(whereClause, null, 2));

    const count = await prisma.callLog.count({ where: whereClause });
    console.log("Count for date range:", count);

    const logs = await prisma.callLog.findMany({
        where: whereClause,
        orderBy: { timestamp: 'desc' },
        take: 2,
    });
    console.log("Logs:", JSON.stringify(logs, null, 2));
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
