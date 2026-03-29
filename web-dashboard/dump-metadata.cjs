const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const id = parseInt(process.argv[2]);
  if (isNaN(id)) {
    console.error('Usage: node dump-metadata.cjs <id>');
    process.exit(1);
  }
  
  try {
    const log = await prisma.callLog.findUnique({
      where: { id },
      select: { metadata: true }
    });
    
    if (log && log.metadata) {
      console.log('--- METADATA START ---');
      console.log(log.metadata);
      console.log('--- METADATA END ---');
    } else {
      console.log('No metadata found for ID:', id);
    }
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
