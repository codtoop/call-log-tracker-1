
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function mergeSessions() {
  console.log('Merging fragmented LoginSessions...');
  try {
    const users = await prisma.user.findMany();
    
    for (const user of users) {
      console.log(`Processing user: ${user.username}`);
      
      const sessions = await prisma.loginSession.findMany({
        where: { agentId: user.id },
        orderBy: { startTime: 'asc' }
      });
      
      if (sessions.length <= 1) continue;
      
      const merged = [];
      let current = { ...sessions[0] };
      
      for (let i = 1; i < sessions.length; i++) {
        const next = sessions[i];
        
        // If the gap between end of current and start of next is less than 12 hours, merge them
        const gap = next.startTime.getTime() - (current.endTime ? current.endTime.getTime() : current.startTime.getTime());
        
        if (gap < 12 * 60 * 60 * 1000) {
          // Merge
          console.log(`  Merging session ${current.id} with ${next.id} (Gap: ${Math.round(gap/60000)}m)`);
          current.endTime = next.endTime;
          // Delete the next one as it's now merged into current
          await prisma.loginSession.delete({ where: { id: next.id } });
          // Update the current one in DB later or now
        } else {
          // Gap too large, finalize current and move to next
          merged.push(current);
          current = { ...next };
        }
      }
      merged.push(current);
      
      // Update the finalized merged sessions in DB
      for (const s of merged) {
        await prisma.loginSession.update({
          where: { id: s.id },
          data: { 
            startTime: s.startTime,
            endTime: s.endTime 
          }
        });
      }
    }
    
    console.log('Merging completed successfully.');
  } catch (err) {
    console.error('Merging failed:', err.message);
  } finally {
    await prisma.$disconnect();
  }
}

mergeSessions();
