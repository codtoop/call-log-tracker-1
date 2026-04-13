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

        if (!decoded) {
            return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
        }

        // Update the lastSeen field for the user
        const now = new Date();
        await prisma.user.update({
            where: { id: decoded.userId },
            data: { lastSeen: now },
        });

        // Manage AgentSession (Activity)
        const strictThreshold = new Date(now.getTime() - 40000); // 40 seconds
        const lastActivitySession = await prisma.agentSession.findFirst({
            where: { agentId: decoded.userId },
            orderBy: { endTime: 'desc' }
        });

        if (lastActivitySession && lastActivitySession.endTime >= strictThreshold) {
            await prisma.agentSession.update({
                where: { id: lastActivitySession.id },
                data: { endTime: now }
            });
        } else {
            await prisma.agentSession.create({
                data: {
                    agentId: decoded.userId,
                    startTime: now,
                    endTime: now
                }
            });
        }

        return NextResponse.json({ success: true, message: 'Heartbeat received' });
    } catch (error) {
        console.error('Heartbeat error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
