const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const id = parseInt(process.argv[2]);
  const log = await prisma.callLog.findUnique({ where: { id } });
  
  if (!log || !log.metadata) {
    console.log("No metadata!");
    return;
  }
  
  const diagnosticStart = log.metadata.indexOf('--- COLUMN DIAGNOSTIC ---');
  if (diagnosticStart === -1) {
    console.log("No diagnostic footer!");
    return;
  }
  
  const diagnostic = log.metadata.substring(diagnosticStart);
  const keys = diagnostic.split('\n')
    .map(line => line.split(':')[0].trim())
    .filter(key => key && !key.startsWith('-'))
    .sort();
    
  console.log("--- COLUMN KEYS FOR ID:", id, "---");
  console.log(keys.join(', '));
}

main().finally(() => prisma.$disconnect());
