const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const number = "0779199496";
    console.log(`Deleting all call logs for phone number: ${number}`);

    try {
        const result = await prisma.callLog.deleteMany({
            where: {
                phoneNumber: number
            }
        });

        console.log(`Successfully deleted ${result.count} logs for ${number} from the database.`);
    } catch (e) {
        console.error("Error deleting logs:", e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
