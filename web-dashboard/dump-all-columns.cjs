const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const id = parseInt(process.argv[2]);
  const log = await prisma.callLog.findUnique({ where: { id } });
  
  if (!log || !log.metadata) {
    console.log("No metadata found for ID:", id);
    return;
  }
  
  console.log("--- FULL COLUMNS FOR ID:", id, "---");
  const lines = log.metadata.split('\n');
  lines.forEach(line => {
    if (line.trim() && (line.includes(':') || line.startsWith('---'))) {
        console.log(line);
    }
  });
}

main().finally(() => prisma.$disconnect());
