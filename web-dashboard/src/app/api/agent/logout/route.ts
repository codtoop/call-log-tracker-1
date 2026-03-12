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

        // Set lastSeen far in the past so agent immediately appears offline
        await prisma.user.update({
            where: { id: decoded.userId },
            data: { lastSeen: new Date(0) }
        });

        return NextResponse.json({ success: true, message: 'Logged out successfully' });
    } catch (error) {
        console.error('Agent logout error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
