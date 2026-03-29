
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function backfill() {
  console.log('Starting backfill of LoginSessions from AgentSessions...');
  try {
    const users = await prisma.user.findMany();
    
    for (const user of users) {
      console.log(`Processing user: ${user.username}`);
      
      const activitySessions = await prisma.agentSession.findMany({
        where: { agentId: user.id },
        orderBy: { startTime: 'asc' }
      });
      
      if (activitySessions.length === 0) continue;
      
      console.log(`  Found ${activitySessions.length} activity sessions.`);
      
      let currentLoginStart = activitySessions[0].startTime;
      let currentLoginEnd = activitySessions[0].endTime;
      
      for (let i = 1; i < activitySessions.length; i++) {
        const nextSession = activitySessions[i];
        
        // If the gap between end of current and start of next is less than 30 mins, treat as same login session
        const gap = nextSession.startTime.getTime() - currentLoginEnd.getTime();
        if (gap < 30 * 60 * 1000) {
          currentLoginEnd = nextSession.endTime;
        } else {
          // Gap too large, save the completed session and start a new one
          await saveLoginSession(user.id, currentLoginStart, currentLoginEnd);
          currentLoginStart = nextSession.startTime;
          currentLoginEnd = nextSession.endTime;
        }
      }
      
      // Save the last one
      await saveLoginSession(user.id, currentLoginStart, currentLoginEnd);
    }
    
    console.log('Backfill completed successfully.');
  } catch (err) {
    console.error('Backfill failed:', err.message);
  } finally {
    await prisma.$disconnect();
  }
}

async function saveLoginSession(agentId, start, end) {
  // Check if a similar session already exists to avoid duplicates
  const existing = await prisma.loginSession.findFirst({
    where: {
      agentId,
      startTime: { gte: new Date(start.getTime() - 1000), lte: new Date(start.getTime() + 1000) }
    }
  });
  
  if (!existing) {
    await prisma.loginSession.create({
      data: {
        agentId,
        startTime: start,
        endTime: end
      }
    });
    console.log(`    Created LoginSession: ${start.toISOString()} -> ${end.toISOString()}`);
  }
}

backfill();
