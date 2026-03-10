import React, { useMemo } from 'react';

interface CallStatisticsProps {
    logs: any[];
}

export default function CallStatistics({ logs }: CallStatisticsProps) {
    const stats = useMemo(() => {
        // 1. Core Data Extraction
        let totalDurationSeconds = 0;
        const typeStats = {
            INCOMING: { count: 0, duration: 0 },
            MISSED: { count: 0, duration: 0 },
            OUTGOING: { count: 0, duration: 0 },
        };

        const uniqueDaysSet = new Set<string>();
        let firstCallTimestamp: number | null = null;
        let lastCallTimestamp: number | null = null;

        logs.forEach(log => {
            // Aggregate Totals
            totalDurationSeconds += log.duration;

            // Distinct Days for "No Call Time" math
            const logDate = new Date(log.timestamp).toISOString().split('T')[0];
            uniqueDaysSet.add(logDate);

            // Aggregate By Type
            if (typeStats[log.type as keyof typeof typeStats]) {
                typeStats[log.type as keyof typeof typeStats].count += 1;
                typeStats[log.type as keyof typeof typeStats].duration += log.duration;
            }

            // Track First and Last Call in the 07:00 to 22:00 window (07:00:00 - 21:59:59)
            const logDateObj = new Date(log.timestamp);
            const hour = logDateObj.getHours();

            if (hour >= 7 && hour < 22) {
                const ts = logDateObj.getTime();
                if (firstCallTimestamp === null || ts < firstCallTimestamp) {
                    firstCallTimestamp = ts;
                }
                if (lastCallTimestamp === null || ts > lastCallTimestamp) {
                    lastCallTimestamp = ts;
                }
            }
        });

        const totalCalls = logs.length;
        const avgDurationSeconds = totalCalls > 0 ? Math.floor(totalDurationSeconds / totalCalls) : 0;
        const uniqueDaysCount = uniqueDaysSet.size;

        // No Call Time = Total days in dataset * 6hrs - duration. Or 0 if no logs.
        const totalPossibleSeconds = uniqueDaysCount * 6 * 60 * 60;
        const noCallTimeSeconds = totalPossibleSeconds > 0 ? Math.max(0, totalPossibleSeconds - totalDurationSeconds) : 0;

        // Helper to format SS to HHh MMm SSs
        const formatDuration = (totalSeconds: number) => {
            if (totalSeconds === 0) return '00h 00m 00s';
            const h = Math.floor(totalSeconds / 3600);
            const m = Math.floor((totalSeconds % 3600) / 60);
            const s = totalSeconds % 60;
            return `${h.toString().padStart(2, '0')}h ${m.toString().padStart(2, '0')}m ${s.toString().padStart(2, '0')}s`;
        };

        // Calculate averages per type
        const incomingAvg = typeStats.INCOMING.count > 0 ? Math.floor(typeStats.INCOMING.duration / typeStats.INCOMING.count) : 0;
        const missedAvg = typeStats.MISSED.count > 0 ? Math.floor(typeStats.MISSED.duration / typeStats.MISSED.count) : 0;
        const outgoingAvg = typeStats.OUTGOING.count > 0 ? Math.floor(typeStats.OUTGOING.duration / typeStats.OUTGOING.count) : 0;

        const formatTimeOnly = (ts: number | null) => {
            if (!ts) return 'N/A';
            return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        };

        return {
            totalCalls,
            totalDurationText: formatDuration(totalDurationSeconds),
            avgDurationText: formatDuration(avgDurationSeconds),
            noCallTimeText: formatDuration(noCallTimeSeconds),
            firstCallText: formatTimeOnly(firstCallTimestamp),
            lastCallText: formatTimeOnly(lastCallTimestamp),
            typeData: [
                {
                    type: 'INCOMING',
                    count: typeStats.INCOMING.count,
                    durationText: formatDuration(typeStats.INCOMING.duration),
                    avgText: formatDuration(incomingAvg)
                },
                {
                    type: 'MISSED',
                    count: typeStats.MISSED.count,
                    durationText: formatDuration(typeStats.MISSED.duration),
                    avgText: formatDuration(missedAvg)
                },
                {
                    type: 'OUTGOING',
                    count: typeStats.OUTGOING.count,
                    durationText: formatDuration(typeStats.OUTGOING.duration),
                    avgText: formatDuration(outgoingAvg)
                },
            ]
        };
    }, [logs]);

    if (logs.length === 0) return null;

    return (
        <div className="mb-8">
            <div className="flex items-center space-x-2 mb-4">
                <span className="text-xl">📊</span>
                <h2 className="text-xl font-semibold text-white">Call Statistics</h2>
            </div>

            <div className="bg-[#111319] rounded-lg border border-gray-800 p-6 shadow-xl">
                {/* Tab Header (Only By Call Type needed based on latest request, but keeping the styling match) */}
                <div className="flex border-b border-gray-800 mb-6">
                    <div className="px-4 py-2 border-b-2 border-red-500 text-red-500 font-medium text-sm flex items-center space-x-2">
                        <span>📱</span>
                        <span>By Call Type</span>
                    </div>
                </div>

                {/* Data Table */}
                <div className="mb-8">
                    <h3 className="text-sm font-semibold text-gray-200 mb-4">By Call Type</h3>
                    <div className="overflow-x-auto rounded-lg border border-gray-800">
                        <table className="min-w-full divide-y divide-gray-800 text-sm">
                            <thead className="bg-[#1a1c23]">
                                <tr>
                                    <th className="px-6 py-3 text-left font-medium text-gray-400 uppercase tracking-wider">Call Type</th>
                                    <th className="px-6 py-3 text-right font-medium text-gray-400 uppercase tracking-wider">Total Calls</th>
                                    <th className="px-6 py-3 text-right font-medium text-gray-400 uppercase tracking-wider">Total Duration</th>
                                    <th className="px-6 py-3 text-right font-medium text-gray-400 uppercase tracking-wider">Avg Duration</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-800 bg-[#111319]">
                                {stats.typeData.map((row) => (
                                    <tr key={row.type}>
                                        <td className="px-6 py-4 whitespace-nowrap text-gray-300 font-medium">{row.type}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-gray-300 text-right">{row.count}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-gray-300 text-right font-mono">{row.durationText}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-gray-300 text-right font-mono">{row.avgText}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Total Across All Types Cards */}
                <div>
                    <h3 className="text-sm font-semibold text-gray-200 mb-4">Total Across All Types</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

                        {/* Total Calls */}
                        <div>
                            <div className="text-xs text-gray-400 mb-1 flex items-center space-x-1">
                                <span className="text-red-500">📞</span>
                                <span>Total Calls</span>
                            </div>
                            <div className="text-3xl text-white font-medium">
                                {stats.totalCalls}
                            </div>
                        </div>

                        {/* Total Call Time */}
                        <div>
                            <div className="text-xs text-gray-400 mb-1 flex items-center space-x-1">
                                <span className="text-gray-300">⏱️</span>
                                <span>Total Call Time</span>
                            </div>
                            <div className="text-3xl text-white font-medium font-mono">
                                {stats.totalDurationText}
                            </div>
                        </div>

                        {/* Avg Duration */}
                        <div>
                            <div className="text-xs text-gray-400 mb-1 flex items-center space-x-1">
                                <span className="text-yellow-500">📊</span>
                                <span>Avg Duration (All)</span>
                            </div>
                            <div className="text-3xl text-white font-medium font-mono">
                                {stats.avgDurationText}
                            </div>
                        </div>

                        {/* No Call Time */}
                        <div>
                            <div className="text-xs text-gray-400 mb-1 flex items-center space-x-1">
                                <span className="text-red-500">🔇</span>
                                <span>No Call Time</span>
                            </div>
                            <div className="text-3xl text-white font-medium font-mono">
                                {stats.noCallTimeText}
                            </div>
                        </div>

                        {/* First Call (7-22) */}
                        <div>
                            <div className="text-xs text-gray-400 mb-1 flex items-center space-x-1">
                                <span className="text-green-500">🌅</span>
                                <span>First Call (7h-22h)</span>
                            </div>
                            <div className="text-3xl text-white font-medium font-mono">
                                {stats.firstCallText}
                            </div>
                        </div>

                        {/* Last Call (7-22) */}
                        <div>
                            <div className="text-xs text-gray-400 mb-1 flex items-center space-x-1">
                                <span className="text-purple-500">🌇</span>
                                <span>Last Call (7h-22h)</span>
                            </div>
                            <div className="text-3xl text-white font-medium font-mono">
                                {stats.lastCallText}
                            </div>
                        </div>

                    </div>
                </div>

            </div>
        </div>
    );
}
