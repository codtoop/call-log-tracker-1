import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import bcrypt from 'bcryptjs';

export async function POST(request: Request) {
    try {
        const authHeader = request.headers.get('Authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const token = authHeader.split(' ')[1];
        const decoded = verifyToken(token);

        if (!decoded || decoded.role !== 'ADMIN') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const data = await request.json();
        const { username, password } = data;

        if (!username || !password) {
            return NextResponse.json(
                { error: 'Username and password are required' },
                { status: 400 }
            );
        }

        const existingAgent = await prisma.user.findUnique({
            where: { username },
        });

        if (existingAgent) {
            return NextResponse.json(
                { error: `Agent with username "${username}" already exists.` },
                { status: 409 }
            );
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const newAgent = await prisma.user.create({
            data: {
                username,
                password: hashedPassword,
            },
        });

        return NextResponse.json({
            success: true,
            agentId: newAgent.id,
            username: newAgent.username,
        }, { status: 201 });
    } catch (error) {
        console.error('Agent creation error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

export async function GET(request: Request) {
    try {
        const authHeader = request.headers.get('Authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const token = authHeader.split(' ')[1];
        const decoded = verifyToken(token);

        if (!decoded || decoded.role !== 'ADMIN') {
            return NextResponse.json({ error: 'Forbidden: Admins only' }, { status: 403 });
        }

        const agents = await prisma.user.findMany({
            select: {
                id: true,
                username: true,
                createdAt: true,
                lastSeen: true,
            },
            orderBy: {
                username: 'asc',
            },
        });

        return NextResponse.json({ success: true, agents });
    } catch (error) {
        console.error('Failed to fetch agents:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
