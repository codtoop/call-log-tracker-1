import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const authHeader = request.headers.get('Authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const token = authHeader.split(' ')[1];
        const decoded = verifyToken(token);
        console.log(`[SessionsAPI] Decoded token:`, JSON.stringify(decoded));

        if (!decoded || decoded.role !== 'ADMIN') {
            console.log(`[SessionsAPI] Role check failed. Role is: ${decoded?.role}`);
            return NextResponse.json({ error: 'Forbidden: Admins only' }, { status: 403 });
        }

        const { id: agentId } = await params;
        console.log(`[SessionsAPI] Fetching sessions for agent: ${agentId}`);

        const fetchWithRetry = async (queryFn: () => Promise<any>, retries = 2) => {
            for (let i = 0; i <= retries; i++) {
                try {
                    return await queryFn();
                } catch (e: any) {
                    if (i === retries) throw e;
                    console.warn(`[SessionsAPI] Query failed, retrying (${i + 1}/${retries})...`, e.message);
                    await new Promise(r => setTimeout(r, 500));
                }
            }
        };

        const fetchActivity = () => fetchWithRetry(() => prisma.agentSession.findMany({
            where: { agentId },
            orderBy: { startTime: 'desc' },
            take: 100
        }));

        const fetchLogin = () => fetchWithRetry(() => prisma.loginSession.findMany({
            where: { agentId },
            orderBy: { startTime: 'desc' },
            take: 100
        }));

        const [activitySessions, loginSessions] = await Promise.all([
            fetchActivity(),
            fetchLogin()
        ]);

        console.log(`[SessionsAPI] Found ${activitySessions?.length || 0} activity sessions and ${loginSessions?.length || 0} login sessions`);

        return NextResponse.json({ 
            success: true, 
            sessions: activitySessions || [],
            loginSessions: loginSessions || []
        });
    } catch (error: any) {
        console.error('[SessionsAPI] Global error:', error.message || error);
        return NextResponse.json(
            { error: 'Internal server error', details: error.message },
            { status: 500 }
        );
    }
}
