import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import bcrypt from 'bcryptjs';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(request: Request) {
    try {
        const appSecret = request.headers.get('x-app-secret');
        if (appSecret !== 'daily_sync_app_secret_12345') {
            return NextResponse.json({ error: 'Unauthorized origin' }, { status: 401 });
        }

        const rawBody = await request.text();
        const data = JSON.parse(rawBody);

        const logsToProcess = Array.isArray(data) ? data : [data];

        if (logsToProcess.length === 0) {
            return NextResponse.json(
                { error: 'No logs provided' },
                { status: 400 }
            );
        }

        // 1. Ensure the "unknown_agent" exists in the database
        let unknownAgent = await prisma.user.findUnique({
            where: { username: 'unknown_agent' }
        });

        if (!unknownAgent) {
            const hashedPassword = await bcrypt.hash('unknown_agent_random_pass_123', 10);
            unknownAgent = await prisma.user.create({
                data: {
                    username: 'unknown_agent',
                    password: hashedPassword,
                    role: 'AGENT'
                }
            });
        }

        const validLogsData = [];
        for (const logItem of logsToProcess) {
            const { phoneNumber, type, duration, timestamp, ringingDuration, disconnectedBy, metadata } = logItem;
            if (!phoneNumber || !type || duration === undefined || !timestamp) {
                continue; // Skip malformed logs instead of failing the entire batch
            }
            validLogsData.push({
                phoneNumber,
                type,
                duration: typeof duration === 'string' ? parseInt(duration, 10) : duration,
                ringingDuration: typeof ringingDuration === 'string' ? parseInt(ringingDuration, 10) : (ringingDuration ?? 0),
                timestamp: new Date(timestamp),
                agentId: unknownAgent.id,
                disconnectedBy: disconnectedBy || "UNKNOWN",
                metadata: metadata ? String(metadata) : null,
            });
        }

        // 2. Filter out duplicates that ANY agent already uploaded
        const trulyMissingLogs = [];
        for (const log of validLogsData) {
            // Give a 10-second plus/minus buffer to account for minor timestamp drift between phone and server
            const tenSecondsBefore = new Date(log.timestamp.getTime() - 10000);
            const tenSecondsAfter = new Date(log.timestamp.getTime() + 10000);

            const existing = await prisma.callLog.findFirst({
                where: {
                    phoneNumber: log.phoneNumber,
                    type: log.type,
                    timestamp: {
                        gte: tenSecondsBefore,
                        lte: tenSecondsAfter
                    }
                }
            });

            if (!existing) {
                trulyMissingLogs.push(log);
            }
        }

        // 3. Insert the newly found genuinely missing logs
        if (trulyMissingLogs.length > 0) {
            const result = await prisma.callLog.createMany({
                data: trulyMissingLogs,
                skipDuplicates: true, // Secondary failsafe on constraint violation
            });
            return NextResponse.json({ success: true, count: result.count, batch: true }, { status: 201 });
        } else {
            return NextResponse.json({ success: true, count: 0, batch: true, message: 'All logs were already synced' }, { status: 200 });
        }

    } catch (error) {
        console.error('Failed to process custom daily sync:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
