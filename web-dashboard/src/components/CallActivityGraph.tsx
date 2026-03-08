'use client';

import React, { useMemo, useState } from 'react';
import dynamic from 'next/dynamic';

// Dynamically import ApexCharts to avoid Next.js SSR "window is not defined" issues
const Chart = dynamic(() => import('react-apexcharts'), { ssr: false });

interface CallActivityGraphProps {
    logs: any[];
    currentDateLimit?: string; // Optional: helps to show the title "Call Activity for YYYY-MM-DD"
}

export default function CallActivityGraph({ logs, currentDateLimit }: CallActivityGraphProps) {
    const [copiedNumber, setCopiedNumber] = useState<string | null>(null);

    const chartData = useMemo(() => {
        // We want three series: INCOMING, OUTGOING, MISSED
        // Each series is an array of data points: { x: timestamp (number), y: 1 }

        const incomingData: { x: number; y: number; meta: any }[] = [];
        const outgoingData: { x: number; y: number; meta: any }[] = [];
        const incomingRinging: { x: number; y: number; meta: any }[] = [];
        const incomingTalk: { x: number; y: number; meta: any }[] = [];
        const outgoingRinging: { x: number; y: number; meta: any }[] = [];
        const outgoingTalk: { x: number; y: number; meta: any }[] = [];
        const missedRinging: { x: number; y: number; meta: any }[] = [];

        logs.forEach((log) => {
            const timestamp = new Date(log.timestamp).getTime();

            // For a timeline graph, we want each event to be represented by a bar of fixed height (y=1).
            // If a call has both ringing and talking phases, we'll represent them as two stacked bars
            // at the same timestamp, each with y=1. This means the total height for that timestamp will be 2.
            // The actual duration information will be in the tooltip.

            // Ringing phase
            if (log.ringingDuration > 0 && log.type !== 'MISSED') { // Missed calls don't have a separate 'ringing' bar, they are just 'missed'
                incomingRinging.push({
                    x: timestamp,
                    y: 1,
                    meta: {
                        ...log,
                        phase: 'Ringing',
                        duration: log.ringingDuration,
                        // Adjust timestamp for ringing phase if needed, or keep original for alignment
                    }
                });
            }

            // Talking phase (or the main event for missed calls)
            if (log.type === 'INCOMING' && log.duration > 0) {
                incomingTalk.push({
                    x: timestamp,
                    y: 1,
                    meta: {
                        ...log,
                        phase: 'Talking',
                        // For talking, the duration is the call duration itself
                    }
                });
            } else if (log.type === 'OUTGOING' && log.duration > 0) {
                outgoingTalk.push({
                    x: timestamp,
                    y: 1,
                    meta: {
                        ...log,
                        phase: 'Talking',
                    }
                });
            } else if (log.type === 'MISSED') {
                missedRinging.push({ // Renamed to missedRinging for consistency, but represents the missed event
                    x: timestamp,
                    y: 1,
                    meta: {
                        ...log,
                        phase: 'Missed',
                        duration: log.ringingDuration || 0, // Missed calls might have a ringing duration
                    }
                });
            }
        });

        // Sort data points chronologically for ApexCharts
        incomingRinging.sort((a, b) => a.x - b.x);
        incomingTalk.sort((a, b) => a.x - b.x);
        outgoingRinging.sort((a, b) => a.x - b.x);
        outgoingTalk.sort((a, b) => a.x - b.x);
        missedRinging.sort((a, b) => a.x - b.x);

        return [
            { name: 'INCOMING Ringing', data: incomingRinging },
            { name: 'INCOMING Talking', data: incomingTalk },
            { name: 'OUTGOING Ringing', data: outgoingRinging },
            { name: 'OUTGOING Talking', data: outgoingTalk },
            { name: 'MISSED', data: missedRinging },
        ];
    }, [logs]);

    const chartOptions: ApexCharts.ApexOptions = useMemo(() => ({
        chart: {
            type: 'bar',
            height: 250,
            background: 'transparent',
            stacked: true, // Enable stacking
            events: {
                dataPointSelection: (event: any, chartContext: any, config: any) => {
                    const data = config.w.config.series[config.seriesIndex].data[config.dataPointIndex];
                    if (data && data.meta && data.meta.phoneNumber) {
                        navigator.clipboard.writeText(data.meta.phoneNumber)
                            .then(() => {
                                setCopiedNumber(data.meta.phoneNumber);
                                setTimeout(() => setCopiedNumber(null), 2000);
                            })
                            .catch(err => console.error('Failed to copy', err));
                    }
                }
            },
            toolbar: {
                show: true,
                tools: {
                    download: true,
                    selection: true,
                    zoom: true,
                    zoomin: true,
                    zoomout: true,
                    pan: true,
                    reset: true,
                },
            },
            fontFamily: 'inherit',
        },
        colors: [
            '#87CEEB', // INCOMING Ringing (light blue)
            '#5b86b5', // INCOMING Talking (darker blue)
            '#FFD700', // OUTGOING Ringing (gold)
            '#0073e6', // OUTGOING Talking (darker blue)
            '#ac7272'  // MISSED (reddish)
        ],
        plotOptions: {
            bar: {
                horizontal: false,
                columnWidth: '100%', // Maximize width relative to interval to show thickness upon zooming
            },
        },
        dataLabels: {
            enabled: false,
        },
        stroke: {
            show: true,
            width: 0,
            colors: ['transparent'],
        },
        xaxis: {
            type: 'datetime',
            title: {
                text: 'Time of Day',
                style: {
                    color: '#9ca3af',
                    fontWeight: 500,
                },
            },
            labels: {
                style: {
                    colors: '#9ca3af',
                },
                datetimeUTC: false,
                format: 'HH:mm',
            },
            axisBorder: {
                show: false,
            },
            axisTicks: {
                show: false,
            },
        },
        yaxis: {
            title: {
                text: 'Calls',
                style: {
                    color: '#ffffff',
                    fontWeight: 500,
                },
            },
            labels: {
                show: false, // Hide the "1" on the Y axis
            },
            axisBorder: {
                show: false,
            },
            axisTicks: {
                show: false,
            },
            min: 0,
            max: 1, // Lock height
        },
        grid: {
            show: false, // Remove grid lines for that clean look in the reference
        },
        legend: {
            position: 'right',
            horizontalAlign: 'right',
            labels: {
                colors: '#9ca3af',
            },
            markers: {
                shape: 'square', // Square-ish markers
            },
        },
        theme: {
            mode: 'dark',
        },
        tooltip: {
            custom: function ({ series, seriesIndex, dataPointIndex, w }: any) {
                const data = w.config.series[seriesIndex].data[dataPointIndex].meta;
                const color = w.config.colors[seriesIndex];

                const startTime = new Date(data.timestamp);
                const startTimeStr = startTime.toTimeString().split(' ')[0]; // HH:mm:ss

                // Show the duration for the specific phase being hovered over
                const phaseDuration = data.duration || 0;

                const endTime = new Date(startTime.getTime() + data.duration * 1000);
                const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                const month = months[endTime.getMonth()];
                const day = endTime.getDate();
                const year = endTime.getFullYear();
                const hours = endTime.getHours().toString().padStart(2, '0');
                const minutes = endTime.getMinutes().toString().padStart(2, '0');
                const seconds = endTime.getSeconds().toString().padStart(2, '0');

                const endTimeFormatted = `${month} ${day}, ${year}, ${hours}:${minutes}:${seconds}`;

                return `
                    <div style="background: #111319; border: 1px solid #374151; padding: 12px; color: #e5e7eb; font-family: inherit; font-size: 13px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.5);">
                        <div style="font-weight: 700; font-size: 15px; margin-bottom: 8px; border-left: 4px solid ${color}; padding-left: 8px;">
                            ${data.phoneNumber}
                        </div>
                        <div style="display: flex; flex-direction: column; gap: 4px;">
                            <div>Type: ${data.type}</div>
                            <div>Phase: <strong>${data.phase}</strong></div>
                            <div>start_time=${startTimeStr}</div>
                            ${data.phase === 'Talking' ? `<div>end_time=${endTimeFormatted}</div>` : ''}
                            <div>Phase Length: <strong>${phaseDuration}s</strong></div>
                        </div>
                    </div>
                `;
            }
        },
    }), []);

    // If there are no logs, we can just show an empty chart or hide it
    if (logs.length === 0) return null;

    const titleDate = currentDateLimit || new Date().toISOString().split('T')[0];

    return (
        <div className="mb-8" >
            <div className="flex items-center space-x-2 mb-4">
                <h2 className="text-xl font-semibold text-white">Call Activity for {titleDate}</h2>
            </div>

            <div className="bg-[#111319] rounded-lg border border-gray-800 p-6 shadow-xl relative z-0">
                <Chart
                    options={chartOptions}
                    series={chartData}
                    type="bar"
                    height={250}
                />

                {copiedNumber && (
                    <div className="absolute top-4 right-4 bg-green-900/90 text-green-300 border border-green-700 px-4 py-2 rounded-md shadow-lg text-sm font-medium z-50 transition-opacity">
                        📋 Copied {copiedNumber}
                    </div>
                )}
            </div>
        </div >
    );
}
