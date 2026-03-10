import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function getAuthPayloadFromRequest(request: Request) {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
    const token = authHeader.split(' ')[1];
    return verifyToken(token);
}

export async function POST(request: Request) {
    try {
        const payload = getAuthPayloadFromRequest(request);
        if (!payload) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const userId = payload.userId;

        const data = await request.json();
        console.log("---- RECEIVED /api/logs POST ----");
        console.log(JSON.stringify(data, null, 2));

        const logsToProcess = Array.isArray(data) ? data : [data];

        if (logsToProcess.length === 0) {
            return NextResponse.json(
                { error: 'No logs provided' },
                { status: 400 }
            );
        }

        const validLogsData = [];
        for (const logItem of logsToProcess) {
            const { phoneNumber, type, duration, timestamp, ringingDuration } = logItem;
            if (!phoneNumber || !type || duration === undefined || !timestamp) {
                return NextResponse.json(
                    { error: 'Missing required fields in one or more logs' },
                    { status: 400 }
                );
            }
            validLogsData.push({
                phoneNumber,
                type,
                duration: typeof duration === 'string' ? parseInt(duration, 10) : duration,
                ringingDuration: typeof ringingDuration === 'string' ? parseInt(ringingDuration, 10) : (ringingDuration ?? 0),
                timestamp: new Date(timestamp),
                agentId: userId,
            });
        }

        if (validLogsData.length === 1) {
            const singleLog = validLogsData[0];
            try {
                const log = await prisma.callLog.create({
                    data: singleLog,
                    include: {
                        agent: {
                            select: { username: true }
                        }
                    }
                });
                return NextResponse.json({ success: true, log }, { status: 201 });
            } catch (error: any) {
                // Prisma error code P2002: Unique constraint failed
                if (error.code === 'P2002') {
                    // Gracefully ignore duplicate
                    return NextResponse.json({ success: true, log: singleLog, duplicate: true }, { status: 200 });
                }
                throw error;
            }
        } else {
            // 1st pass: deduplicate within the batch itself using a memory Set
            const seen = new Set<string>();
            const deduplicatedBatch = validLogsData.filter(log => {
                // Round to nearest 10s to catch timestamp drift
                const roundedTs = Math.round(log.timestamp.getTime() / 10000);
                const key = `${log.phoneNumber}|${log.type}|${log.agentId}|${roundedTs}`;
                if (seen.has(key)) return false;
                seen.add(key);
                return true;
            });

            // In PostgreSQL, createMany with skipDuplicates: true allows atomic insertion
            // of the entire batch while silently ignoring rows that violate the @@unique constraint
            if (deduplicatedBatch.length > 0) {
                const result = await prisma.callLog.createMany({
                    data: deduplicatedBatch,
                    skipDuplicates: true, // Native Postgres ON CONFLICT DO NOTHING
                });
                return NextResponse.json({ success: true, count: result.count, batch: true }, { status: 201 });
            } else {
                return NextResponse.json({ success: true, count: 0, batch: true, duplicates: validLogsData.length }, { status: 200 });
            }
        }
    } catch (error) {
        console.error('Failed to create call log:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const page = parseInt(searchParams.get('page') || '1', 10);
        const limit = parseInt(searchParams.get('limit') || '10', 10);
        let agentId = searchParams.get('agentId');

        // Parse date filters, defaulting to last 24 hours if completely omitted
        let startDate = searchParams.get('startDate');
        let endDate = searchParams.get('endDate');
        let phoneNumber = searchParams.get('phoneNumber');

        const payload = getAuthPayloadFromRequest(request);
        if (!payload) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (payload.role !== 'ADMIN') {
            // Force agents to only view their own logs
            agentId = payload.userId;
        }

        const skip = (page - 1) * limit;

        // Build Prisma where clause
        const whereClause: any = {};
        if (agentId) {
            whereClause.agentId = agentId;
        }
        if (phoneNumber) {
            whereClause.phoneNumber = { contains: phoneNumber };
        }

        if (startDate || endDate) {
            whereClause.timestamp = {};
            if (startDate) {
                // Ensure we start at the very beginning of the start date in UTC
                const startObj = new Date(`${startDate}T00:00:00.000Z`);
                whereClause.timestamp.gte = startObj;
            }
            if (endDate) {
                // Ensure we end at the very end of the end date in UTC
                const endObj = new Date(`${endDate}T23:59:59.999Z`);
                whereClause.timestamp.lte = endObj;
            }
        } else {
            // Default to last 24 hours if no dates provided at all
            const defaultStart = new Date();
            defaultStart.setHours(defaultStart.getHours() - 24);
            whereClause.timestamp = { gte: defaultStart };
        }

        const [logs, totalLogs, allFilteredLogs] = await Promise.all([
            prisma.callLog.findMany({
                where: whereClause,
                orderBy: { timestamp: 'desc' },
                skip,
                take: limit,
                include: {
                    agent: {
                        select: { username: true }
                    }
                }
            }),
            prisma.callLog.count({ where: whereClause }),
            // Fetch a lightweight unpaginated list of ALL filtered logs for strictly accurate Graph and Stats rendering
            prisma.callLog.findMany({
                where: whereClause,
                select: {
                    type: true,
                    duration: true,
                    ringingDuration: true,
                    timestamp: true,
                    phoneNumber: true,
                    agentId: true
                },
                orderBy: { timestamp: 'asc' }
            })
        ]);

        const totalPages = Math.max(1, Math.ceil(totalLogs / limit));

        const response = NextResponse.json({ success: true, logs, totalLogs, totalPages, page, limit, allFilteredLogs });
        response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        response.headers.set('Pragma', 'no-cache');
        response.headers.set('Expires', '0');
        return response;
    } catch (error) {
        console.error('Failed to fetch call logs:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
