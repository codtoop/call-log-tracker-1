const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    console.log('Fetching raw data from "CallLog" table...');
    const result = await prisma.$queryRawUnsafe(`
      SELECT id, "phoneNumber", type, duration, "timestamp", "disconnectedBy", metadata, "createdAt"
      FROM "CallLog"
      ORDER BY "createdAt" DESC
      LIMIT 5
    `);
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('Error fetching raw data:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
