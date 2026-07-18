'use client';

import {
    CategoryScale,
    Chart as ChartJS,
    Filler,
    Legend,
    LineElement,
    LinearScale,
    PointElement,
    Tooltip,
} from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Tooltip,
    Legend,
    Filler,
);

export type TrendSeries = {
    label: string;
    color: string;
    values: number[];
    /** Subtle area wash under the line — single-series charts only. */
    fill?: boolean;
};

function money(n: number) {
    return n.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
}

const compact = new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: 1,
});

/**
 * Dashboard line chart. Dataviz rules applied: 2px lines with hidden points
 * (≥8px hover hit targets), index-mode crosshair tooltips, one shared y-axis
 * (never dual-axis — extra measures ride in the tooltip footer), zero-based
 * scale, hairline grid, text in text tokens, legend only for ≥ 2 series.
 */
export default function TrendLineChart({
    labels,
    series,
    tooltipFooter,
}: {
    labels: string[];
    series: TrendSeries[];
    tooltipFooter?: (index: number) => string;
}) {
    return (
        <Line
            data={{
                labels,
                datasets: series.map((s) => ({
                    label: s.label,
                    data: s.values,
                    borderColor: s.color,
                    backgroundColor: s.fill ? `${s.color}1A` : s.color,
                    fill: s.fill ?? false,
                    borderWidth: 2,
                    cubicInterpolationMode: 'monotone' as const,
                    pointRadius: 0,
                    pointHoverRadius: 4,
                    pointHoverBackgroundColor: '#ffffff',
                    pointHoverBorderColor: s.color,
                    pointHoverBorderWidth: 2,
                    pointHitRadius: 12,
                })),
            }}
            options={{
                responsive: true,
                maintainAspectRatio: false,
                animation: { duration: 500, easing: 'easeOutQuart' },
                interaction: { mode: 'index', intersect: false },
                plugins: {
                    legend: {
                        display: series.length > 1,
                        position: 'top',
                        align: 'end',
                        labels: {
                            usePointStyle: true,
                            pointStyle: 'line',
                            boxWidth: 16,
                            color: '#64748b',
                            font: { size: 11 },
                        },
                    },
                    tooltip: {
                        backgroundColor: '#0f172a',
                        padding: 10,
                        cornerRadius: 8,
                        titleFont: { size: 11 },
                        bodyFont: { size: 11 },
                        footerFont: { size: 10, weight: 'normal' },
                        footerColor: '#94a3b8',
                        callbacks: {
                            label: (ctx) =>
                                ` ${ctx.dataset.label}: $ ${money(ctx.parsed.y ?? 0)}`,
                            footer: (items) =>
                                tooltipFooter?.(items[0]?.dataIndex ?? 0) ?? '',
                        },
                    },
                },
                scales: {
                    x: {
                        grid: { display: false },
                        border: { color: '#e2e8f0' },
                        ticks: {
                            color: '#94a3b8',
                            font: { size: 10 },
                            maxTicksLimit: 8,
                            maxRotation: 0,
                        },
                    },
                    y: {
                        beginAtZero: true,
                        grid: { color: '#f1f5f9' },
                        border: { display: false },
                        ticks: {
                            color: '#94a3b8',
                            font: { size: 10 },
                            maxTicksLimit: 5,
                            callback: (v) => `$${compact.format(Number(v))}`,
                        },
                    },
                },
            }}
        />
    );
}
