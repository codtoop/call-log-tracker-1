const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const id = parseInt(process.argv[2]);
  const log = await prisma.callLog.findUnique({ where: { id } });
  const lines = log.metadata.split('\n');
  const diagnosticLines = lines.filter(ln => ln.includes(':') && !ln.startsWith('---'));
  const keys = diagnosticLines.map(ln => ln.split(':')[0].trim());
  console.log(keys.sort().join('\n'));
}

main().finally(() => prisma.$disconnect());
