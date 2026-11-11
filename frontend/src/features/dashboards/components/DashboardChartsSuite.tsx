"use client";

import React from "react";
import {
  ChartLabelValue,
  HeatmapCellPoint,
  StackedSeriesPoint,
} from "../types/dashboards.types";

// ============================================================================
// REUSABLE CHART CARD WRAPPER
// ============================================================================

export function ChartCardShell({
  title,
  subtitle,
  chartTypeBadge,
  children,
}: {
  title: string;
  subtitle: string;
  chartTypeBadge: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-5 shadow-sm flex flex-col justify-between gap-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-bold tracking-tight">{title}</h3>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
            {subtitle}
          </p>
        </div>
        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-violet-500/15 text-violet-400 border border-violet-500/30 shrink-0">
          {chartTypeBadge}
        </span>
      </div>
      <div className="w-full">{children}</div>
    </div>
  );
}

// ============================================================================
// 1. LINE CHART (SVG Multi-Point Trajectory + Threshold Line)
// ============================================================================

export function SvgLineChart({
  data,
  lineColor = "#06B6D4",
  secondaryColor = "#F59E0B",
  unitSuffix = "",
}: {
  data: Array<{ label: string; primary: number; secondary?: number }>;
  lineColor?: string;
  secondaryColor?: string;
  unitSuffix?: string;
}) {
  const safeData =
    data.length >= 2
      ? data
      : [
          ...(data.length === 1
            ? data
            : [{ label: "Start", primary: 0, secondary: 50 }]),
          {
            label: "Current",
            primary: data[0]?.primary ?? 85,
            secondary: data[0]?.secondary ?? 50,
          },
        ];

  const width = 460;
  const height = 180;
  const padX = 36;
  const padY = 24;
  const maxVal = Math.max(
    10,
    ...safeData.map((d) => Math.max(d.primary, d.secondary ?? 0)),
  );

  const coords = safeData.map((d, idx) => {
    const x =
      padX + (idx / Math.max(1, safeData.length - 1)) * (width - padX * 2);
    const y = height - padY - (d.primary / maxVal) * (height - padY * 2);
    const y2 =
      d.secondary !== undefined
        ? height - padY - (d.secondary / maxVal) * (height - padY * 2)
        : null;
    return { ...d, x, y, y2 };
  });

  const primaryPoints = coords.map((c) => `${c.x},${c.y}`).join(" ");
  const secondaryPoints = coords
    .filter((c) => c.y2 !== null)
    .map((c) => `${c.x},${c.y2}`)
    .join(" ");

  return (
    <div className="space-y-2">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-44 overflow-visible"
      >
        {[0.25, 0.5, 0.75, 1].map((ratio) => {
          const y = height - padY - ratio * (height - padY * 2);
          return (
            <g key={ratio}>
              <line
                x1={padX}
                y1={y}
                x2={width - padX}
                y2={y}
                stroke="currentColor"
                className="text-slate-200 dark:text-slate-800"
                strokeDasharray="4 4"
              />
              <text
                x={4}
                y={y + 3}
                className="fill-slate-400 text-[9px] font-mono"
              >
                {Math.round(maxVal * ratio)}
                {unitSuffix}
              </text>
            </g>
          );
        })}

        {secondaryPoints && (
          <polyline
            fill="none"
            stroke={secondaryColor}
            strokeWidth="2"
            strokeDasharray="5 4"
            points={secondaryPoints}
          />
        )}

        <polyline
          fill="none"
          stroke={lineColor}
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={primaryPoints}
        />

        {coords.map((c, idx) => (
          <g key={`${c.label}-${idx}`}>
            <circle
              cx={c.x}
              cy={c.y}
              r="4.5"
              fill={lineColor}
              className="stroke-white dark:stroke-slate-900"
              strokeWidth="2"
            />
            <text
              x={c.x}
              y={c.y - 8}
              textAnchor="middle"
              className="fill-slate-600 dark:fill-slate-300 text-[9px] font-bold font-mono"
            >
              {c.primary}
              {unitSuffix}
            </text>
            <text
              x={c.x}
              y={height - 6}
              textAnchor="middle"
              className="fill-slate-400 text-[9px]"
            >
              {c.label.slice(0, 10)}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

// ============================================================================
// 2. AREA CHART (Gradient-Filled SVG Area Curve)
// ============================================================================

export function SvgAreaChart({
  data,
  strokeColor = "#8B5CF6",
  gradientId = "argonAreaGrad",
  unitSuffix = "",
}: {
  data: Array<{ label: string; value: number }>;
  strokeColor?: string;
  gradientId?: string;
  unitSuffix?: string;
}) {
  const safeData =
    data.length >= 2
      ? data
      : [
          {
            label: "Base",
            value: Math.max(5, Math.round((data[0]?.value ?? 40) * 0.6)),
          },
          ...(data.length === 1 ? data : [{ label: "Now", value: 60 }]),
        ];

  const width = 460;
  const height = 180;
  const padX = 34;
  const padY = 24;
  const maxVal = Math.max(10, ...safeData.map((d) => d.value));

  const coords = safeData.map((d, idx) => {
    const x =
      padX + (idx / Math.max(1, safeData.length - 1)) * (width - padX * 2);
    const y = height - padY - (d.value / maxVal) * (height - padY * 2);
    return { ...d, x, y };
  });

  const linePts = coords.map((c) => `${c.x},${c.y}`).join(" ");
  const areaPts = `${coords[0].x},${height - padY} ${linePts} ${
    coords[coords.length - 1].x
  },${height - padY}`;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full h-44 overflow-visible"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={strokeColor} stopOpacity="0.45" />
          <stop offset="100%" stopColor={strokeColor} stopOpacity="0.02" />
        </linearGradient>
      </defs>

      <polygon points={areaPts} fill={`url(#${gradientId})`} />
      <polyline
        fill="none"
        stroke={strokeColor}
        strokeWidth="3"
        strokeLinecap="round"
        points={linePts}
      />

      {coords.map((c, idx) => (
        <g key={`${c.label}-${idx}`}>
          <circle cx={c.x} cy={c.y} r="4" fill={strokeColor} />
          <text
            x={c.x}
            y={c.y - 8}
            textAnchor="middle"
            className="fill-slate-600 dark:fill-slate-200 text-[9px] font-mono font-bold"
          >
            {c.value}
            {unitSuffix}
          </text>
          <text
            x={c.x}
            y={height - 6}
            textAnchor="middle"
            className="fill-slate-400 text-[9px]"
          >
            {c.label.slice(0, 10)}
          </text>
        </g>
      ))}
    </svg>
  );
}

// ============================================================================
// 3. STACKED AREA CHART (Cumulative Multi-Layer SVG Polygons)
// ============================================================================

export function SvgStackedAreaChart({
  data,
  seriesMeta,
}: {
  data: Array<{ label: string; s1: number; s2: number; s3: number }>;
  seriesMeta: [
    { label: string; color: string },
    { label: string; color: string },
    { label: string; color: string },
  ];
}) {
  const safeData =
    data.length >= 2
      ? data
      : [
          { label: "P1", s1: 200, s2: 100, s3: 50 },
          ...(data.length === 1
            ? data
            : [{ label: "P2", s1: 500, s2: 200, s3: 100 }]),
        ];

  const width = 460;
  const height = 175;
  const padX = 30;
  const padY = 22;

  const totals = safeData.map((d) => d.s1 + d.s2 + d.s3);
  const maxTotal = Math.max(10, ...totals);

  const getX = (i: number) =>
    padX + (i / Math.max(1, safeData.length - 1)) * (width - padX * 2);
  const getY = (val: number) =>
    height - padY - (val / maxTotal) * (height - padY * 2);

  // Layer 3 (top cumulative: s1 + s2 + s3)
  const topPts = safeData
    .map((d, i) => `${getX(i)},${getY(d.s1 + d.s2 + d.s3)}`)
    .join(" ");
  const poly3 = `${getX(0)},${height - padY} ${topPts} ${getX(safeData.length - 1)},${
    height - padY
  }`;

  // Layer 2 (middle cumulative: s1 + s2)
  const midPts = safeData
    .map((d, i) => `${getX(i)},${getY(d.s1 + d.s2)}`)
    .join(" ");
  const poly2 = `${getX(0)},${height - padY} ${midPts} ${getX(safeData.length - 1)},${
    height - padY
  }`;

  // Layer 1 (base: s1)
  const lowPts = safeData.map((d, i) => `${getX(i)},${getY(d.s1)}`).join(" ");
  const poly1 = `${getX(0)},${height - padY} ${lowPts} ${getX(safeData.length - 1)},${
    height - padY
  }`;

  return (
    <div className="space-y-2">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-40 overflow-visible"
      >
        <polygon points={poly3} fill={seriesMeta[2].color} fillOpacity="0.35" />
        <polyline
          fill="none"
          stroke={seriesMeta[2].color}
          strokeWidth="2"
          points={topPts}
        />

        <polygon points={poly2} fill={seriesMeta[1].color} fillOpacity="0.45" />
        <polyline
          fill="none"
          stroke={seriesMeta[1].color}
          strokeWidth="2"
          points={midPts}
        />

        <polygon points={poly1} fill={seriesMeta[0].color} fillOpacity="0.6" />
        <polyline
          fill="none"
          stroke={seriesMeta[0].color}
          strokeWidth="2.5"
          points={lowPts}
        />

        {safeData.map((d, i) => (
          <text
            key={`${d.label}-${i}`}
            x={getX(i)}
            y={height - 5}
            textAnchor="middle"
            className="fill-slate-400 text-[9px]"
          >
            {d.label.slice(0, 10)}
          </text>
        ))}
      </svg>

      <div className="flex flex-wrap items-center justify-center gap-4 text-[11px]">
        {seriesMeta.map((s) => (
          <span key={s.label} className="flex items-center gap-1.5">
            <span
              style={{ backgroundColor: s.color }}
              className="w-2.5 h-2.5 rounded-full inline-block"
            />
            <span className="text-slate-500 dark:text-slate-300">
              {s.label}
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// 4. COLUMN CHART (Vertical Columns with Value Callouts)
// ============================================================================

export function SvgColumnChart({
  data,
  unitSuffix = "",
}: {
  data: ChartLabelValue[];
  unitSuffix?: string;
}) {
  const maxVal = Math.max(1, ...data.map((d) => d.value));

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3 items-end h-44 pt-6 px-2 border-b border-slate-200 dark:border-slate-800">
      {data.map((item, idx) => {
        const heightPct = Math.max(10, Math.round((item.value / maxVal) * 100));
        return (
          <div
            key={`${item.label}-${idx}`}
            className="flex flex-col items-center justify-end h-full gap-1.5"
          >
            <span className="text-[10px] font-mono font-bold text-slate-600 dark:text-slate-300">
              {item.value}
              {unitSuffix}
            </span>
            <div
              style={{
                height: `${heightPct}%`,
                backgroundColor: item.color || "#06B6D4",
              }}
              className="w-full max-w-[38px] rounded-t-xl shadow-sm transition-all duration-300 hover:opacity-90"
            />
            <span className="text-[10px] text-slate-500 truncate max-w-full pb-1.5">
              {item.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ============================================================================
// 5. HORIZONTAL BAR CHART
// ============================================================================

export function SvgHorizontalBarChart({
  data,
  unitSuffix = "",
}: {
  data: ChartLabelValue[];
  unitSuffix?: string;
}) {
  const maxVal = Math.max(1, ...data.map((d) => d.value));

  return (
    <div className="space-y-3">
      {data.map((item, idx) => {
        const widthPct = Math.max(6, Math.round((item.value / maxVal) * 100));
        return (
          <div key={`${item.label}-${idx}`} className="space-y-1 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-semibold truncate pr-2">{item.label}</span>
              <span className="font-mono font-bold text-cyan-400">
                {item.value}
                {unitSuffix}
              </span>
            </div>
            <div className="w-full h-2.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
              <div
                style={{
                  width: `${widthPct}%`,
                  backgroundColor: item.color || "#8B5CF6",
                }}
                className="h-full rounded-full transition-all duration-300"
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ============================================================================
// 6. STACKED BAR CHART (Multi-Segment Horizontal Stacked Bars)
// ============================================================================

export function SvgStackedBarChart({
  rows,
  unitPrefix = "",
}: {
  rows: StackedSeriesPoint[];
  unitPrefix?: string;
}) {
  const legendItems = rows[0]?.segments || [];

  return (
    <div className="space-y-3.5">
      {rows.map((row) => {
        const rowTotal = Math.max(
          1,
          row.segments.reduce((acc, s) => acc + s.value, 0),
        );
        return (
          <div key={row.label} className="space-y-1.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-bold font-mono">{row.label}</span>
              <span className="text-[11px] text-slate-400 font-mono">
                {row.segments
                  .map((s) => `${s.label}: ${unitPrefix}${s.value}`)
                  .join(" • ")}
              </span>
            </div>
            <div className="w-full h-3.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden flex">
              {row.segments.map((seg) => {
                const pct = (seg.value / rowTotal) * 100;
                if (pct <= 0) return null;
                return (
                  <div
                    key={seg.key}
                    style={{
                      width: `${pct}%`,
                      backgroundColor: seg.color,
                    }}
                    title={`${seg.label}: ${unitPrefix}${seg.value}`}
                    className="h-full transition-all duration-300"
                  />
                );
              })}
            </div>
          </div>
        );
      })}

      {legendItems.length > 0 && (
        <div className="flex flex-wrap items-center gap-4 pt-1 text-[11px]">
          {legendItems.map((seg) => (
            <span key={seg.key} className="flex items-center gap-1.5">
              <span
                style={{ backgroundColor: seg.color }}
                className="w-2.5 h-2.5 rounded-sm inline-block"
              />
              <span className="text-slate-500 dark:text-slate-300">
                {seg.label}
              </span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// 7. PIE CHART (Full-Sector SVG Trigonometric Arc Pie)
// ============================================================================

function polarToCartesian(
  cx: number,
  cy: number,
  r: number,
  angleInDegrees: number,
) {
  const rad = ((angleInDegrees - 90) * Math.PI) / 180.0;
  return {
    x: cx + r * Math.cos(rad),
    y: cy + r * Math.sin(rad),
  };
}

function describePieSlice(
  cx: number,
  cy: number,
  r: number,
  startAngle: number,
  endAngle: number,
) {
  const clampedEnd =
    endAngle - startAngle >= 360 ? startAngle + 359.99 : endAngle;
  const start = polarToCartesian(cx, cy, r, clampedEnd);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArcFlag = clampedEnd - startAngle <= 180 ? "0" : "1";
  return [
    "M",
    cx,
    cy,
    "L",
    start.x,
    start.y,
    "A",
    r,
    r,
    0,
    largeArcFlag,
    0,
    end.x,
    end.y,
    "Z",
  ].join(" ");
}

export function SvgPieChart({ data }: { data: ChartLabelValue[] }) {
  const total = Math.max(
    1,
    data.reduce((acc, d) => acc + d.value, 0),
  );
  let cumulativeAngle = 0;

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
      <svg viewBox="0 0 160 160" className="w-36 h-36 shrink-0">
        {data.map((slice, idx) => {
          const val = slice.value > 0 ? slice.value : 0;
          const angle = (val / total) * 360;
          if (angle <= 0) return null;
          const path = describePieSlice(
            80,
            80,
            70,
            cumulativeAngle,
            cumulativeAngle + angle,
          );
          cumulativeAngle += angle;
          return (
            <path
              key={`${slice.label}-${idx}`}
              d={path}
              fill={slice.color || "#06B6D4"}
              className="stroke-white dark:stroke-[#111827]"
              strokeWidth="2"
            />
          );
        })}
      </svg>

      <div className="flex-1 space-y-2 w-full text-xs">
        {data.map((slice) => {
          const pct = Math.round((slice.value / total) * 100);
          return (
            <div
              key={slice.label}
              className="flex items-center justify-between"
            >
              <span className="flex items-center gap-2">
                <span
                  style={{ backgroundColor: slice.color || "#06B6D4" }}
                  className="w-2.5 h-2.5 rounded-full inline-block shrink-0"
                />
                <span className="text-slate-600 dark:text-slate-300 truncate">
                  {slice.label}
                </span>
              </span>
              <span className="font-mono font-bold">
                {slice.value} ({pct}%)
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================================
// 8. DONUT CHART (Multi-Segment Ring Chart with Center Callout)
// ============================================================================

export function SvgDonutChart({
  data,
  centerTitle,
  centerValue,
}: {
  data: ChartLabelValue[];
  centerTitle: string;
  centerValue: string;
}) {
  const total = Math.max(
    1,
    data.reduce((acc, d) => acc + d.value, 0),
  );
  const radius = 56;
  const circumference = 2 * Math.PI * radius;
  let accumulatedFraction = 0;

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
      <div className="relative w-36 h-36 shrink-0 flex items-center justify-center">
        <svg viewBox="0 0 140 140" className="w-36 h-36 -rotate-90">
          <circle
            cx="70"
            cy="70"
            r={radius}
            fill="transparent"
            stroke="currentColor"
            className="text-slate-200 dark:text-slate-800"
            strokeWidth="16"
          />
          {data.map((seg, idx) => {
            const frac = seg.value / total;
            if (frac <= 0) return null;
            const dash = frac * circumference;
            const offset = -accumulatedFraction * circumference;
            accumulatedFraction += frac;
            return (
              <circle
                key={`${seg.label}-${idx}`}
                cx="70"
                cy="70"
                r={radius}
                fill="transparent"
                stroke={seg.color || "#10B981"}
                strokeWidth="16"
                strokeDasharray={`${dash} ${circumference}`}
                strokeDashoffset={offset}
              />
            );
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-2">
          <span className="text-[10px] uppercase tracking-wider text-slate-400">
            {centerTitle}
          </span>
          <span className="text-xs font-extrabold font-mono mt-0.5">
            {centerValue}
          </span>
        </div>
      </div>

      <div className="flex-1 space-y-2 w-full text-xs">
        {data.map((seg) => (
          <div key={seg.label} className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <span
                style={{ backgroundColor: seg.color || "#10B981" }}
                className="w-2.5 h-2.5 rounded-full inline-block shrink-0"
              />
              <span className="text-slate-600 dark:text-slate-300 truncate">
                {seg.label}
              </span>
            </span>
            <span className="font-mono font-bold">
              {seg.value.toLocaleString("en-IN")}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// 9. HEATMAP GRID (2D Row × Column Intensity Matrix)
// ============================================================================

export function SvgHeatmapGrid({
  cells,
  accentRgb = "16, 185, 129",
}: {
  cells: HeatmapCellPoint[];
  accentRgb?: string;
}) {
  const rowLabels = Array.from(new Set(cells.map((c) => c.rowLabel)));
  const colLabels = Array.from(new Set(cells.map((c) => c.colLabel)));
  const maxVal = Math.max(1, ...cells.map((c) => c.value));

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-center text-[11px] border-separate border-spacing-1.5">
        <thead>
          <tr>
            <th className="text-left text-slate-400 font-semibold px-1">
              Matrix
            </th>
            {colLabels.map((col) => (
              <th key={col} className="text-slate-400 font-mono px-1.5 py-1">
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rowLabels.map((row) => (
            <tr key={row}>
              <td className="text-left font-mono font-bold text-slate-500 dark:text-slate-300 pr-2">
                {row}
              </td>
              {colLabels.map((col) => {
                const match = cells.find(
                  (c) => c.rowLabel === row && c.colLabel === col,
                );
                const val = match?.value ?? 0;
                const alpha = val === 0 ? 0.08 : 0.22 + (val / maxVal) * 0.75;
                return (
                  <td
                    key={`${row}-${col}`}
                    style={{
                      backgroundColor: `rgba(${accentRgb}, ${alpha.toFixed(2)})`,
                    }}
                    className="rounded-lg py-2 px-2 font-mono font-bold"
                    title={`${row} × ${col}: ${val}`}
                  >
                    {val}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ============================================================================
// 10. SUNBURST DIAGRAM (2-Ring Concentric Hierarchical SVG Annular Sectors)
// ============================================================================

function describeAnnularSector(
  cx: number,
  cy: number,
  innerR: number,
  outerR: number,
  startAngle: number,
  endAngle: number,
) {
  const clampedEnd =
    endAngle - startAngle >= 360 ? startAngle + 359.99 : endAngle;
  const p1 = polarToCartesian(cx, cy, outerR, clampedEnd);
  const p2 = polarToCartesian(cx, cy, outerR, startAngle);
  const p3 = polarToCartesian(cx, cy, innerR, startAngle);
  const p4 = polarToCartesian(cx, cy, innerR, clampedEnd);
  const largeArc = clampedEnd - startAngle <= 180 ? "0" : "1";

  return [
    "M",
    p1.x,
    p1.y,
    "A",
    outerR,
    outerR,
    0,
    largeArc,
    0,
    p2.x,
    p2.y,
    "L",
    p3.x,
    p3.y,
    "A",
    innerR,
    innerR,
    0,
    largeArc,
    1,
    p4.x,
    p4.y,
    "Z",
  ].join(" ");
}

export function SvgSunburstChart({
  nodes,
}: {
  nodes: Array<{
    label: string;
    value: number;
    color: string;
    children?: Array<{ label: string; value: number; color: string }>;
  }>;
}) {
  const total = Math.max(
    1,
    nodes.reduce((acc, n) => acc + Math.max(1, n.value), 0),
  );
  let innerCursor = 0;

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
      <svg viewBox="0 0 180 180" className="w-40 h-40 shrink-0">
        {nodes.map((node, idx) => {
          const val = Math.max(1, node.value);
          const span = (val / total) * 360;
          const start = innerCursor;
          const end = innerCursor + span;
          innerCursor = end;

          const innerPath = describeAnnularSector(90, 90, 24, 52, start, end);
          const children = node.children || [];
          const childTotal = Math.max(
            1,
            children.reduce((a, b) => a + Math.max(1, b.value), 0),
          );
          let childCursor = start;

          return (
            <g key={`${node.label}-${idx}`}>
              <path
                d={innerPath}
                fill={node.color}
                className="stroke-white dark:stroke-[#111827]"
                strokeWidth="1.5"
              >
                <title>{`${node.label}: ${node.value}`}</title>
              </path>
              {children.map((ch, cIdx) => {
                const cSpan = (Math.max(1, ch.value) / childTotal) * span;
                const cStart = childCursor;
                const cEnd = childCursor + cSpan;
                childCursor = cEnd;
                const outerPath = describeAnnularSector(
                  90,
                  90,
                  55,
                  82,
                  cStart,
                  cEnd,
                );
                return (
                  <path
                    key={`${ch.label}-${cIdx}`}
                    d={outerPath}
                    fill={ch.color || node.color}
                    fillOpacity={0.78}
                    className="stroke-white dark:stroke-[#111827]"
                    strokeWidth="1.5"
                  >
                    <title>{`${node.label} → ${ch.label}: ${ch.value}`}</title>
                  </path>
                );
              })}
            </g>
          );
        })}
        <circle
          cx="90"
          cy="90"
          r="20"
          className="fill-white dark:fill-[#111827]"
        />
        <text
          x="90"
          y="93"
          textAnchor="middle"
          className="fill-slate-500 text-[8px] font-bold uppercase"
        >
          SUNBURST
        </text>
      </svg>

      <div className="flex-1 space-y-2 w-full text-xs">
        {nodes.map((n) => (
          <div key={n.label} className="space-y-1">
            <div className="flex items-center justify-between font-bold">
              <span className="flex items-center gap-2">
                <span
                  style={{ backgroundColor: n.color }}
                  className="w-2.5 h-2.5 rounded-full inline-block"
                />
                <span>{n.label}</span>
              </span>
              <span className="font-mono">
                {n.value.toLocaleString("en-IN")}
              </span>
            </div>
            {n.children && (
              <div className="pl-4 flex flex-wrap gap-2 text-[11px] text-slate-400">
                {n.children.map((ch) => (
                  <span key={ch.label}>
                    • {ch.label}:{" "}
                    <strong className="font-mono">{ch.value}</strong>
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// 11. RADAR / SPIDER CHART (5-Axis Polygon Telemetry)
// ============================================================================

export function SvgRadarChart({
  axes,
  strokeColor = "#06B6D4",
}: {
  axes: ChartLabelValue[];
  strokeColor?: string;
}) {
  const safeAxes =
    axes.length >= 3
      ? axes
      : [
          { label: "Attendance", value: 90 },
          { label: "Progress", value: 85 },
          { label: "Assessments", value: 92 },
          { label: "Fees", value: 100 },
          { label: "Engagement", value: 88 },
        ];

  const cx = 100;
  const cy = 95;
  const maxR = 62;
  const count = safeAxes.length;

  const getPoint = (idx: number, radiusRatio: number) => {
    const angle = (Math.PI * 2 * idx) / count - Math.PI / 2;
    return {
      x: cx + maxR * radiusRatio * Math.cos(angle),
      y: cy + maxR * radiusRatio * Math.sin(angle),
    };
  };

  const dataPolygon = safeAxes
    .map((ax, idx) => {
      const ratio = Math.min(1, Math.max(0.1, ax.value / 100));
      const pt = getPoint(idx, ratio);
      return `${pt.x},${pt.y}`;
    })
    .join(" ");

  return (
    <div className="flex items-center justify-center">
      <svg viewBox="0 0 200 190" className="w-52 h-48 overflow-visible">
        {[0.33, 0.66, 1].map((ring) => {
          const ringPts = safeAxes
            .map((_a, idx) => {
              const p = getPoint(idx, ring);
              return `${p.x},${p.y}`;
            })
            .join(" ");
          return (
            <polygon
              key={ring}
              points={ringPts}
              fill="none"
              stroke="currentColor"
              className="text-slate-200 dark:text-slate-800"
              strokeWidth="1"
            />
          );
        })}

        {safeAxes.map((ax, idx) => {
          const end = getPoint(idx, 1);
          const labelPt = getPoint(idx, 1.24);
          return (
            <g key={ax.label}>
              <line
                x1={cx}
                y1={cy}
                x2={end.x}
                y2={end.y}
                stroke="currentColor"
                className="text-slate-200 dark:text-slate-800"
              />
              <text
                x={labelPt.x}
                y={labelPt.y}
                textAnchor="middle"
                className="fill-slate-500 dark:fill-slate-300 text-[8px] font-semibold"
              >
                {ax.label} ({ax.value}%)
              </text>
            </g>
          );
        })}

        <polygon
          points={dataPolygon}
          fill={strokeColor}
          fillOpacity="0.28"
          stroke={strokeColor}
          strokeWidth="2.5"
        />
      </svg>
    </div>
  );
}
