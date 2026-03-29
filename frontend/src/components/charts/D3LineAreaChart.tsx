/**
 * D3LineAreaChart Component
 * Replaces recharts LineChart + AreaChart with a D3-based implementation.
 * Inspired by sure app's time_series_chart_controller.js.
 *
 * Features:
 * - Line mode: smooth trendlines with data point dots
 * - Area mode: filled area below lines with gradient fade
 * - Hover: vertical guideline + data point circles
 * - Tooltip: shows date, values per series
 * - Grid: dashed horizontal lines
 * - Legend: clickable to toggle series visibility
 * - Responsive via ResizeObserver
 */

import React, { useMemo, useState, useCallback, useRef } from 'react';
import * as d3 from 'd3';
import { useResizeObserver } from './useResizeObserver';
import { D3Tooltip } from './D3Tooltip';
import {
  COLOR_SUCCESS,
  COLOR_DESTRUCTIVE,
  formatAxisTick,
  formatCurrencyFull,
  DEFAULT_MARGIN,
  computeYDomain,
} from './chartUtils';
import type { ChartMargin } from './chartUtils';

/** Data point for line/area chart */
interface DataPoint {
  date: string;
  originalDate?: string;
  [key: string]: string | number | undefined;
}

/** Series configuration */
interface SeriesConfig {
  key: string;
  label: string;
  color: string;
}

/** Props for D3LineAreaChart */
interface D3LineAreaChartProps {
  /** Chart data points */
  data: DataPoint[];
  /** Display mode */
  mode: 'line' | 'area';
  /** Chart height in pixels */
  height: number;
  /** Currency code for formatting */
  currency: string;
  /** Set of hidden series keys */
  hiddenSeries: Set<string>;
  /** Callback when legend item is clicked */
  onLegendClick: (key: string) => void;
}

/** Default series for income/expense charts */
const DEFAULT_SERIES: SeriesConfig[] = [
  { key: 'income', label: 'Income', color: COLOR_SUCCESS },
  { key: 'expense', label: 'Expense', color: COLOR_DESTRUCTIVE },
];

const MARGIN: ChartMargin = { ...DEFAULT_MARGIN, bottom: 48 };

/**
 * D3-based Line/Area Chart Component.
 * Uses D3 for scales and path generation, React for SVG rendering.
 */
export function D3LineAreaChart({
  data,
  mode,
  height,
  currency,
  hiddenSeries,
  onLegendClick,
}: D3LineAreaChartProps): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);
  const { width: containerWidth } = useResizeObserver(containerRef);

  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  const chartWidth = containerWidth - MARGIN.left - MARGIN.right;
  const chartHeight = height - MARGIN.top - MARGIN.bottom;

  // Build scales
  const xScale = useMemo(() => {
    if (data.length === 0 || chartWidth <= 0) return null;
    return d3
      .scalePoint<string>()
      .domain(data.map((d) => d.date))
      .range([0, chartWidth])
      .padding(0.1);
  }, [data, chartWidth]);

  const yScale = useMemo(() => {
    if (data.length === 0 || chartHeight <= 0) return null;

    const allValues: number[] = [];
    for (const series of DEFAULT_SERIES) {
      if (hiddenSeries.has(series.key)) continue;
      for (const d of data) {
        const val = d[series.key];
        if (typeof val === 'number') allValues.push(val);
      }
    }
    if (allValues.length === 0) return null;

    const [yMin, yMax] = computeYDomain(allValues);
    return d3.scaleLinear().domain([yMin, yMax]).range([chartHeight, 0]).nice();
  }, [data, chartHeight, hiddenSeries]);

  // Path generators
  const linePaths = useMemo(() => {
    if (!xScale || !yScale) return [];

    return DEFAULT_SERIES.filter((s) => !hiddenSeries.has(s.key)).map((series) => {
      const lineGen = d3
        .line<DataPoint>()
        .x((d) => xScale(d.date) ?? 0)
        .y((d) => yScale((d[series.key] as number) ?? 0))
        .curve(d3.curveMonotoneX)
        .defined((d) => typeof d[series.key] === 'number');

      return {
        ...series,
        d: lineGen(data) ?? '',
      };
    });
  }, [data, xScale, yScale, hiddenSeries]);

  // Area paths (for area mode)
  const areaPaths = useMemo(() => {
    if (mode !== 'area' || !xScale || !yScale) return [];

    return DEFAULT_SERIES.filter((s) => !hiddenSeries.has(s.key)).map((series) => {
      const areaGen = d3
        .area<DataPoint>()
        .x((d) => xScale(d.date) ?? 0)
        .y0(chartHeight)
        .y1((d) => yScale((d[series.key] as number) ?? 0))
        .curve(d3.curveMonotoneX)
        .defined((d) => typeof d[series.key] === 'number');

      return {
        ...series,
        d: areaGen(data) ?? '',
      };
    });
  }, [data, mode, xScale, yScale, chartHeight, hiddenSeries]);

  // X-axis ticks
  const xTicks = useMemo(() => {
    if (!xScale || data.length === 0) return [];
    const domain = xScale.domain();
    const maxTicks = Math.floor(chartWidth / 80);
    const step = Math.max(1, Math.ceil(domain.length / maxTicks));
    return domain
      .filter((_, i) => i % step === 0)
      .map((label) => ({ label, x: xScale(label) ?? 0 }));
  }, [xScale, data, chartWidth]);

  // Y-axis ticks
  const yTicks = useMemo(() => {
    if (!yScale) return [];
    return yScale.ticks(5).map((value) => ({
      value,
      y: yScale(value),
      label: formatAxisTick(value),
    }));
  }, [yScale]);

  // Hover handler
  const handleMouseMove = useCallback(
    (event: React.MouseEvent<SVGRectElement>) => {
      if (!xScale || data.length === 0) return;

      const svgRect = (event.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect();
      const mouseX = event.clientX - svgRect.left - MARGIN.left;

      // Find closest data point
      const domain = xScale.domain();
      let closestIdx = 0;
      let closestDist = Infinity;
      for (let i = 0; i < domain.length; i++) {
        const px = xScale(domain[i] ?? '') ?? 0;
        const dist = Math.abs(px - mouseX);
        if (dist < closestDist) {
          closestDist = dist;
          closestIdx = i;
        }
      }

      setHoverIndex(closestIdx);
      setTooltipPos({ x: event.pageX, y: event.pageY });
    },
    [xScale, data]
  );

  const handleMouseLeave = useCallback(() => {
    setHoverIndex(null);
  }, []);

  // Tooltip content
  const tooltipContent = useMemo(() => {
    if (hoverIndex === null || !data[hoverIndex]) return null;
    const d = data[hoverIndex];
    return (
      <div>
        <div style={{ marginBottom: 4, fontWeight: 600 }}>{d.date}</div>
        {DEFAULT_SERIES.filter((s) => !hiddenSeries.has(s.key)).map((series) => {
          const val = d[series.key];
          if (typeof val !== 'number') return null;
          return (
            <div key={series.key} style={{ color: series.color, marginBottom: 2 }}>
              {series.label}: {formatCurrencyFull(val, currency)}
            </div>
          );
        })}
      </div>
    );
  }, [hoverIndex, data, hiddenSeries, currency]);

  // Hovered data point x position
  const hoverX = useMemo(() => {
    if (hoverIndex === null || !xScale || !data[hoverIndex]) return null;
    return xScale(data[hoverIndex].date) ?? null;
  }, [hoverIndex, xScale, data]);

  if (containerWidth <= 0 || chartWidth <= 0 || chartHeight <= 0) {
    return <div ref={containerRef} style={{ width: '100%', height }} />;
  }

  return (
    <div ref={containerRef} style={{ width: '100%', height, position: 'relative' }}>
      <svg width={containerWidth} height={height} style={{ display: 'block' }}>
        {/* Gradient definitions for area mode */}
        {mode === 'area' && (
          <defs>
            {DEFAULT_SERIES.map((series) => (
              <linearGradient
                key={`area-grad-${series.key}`}
                id={`area-gradient-${series.key}`}
                x1="0"
                x2="0"
                y1="0"
                y2="1"
              >
                <stop offset="0%" stopColor={series.color} stopOpacity={0.3} />
                <stop offset="100%" stopColor={series.color} stopOpacity={0.02} />
              </linearGradient>
            ))}
          </defs>
        )}

        <g transform={`translate(${MARGIN.left},${MARGIN.top})`}>
          {/* Grid lines */}
          {yTicks.map((tick) => (
            <line
              key={`grid-${tick.value}`}
              x1={0}
              x2={chartWidth}
              y1={tick.y}
              y2={tick.y}
              stroke="#e5e7eb"
              strokeDasharray="3 3"
              strokeOpacity={0.5}
            />
          ))}

          {/* Y-axis labels */}
          {yTicks.map((tick) => (
            <text
              key={`ytick-${tick.value}`}
              x={-8}
              y={tick.y}
              textAnchor="end"
              dominantBaseline="middle"
              fontSize={11}
              fill="#9ca3af"
            >
              {tick.label}
            </text>
          ))}

          {/* X-axis labels */}
          {xTicks.map((tick) => (
            <text
              key={`xtick-${tick.label}`}
              x={tick.x}
              y={chartHeight + 20}
              textAnchor="middle"
              fontSize={11}
              fill="#9ca3af"
            >
              {tick.label}
            </text>
          ))}

          {/* Area fills */}
          {areaPaths.map((area) => (
            <path
              key={`area-${area.key}`}
              d={area.d}
              fill={`url(#area-gradient-${area.key})`}
              style={{ transition: 'opacity 0.3s ease' }}
            />
          ))}

          {/* Line paths */}
          {linePaths.map((line) => (
            <path
              key={`line-${line.key}`}
              d={line.d}
              fill="none"
              stroke={line.color}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
              style={{ transition: 'opacity 0.3s ease' }}
            />
          ))}

          {/* Data point dots (line mode) */}
          {mode === 'line' &&
            linePaths.map((series) =>
              data.map((d, i) => {
                const val = d[series.key];
                if (typeof val !== 'number' || !xScale || !yScale) return null;
                return (
                  <circle
                    key={`dot-${series.key}-${i}`}
                    cx={xScale(d.date) ?? 0}
                    cy={yScale(val)}
                    r={3}
                    fill={series.color}
                    opacity={0.7}
                    style={{ transition: 'opacity 0.2s ease' }}
                  />
                );
              })
            )}

          {/* Hover guideline */}
          {hoverX !== null && (
            <>
              <line
                x1={hoverX}
                x2={hoverX}
                y1={0}
                y2={chartHeight}
                stroke="#9ca3af"
                strokeDasharray="4 4"
                strokeOpacity={0.6}
              />
              {/* Hover data point circles (sure pattern: big + small) */}
              {DEFAULT_SERIES.filter((s) => !hiddenSeries.has(s.key)).map((series) => {
                const d = data[hoverIndex!];
                if (!d || !yScale) return null;
                const val = d[series.key];
                if (typeof val !== 'number') return null;
                const cy = yScale(val);
                return (
                  <React.Fragment key={`hover-${series.key}`}>
                    <circle cx={hoverX} cy={cy} r={10} fill={series.color} fillOpacity={0.1} />
                    <circle cx={hoverX} cy={cy} r={5} fill={series.color} />
                  </React.Fragment>
                );
              })}
            </>
          )}

          {/* Invisible overlay for mouse tracking */}
          <rect
            x={0}
            y={0}
            width={chartWidth}
            height={chartHeight}
            fill="none"
            pointerEvents="all"
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
          />
        </g>
      </svg>

      {/* Legend */}
      <div
        style={{
          display: 'flex',
          gap: 16,
          paddingLeft: MARGIN.left,
          paddingTop: 4,
          fontSize: 11,
          opacity: 0.6,
        }}
      >
        {DEFAULT_SERIES.map((series) => (
          <div
            key={series.key}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              cursor: 'pointer',
              opacity: hiddenSeries.has(series.key) ? 0.3 : 1,
            }}
            onClick={() => onLegendClick(series.key)}
          >
            <div
              style={{
                width: 12,
                height: 12,
                borderRadius: 2,
                backgroundColor: series.color,
              }}
            />
            <span>{series.label}</span>
          </div>
        ))}
      </div>

      {/* Tooltip */}
      <D3Tooltip
        visible={hoverIndex !== null}
        x={tooltipPos.x}
        y={tooltipPos.y}
        content={tooltipContent}
      />
    </div>
  );
}
