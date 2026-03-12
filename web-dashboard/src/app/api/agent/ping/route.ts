import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';

export async function POST(request: Request) {
    try {
        const authHeader = request.headers.get('Authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const token = authHeader.split(' ')[1];
        const decoded = verifyToken(token);

        if (!decoded || !decoded.userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // 1. Update the agent's lastSeen timestamp
        await prisma.user.update({
            where: { id: decoded.userId },
            data: { lastSeen: new Date() }
        });

        // 2. Manage the agent's session history
        const now = new Date();
        const twoMinutesAgo = new Date(now.getTime() - 120000); // 2 minutes in milliseconds

        // Find the most recent session for this agent
        const lastSession = await prisma.agentSession.findFirst({
            where: { agentId: decoded.userId },
            orderBy: { endTime: 'desc' }
        });

        if (lastSession && lastSession.endTime >= twoMinutesAgo) {
            // The agent pinged within the last 2 minutes, so this is still the same session.
            // Extend the active session's endTime to now.
            await prisma.agentSession.update({
                where: { id: lastSession.id },
                data: { endTime: now }
            });
        } else {
            // The agent's last ping was more than 2 minutes ago OR they have no sessions.
            // This is a new session!
            await prisma.agentSession.create({
                data: {
                    agentId: decoded.userId,
                    startTime: now,
                    endTime: now
                }
            });
        }

        return NextResponse.json({ success: true, message: 'Status and session updated' });
    } catch (error) {
        console.error('Agent ping error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
