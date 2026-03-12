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

        // Create a new login session
        await prisma.agentSession.create({
            data: {
                agentId: user.id,
                startTime: new Date(),
                endTime: new Date()
            }
        });

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
