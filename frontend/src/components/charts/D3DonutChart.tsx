/**
 * D3DonutChart Component
 * Replaces recharts PieChart with a D3-based donut chart.
 * Inspired by sure app's donut_chart_controller.js.
 *
 * Features:
 * - Ring segments with corner radius and pad angle
 * - Minimum segment angle so tiny categories stay visible
 * - Hover: highlight segment, gray out others
 * - Percentage labels
 * - Clickable legend for toggling visibility
 * - Responsive via viewBox scaling
 */

import React, { useMemo, useState, useCallback, useRef } from 'react';
import * as d3 from 'd3';
import { useResizeObserver } from './useResizeObserver';
import { D3Tooltip } from './D3Tooltip';
import { getSeriesColor, formatCurrencyFull } from './chartUtils';

/** Data point for donut chart */
interface DonutDataPoint {
  name: string;
  value: number;
}

/** Props for D3DonutChart */
interface D3DonutChartProps {
  /** Pie/category data */
  data: DonutDataPoint[];
  /** Chart height in pixels */
  height: number;
  /** Currency code */
  currency: string;
  /** Hidden series */
  hiddenSeries: Set<string>;
  /** Legend click callback */
  onLegendClick: (key: string) => void;
}

/** Minimum segment angle in radians (~1.15 degrees) - from sure app */
const MIN_SEGMENT_ANGLE = 0.02;

/** Pad angle between segments (~0.29 degrees) - from sure app */
const PAD_ANGLE = 0.005;

/** Corner radius for segments */
const CORNER_RADIUS = 3;

/** Donut hole ratio (inner radius / outer radius) */
const INNER_RADIUS_RATIO = 0.6;

/** Gray color for non-hovered segments */
const GRAY_OUT_COLOR = '#d1d5db';

/**
 * D3-based Donut Chart component following sure app's donut_chart_controller pattern.
 */
export function D3DonutChart({
  data,
  height,
  currency,
  hiddenSeries,
  onLegendClick,
}: D3DonutChartProps): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);
  const { width: containerWidth } = useResizeObserver(containerRef);

  const [hoveredSegment, setHoveredSegment] = useState<string | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  // Filter visible data
  const visibleData = useMemo(
    () => data.filter((d) => !hiddenSeries.has(d.name) && d.value > 0),
    [data, hiddenSeries]
  );

  // Enforce minimum segment angle (from sure app)
  const adjustedData = useMemo(() => {
    const total = visibleData.reduce((sum, d) => sum + d.value, 0);
    if (total === 0) return visibleData;

    return visibleData.map((d) => ({
      ...d,
      value: Math.max(d.value, total * (MIN_SEGMENT_ANGLE / (2 * Math.PI))),
    }));
  }, [visibleData]);

  // Chart dimensions
  const size = Math.min(containerWidth, height - 40);
  const outerRadius = size / 2 - 4;
  const innerRadius = outerRadius * INNER_RADIUS_RATIO;

  // D3 pie layout
  const pieGen = useMemo(
    () =>
      d3
        .pie<DonutDataPoint>()
        .sortValues(null) // Preserve order (from sure app)
        .value((d) => d.value)
        .padAngle(PAD_ANGLE),
    []
  );

  const arcs = useMemo(() => pieGen(adjustedData), [pieGen, adjustedData]);

  // D3 arc generator
  const arcGen = useMemo(
    () =>
      d3
        .arc<d3.PieArcDatum<DonutDataPoint>>()
        .innerRadius(innerRadius)
        .outerRadius(outerRadius)
        .cornerRadius(CORNER_RADIUS),
    [innerRadius, outerRadius]
  );

  // Color map
  const colorMap = useMemo(() => {
    const map = new Map<string, string>();
    data.forEach((d, i) => {
      map.set(d.name, getSeriesColor(i));
    });
    return map;
  }, [data]);

  // Total for percentage
  const total = useMemo(
    () => visibleData.reduce((sum, d) => sum + d.value, 0),
    [visibleData]
  );

  const handleSegmentEnter = useCallback(
    (event: React.MouseEvent, name: string) => {
      setHoveredSegment(name);
      setTooltipPos({ x: event.pageX, y: event.pageY });
    },
    []
  );

  const handleSegmentMove = useCallback((event: React.MouseEvent) => {
    setTooltipPos({ x: event.pageX, y: event.pageY });
  }, []);

  const handleSegmentLeave = useCallback(() => {
    setHoveredSegment(null);
  }, []);

  // Tooltip content
  const tooltipContent = useMemo(() => {
    if (!hoveredSegment) return null;
    const item = visibleData.find((d) => d.name === hoveredSegment);
    if (!item) return null;
    const pct = total > 0 ? ((item.value / total) * 100).toFixed(1) : '0';
    return (
      <div>
        <div style={{ fontWeight: 600, marginBottom: 2 }}>{item.name}</div>
        <div>{formatCurrencyFull(item.value, currency)} ({pct}%)</div>
      </div>
    );
  }, [hoveredSegment, visibleData, total, currency]);

  if (containerWidth <= 0 || size <= 0) {
    return <div ref={containerRef} style={{ width: '100%', height }} />;
  }

  return (
    <div ref={containerRef} style={{ width: '100%', height, position: 'relative' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%' }}>
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          preserveAspectRatio="xMidYMid meet"
          style={{ display: 'block', flexShrink: 0 }}
        >
          <g transform={`translate(${size / 2},${size / 2})`}>
            {arcs.map((arc, i) => {
              const segColor = colorMap.get(arc.data.name) ?? getSeriesColor(i);
              const isHovered = hoveredSegment === arc.data.name;
              const isGrayedOut = hoveredSegment !== null && !isHovered;

              return (
                <path
                  key={arc.data.name}
                  d={arcGen(arc) ?? ''}
                  fill={isGrayedOut ? GRAY_OUT_COLOR : segColor}
                  opacity={isGrayedOut ? 0.4 : 1}
                  style={{
                    cursor: 'pointer',
                    transition: 'fill 0.2s ease, opacity 0.2s ease',
                  }}
                  onMouseEnter={(e) => handleSegmentEnter(e, arc.data.name)}
                  onMouseMove={handleSegmentMove}
                  onMouseLeave={handleSegmentLeave}
                />
              );
            })}

            {/* Percentage labels on larger segments */}
            {arcs.map((arc) => {
              const angle = arc.endAngle - arc.startAngle;
              if (angle < 0.3) return null; // Skip labels on small segments
              const [cx, cy] = arcGen.centroid(arc);
              const pct = total > 0 ? `${((arc.data.value / total) * 100).toFixed(0)}%` : '';
              return (
                <text
                  key={`label-${arc.data.name}`}
                  x={cx}
                  y={cy}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize={11}
                  fontWeight={600}
                  fill="#fff"
                  pointerEvents="none"
                >
                  {pct}
                </text>
              );
            })}
          </g>
        </svg>

        {/* Legend */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 8,
            justifyContent: 'flex-start',
            width: '100%',
            paddingTop: 8,
            fontSize: 11,
            opacity: 0.6,
          }}
        >
          {data.map((item, i) => {
            const color = colorMap.get(item.name) ?? getSeriesColor(i);
            return (
              <div
                key={item.name}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  cursor: 'pointer',
                  opacity: hiddenSeries.has(item.name) ? 0.3 : 1,
                }}
                onClick={() => onLegendClick(item.name)}
              >
                <div style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: color, flexShrink: 0 }} />
                <span>
                  {item.name}: {formatCurrencyFull(item.value, currency)}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <D3Tooltip visible={hoveredSegment !== null} x={tooltipPos.x} y={tooltipPos.y} content={tooltipContent} />
    </div>
  );
}
