import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { comparePassword, signToken } from '@/lib/auth';

export async function POST(request: Request) {
    try {
        const data = await request.json();
        const { username, password } = data;

        if (!username || !password) {
            return NextResponse.json(
                { error: 'Username and password are required' },
                { status: 400 }
            );
        }

        const user = await prisma.user.findUnique({
            where: { username },
        });

        if (!user || !(await comparePassword(password, user.password))) {
            return NextResponse.json(
                { error: 'Invalid username or password' },
                { status: 401 }
            );
        }

        const token = signToken(user.id, user.role);

        // Mark agent as online immediately upon login
        await prisma.user.update({
            where: { id: user.id },
            data: { lastSeen: new Date() }
        });

        // Check for existing open login session to avoid fragmentation
        console.log(`Checking for open LoginSessions for user: ${user.username}`);
        const existingSession = await prisma.loginSession.findFirst({
            where: {
                agentId: user.id,
                endTime: null
            },
            orderBy: { startTime: 'desc' }
        });

        if (existingSession) {
            console.log(`Resuming existing LoginSession: ${existingSession.id}`);
        } else {
            console.log(`Creating fresh LoginSession for user: ${user.username} (${user.id})`);
            const loginSession = await prisma.loginSession.create({
                data: {
                    agentId: user.id,
                    startTime: new Date(),
                }
            });
            console.log(`Created LoginSession with ID: ${loginSession.id}`);
        }

        // Also create/update the activity session (AgentSession)
        console.log('Checking for recent activity session...');
        const now = new Date();
        const twoMinutesAgo = new Date(now.getTime() - 120000);
        const lastActivitySession = await prisma.agentSession.findFirst({
            where: { agentId: user.id },
            orderBy: { endTime: 'desc' }
        });

        if (lastActivitySession && lastActivitySession.endTime >= twoMinutesAgo) {
            await prisma.agentSession.update({
                where: { id: lastActivitySession.id },
                data: { endTime: now }
            });
        } else {
            await prisma.agentSession.create({
                data: {
                    agentId: user.id,
                    startTime: now,
                    endTime: now
                }
            });
        }

        return NextResponse.json({
            success: true,
            token,
            agentId: user.id,
            username: user.username,
            role: user.role,
        });
    } catch (error) {
        console.error('Login error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
