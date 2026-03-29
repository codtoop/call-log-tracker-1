const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    console.log('Adding "metadata" column to CallLog table if not exists...');
    await prisma.$executeRawUnsafe(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                       WHERE table_name='CallLog' AND column_name='metadata') THEN
          ALTER TABLE "CallLog" ADD COLUMN "metadata" TEXT;
        END IF;
      END
      $$;
    `);
    console.log('Column "metadata" successfully checked/added!');
  } catch (error) {
    console.error('Error adding column:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
