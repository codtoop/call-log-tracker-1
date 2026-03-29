const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    const count = await prisma.user.count();
    console.log('Database connected! User count:', count);
  } catch (err) {
    console.error('Database connection FAILED:', err.message);
    process.exit(1);
  }
}

main().finally(() => prisma.$disconnect());
