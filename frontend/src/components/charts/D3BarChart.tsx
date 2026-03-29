/**
 * D3BarChart Component
 * Replaces recharts BarChart in all modes: grouped, stacked, and horizontal.
 *
 * Modes:
 * - grouped: Side-by-side bars per date period (income/expense)
 * - stacked: Budget vs actual stacked bars per category
 * - horizontal: Horizontal bars for category breakdown
 *
 * Features:
 * - Dashed grid lines
 * - Hover highlight with tooltip
 * - Clickable legend for series visibility
 * - Rounded bar corners
 * - Responsive via ResizeObserver
 */

import React, { useMemo, useState, useCallback, useRef } from 'react';
import * as d3 from 'd3';
import { useResizeObserver } from './useResizeObserver';
import { D3Tooltip } from './D3Tooltip';
import {
  COLOR_SUCCESS,
  COLOR_DESTRUCTIVE,
  getSeriesColor,
  formatAxisTick,
  formatCurrencyFull,
  DEFAULT_MARGIN,
  computeYDomain,
} from './chartUtils';

/** Budget type */
interface Budget {
  id: string;
  amount: string;
  currentSpent: string;
  categoryId: string | null;
  category: { id: string; name: string } | null;
}

/** Props for D3BarChart */
interface D3BarChartProps {
  /** Display mode */
  mode: 'grouped' | 'stacked' | 'horizontal';
  /** Chart height in pixels */
  height: number;
  /** Currency code */
  currency: string;
  /** Hidden series keys */
  hiddenSeries: Set<string>;
  /** Legend click callback */
  onLegendClick: (key: string) => void;

  // Grouped mode data
  /** Chart data points (for grouped mode) */
  chartData?: Array<{ date: string; [key: string]: string | number | undefined }>;
  /** Series keys (for grouped mode) */
  seriesKeys?: string[];

  // Stacked mode data
  /** Budget chart data (for stacked mode) */
  budgetChartData?: Array<{ month: string; [key: string]: string | number }>;
  /** Budgets (for stacked mode) */
  budgets?: Budget[];

  // Horizontal mode data
  /** Pie/category data (for horizontal mode) */
  pieChartData?: Array<{ name: string; value: number }>;
}

const MARGIN_GROUPED = { ...DEFAULT_MARGIN, bottom: 48 };
const MARGIN_HORIZONTAL = { top: 16, right: 16, bottom: 32, left: 120 };

/**
 * D3-based Bar Chart component supporting grouped, stacked, and horizontal modes.
 */
export function D3BarChart({
  mode,
  height,
  currency,
  hiddenSeries,
  onLegendClick,
  chartData = [],
  seriesKeys = [],
  budgetChartData = [],
  budgets = [],
  pieChartData = [],
}: D3BarChartProps): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);
  const { width: containerWidth } = useResizeObserver(containerRef);

  const [hoveredBar, setHoveredBar] = useState<string | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const [tooltipContent, setTooltipContent] = useState<React.ReactNode>(null);

  const handleBarHover = useCallback(
    (event: React.MouseEvent, key: string, content: React.ReactNode) => {
      setHoveredBar(key);
      setTooltipPos({ x: event.pageX, y: event.pageY });
      setTooltipContent(content);
    },
    []
  );

  const handleBarLeave = useCallback(() => {
    setHoveredBar(null);
    setTooltipContent(null);
  }, []);

  if (containerWidth <= 0) {
    return <div ref={containerRef} style={{ width: '100%', height }} />;
  }

  return (
    <div ref={containerRef} style={{ width: '100%', height, position: 'relative' }}>
      {mode === 'grouped' && (
        <GroupedBarChart
          data={chartData}
          seriesKeys={seriesKeys}
          width={containerWidth}
          height={height}
          currency={currency}
          hiddenSeries={hiddenSeries}
          onLegendClick={onLegendClick}
          hoveredBar={hoveredBar}
          onBarHover={handleBarHover}
          onBarLeave={handleBarLeave}
        />
      )}
      {mode === 'stacked' && (
        <StackedBarChart
          data={budgetChartData}
          budgets={budgets}
          width={containerWidth}
          height={height}
          currency={currency}
          hiddenSeries={hiddenSeries}
          onLegendClick={onLegendClick}
          hoveredBar={hoveredBar}
          onBarHover={handleBarHover}
          onBarLeave={handleBarLeave}
        />
      )}
      {mode === 'horizontal' && (
        <HorizontalBarChart
          data={pieChartData}
          width={containerWidth}
          height={height}
          currency={currency}
          hiddenSeries={hiddenSeries}
          hoveredBar={hoveredBar}
          onBarHover={handleBarHover}
          onBarLeave={handleBarLeave}
        />
      )}
      <D3Tooltip visible={hoveredBar !== null} x={tooltipPos.x} y={tooltipPos.y} content={tooltipContent} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Grouped Bar Chart (income/expense side by side)
// ---------------------------------------------------------------------------

interface GroupedBarProps {
  data: Array<{ date: string; [key: string]: string | number | undefined }>;
  seriesKeys: string[];
  width: number;
  height: number;
  currency: string;
  hiddenSeries: Set<string>;
  onLegendClick: (key: string) => void;
  hoveredBar: string | null;
  onBarHover: (event: React.MouseEvent, key: string, content: React.ReactNode) => void;
  onBarLeave: () => void;
}

/** Default series colors for grouped mode */
const GROUPED_COLORS: Record<string, string> = {
  income: COLOR_SUCCESS,
  expense: COLOR_DESTRUCTIVE,
};

function GroupedBarChart({
  data,
  seriesKeys,
  width,
  height,
  currency,
  hiddenSeries,
  onLegendClick,
  hoveredBar,
  onBarHover,
  onBarLeave,
}: GroupedBarProps): React.JSX.Element {
  const margin = MARGIN_GROUPED;
  const chartWidth = width - margin.left - margin.right;
  const chartHeight = height - margin.top - margin.bottom;

  const visibleKeys = useMemo(
    () => seriesKeys.filter((k) => !hiddenSeries.has(k)),
    [seriesKeys, hiddenSeries]
  );

  const xScale = useMemo(
    () =>
      d3
        .scaleBand()
        .domain(data.map((d) => d.date))
        .range([0, chartWidth])
        .padding(0.3),
    [data, chartWidth]
  );

  const xSubScale = useMemo(
    () =>
      d3
        .scaleBand()
        .domain(visibleKeys)
        .range([0, xScale.bandwidth()])
        .padding(0.05),
    [visibleKeys, xScale]
  );

  const yScale = useMemo(() => {
    const allVals: number[] = [];
    for (const d of data) {
      for (const k of visibleKeys) {
        const v = d[k];
        if (typeof v === 'number') allVals.push(v);
      }
    }
    if (allVals.length === 0) return d3.scaleLinear().domain([0, 100]).range([chartHeight, 0]);
    const [yMin, yMax] = computeYDomain(allVals);
    return d3.scaleLinear().domain([yMin, yMax]).range([chartHeight, 0]).nice();
  }, [data, visibleKeys, chartHeight]);

  const yTicks = yScale.ticks(5);

  // X-axis ticks (limit to prevent crowding)
  const xTicks = useMemo(() => {
    const domain = xScale.domain();
    const maxTicks = Math.floor(chartWidth / 80);
    const step = Math.max(1, Math.ceil(domain.length / maxTicks));
    return domain.filter((_, i) => i % step === 0);
  }, [xScale, chartWidth]);

  if (chartWidth <= 0 || chartHeight <= 0) return <div />;

  return (
    <>
      <svg width={width} height={height} style={{ display: 'block' }}>
        <g transform={`translate(${margin.left},${margin.top})`}>
          {/* Grid lines */}
          {yTicks.map((tick) => (
            <line
              key={`grid-${tick}`}
              x1={0}
              x2={chartWidth}
              y1={yScale(tick)}
              y2={yScale(tick)}
              stroke="#e5e7eb"
              strokeDasharray="3 3"
              strokeOpacity={0.5}
            />
          ))}

          {/* Y-axis labels */}
          {yTicks.map((tick) => (
            <text key={`yt-${tick}`} x={-8} y={yScale(tick)} textAnchor="end" dominantBaseline="middle" fontSize={11} fill="#9ca3af">
              {formatAxisTick(tick)}
            </text>
          ))}

          {/* X-axis labels */}
          {xTicks.map((label) => (
            <text
              key={`xt-${label}`}
              x={(xScale(label) ?? 0) + xScale.bandwidth() / 2}
              y={chartHeight + 20}
              textAnchor="middle"
              fontSize={11}
              fill="#9ca3af"
            >
              {label}
            </text>
          ))}

          {/* Bars */}
          {data.map((d) =>
            visibleKeys.map((key, ki) => {
              const val = d[key];
              if (typeof val !== 'number') return null;
              const barX = (xScale(d.date) ?? 0) + (xSubScale(key) ?? 0);
              const barY = yScale(Math.max(0, val));
              const barHeight = Math.abs(yScale(val) - yScale(0));
              const barWidth = xSubScale.bandwidth();
              const color = GROUPED_COLORS[key] ?? getSeriesColor(ki);
              const barKey = `${d.date}-${key}`;

              return (
                <rect
                  key={barKey}
                  x={barX}
                  y={barY}
                  width={barWidth}
                  height={Math.max(0, barHeight)}
                  rx={4}
                  fill={color}
                  opacity={hoveredBar !== null && hoveredBar !== barKey ? 0.4 : 0.9}
                  style={{ cursor: 'pointer', transition: 'opacity 0.2s ease' }}
                  onMouseMove={(e) =>
                    onBarHover(e, barKey, (
                      <div>
                        <div style={{ fontWeight: 600, marginBottom: 2 }}>{d.date}</div>
                        <div style={{ color }}>{key}: {formatCurrencyFull(val, currency)}</div>
                      </div>
                    ))
                  }
                  onMouseLeave={onBarLeave}
                />
              );
            })
          )}
        </g>
      </svg>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 16, paddingLeft: margin.left, paddingTop: 4, fontSize: 11, opacity: 0.6 }}>
        {seriesKeys.map((key, i) => (
          <div
            key={key}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              cursor: 'pointer',
              opacity: hiddenSeries.has(key) ? 0.3 : 1,
            }}
            onClick={() => onLegendClick(key)}
          >
            <div style={{ width: 12, height: 12, borderRadius: 2, backgroundColor: GROUPED_COLORS[key] ?? getSeriesColor(i) }} />
            <span>{key}</span>
          </div>
        ))}
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Stacked Bar Chart (budget vs actual)
// ---------------------------------------------------------------------------

interface StackedBarProps {
  data: Array<{ month: string; [key: string]: string | number }>;
  budgets: Budget[];
  width: number;
  height: number;
  currency: string;
  hiddenSeries: Set<string>;
  onLegendClick: (key: string) => void;
  hoveredBar: string | null;
  onBarHover: (event: React.MouseEvent, key: string, content: React.ReactNode) => void;
  onBarLeave: () => void;
}

function StackedBarChart({
  data,
  budgets,
  width,
  height,
  currency,
  hiddenSeries,
  onLegendClick,
  hoveredBar,
  onBarHover,
  onBarLeave,
}: StackedBarProps): React.JSX.Element {
  const margin = MARGIN_GROUPED;
  const chartWidth = width - margin.left - margin.right;
  const chartHeight = height - margin.top - margin.bottom;

  const budgetCategories = useMemo(
    () => budgets.filter((b) => b.categoryId),
    [budgets]
  );

  const xScale = useMemo(
    () =>
      d3
        .scaleBand()
        .domain(data.map((d) => d.month))
        .range([0, chartWidth])
        .padding(0.3),
    [data, chartWidth]
  );

  const yScale = useMemo(() => {
    const allVals: number[] = [];
    for (const d of data) {
      for (const key of Object.keys(d)) {
        if (key !== 'month' && typeof d[key] === 'number') {
          allVals.push(d[key]);
        }
      }
    }
    if (allVals.length === 0) return d3.scaleLinear().domain([0, 100]).range([chartHeight, 0]);
    const maxVal = d3.max(allVals) ?? 100;
    return d3.scaleLinear().domain([0, maxVal * 1.1]).range([chartHeight, 0]).nice();
  }, [data, chartHeight]);

  const yTicks = yScale.ticks(5);
  const barGroupWidth = xScale.bandwidth() / 2;

  if (chartWidth <= 0 || chartHeight <= 0 || data.length === 0) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', flexDirection: 'column', gap: 8 }}>
        <span style={{ fontSize: 14, color: '#9ca3af' }}>No budget data available for the selected period</span>
        <span style={{ fontSize: 12, color: '#9ca3af', opacity: 0.7 }}>Create budgets and add expense transactions to see budget vs actual comparison</span>
      </div>
    );
  }

  return (
    <>
      <svg width={width} height={height} style={{ display: 'block' }}>
        <g transform={`translate(${margin.left},${margin.top})`}>
          {yTicks.map((tick) => (
            <line key={`grid-${tick}`} x1={0} x2={chartWidth} y1={yScale(tick)} y2={yScale(tick)} stroke="#e5e7eb" strokeDasharray="3 3" strokeOpacity={0.5} />
          ))}
          {yTicks.map((tick) => (
            <text key={`yt-${tick}`} x={-8} y={yScale(tick)} textAnchor="end" dominantBaseline="middle" fontSize={11} fill="#9ca3af">
              {formatAxisTick(tick)}
            </text>
          ))}
          {data.map((d) => (
            <text
              key={`xt-${d.month}`}
              x={(xScale(d.month) ?? 0) + xScale.bandwidth() / 2}
              y={chartHeight + 20}
              textAnchor="middle"
              fontSize={11}
              fill="#9ca3af"
            >
              {d.month}
            </text>
          ))}

          {data.map((d) => {
            const x0 = xScale(d.month) ?? 0;
            return budgetCategories.map((budget, idx) => {
              const catName = budget.category?.name ?? 'Uncategorized';
              const budgetKey = `${catName}_budget`;
              const actualKey = `${catName}_actual`;
              const budgetVal = typeof d[budgetKey] === 'number' ? (d[budgetKey]) : 0;
              const actualVal = typeof d[actualKey] === 'number' ? (d[actualKey]) : 0;
              const budgetColor = getSeriesColor(idx * 2);
              const actualColor = getSeriesColor(idx * 2 + 1);

              return (
                <React.Fragment key={`${d.month}-${budget.id}`}>
                  {!hiddenSeries.has(budgetKey) && budgetVal > 0 && (
                    <rect
                      x={x0}
                      y={yScale(budgetVal)}
                      width={barGroupWidth}
                      height={Math.max(0, chartHeight - yScale(budgetVal))}
                      fill={budgetColor}
                      opacity={hoveredBar !== null && hoveredBar !== `${d.month}-${budgetKey}` ? 0.3 : 0.9}
                      style={{ cursor: 'pointer', transition: 'opacity 0.2s ease' }}
                      onMouseMove={(e) =>
                        onBarHover(e, `${d.month}-${budgetKey}`, (
                          <div>
                            <div style={{ fontWeight: 600, marginBottom: 2 }}>{d.month}</div>
                            <div>{catName} (Budget): {formatCurrencyFull(budgetVal, currency)}</div>
                          </div>
                        ))
                      }
                      onMouseLeave={onBarLeave}
                    />
                  )}
                  {!hiddenSeries.has(actualKey) && actualVal > 0 && (
                    <rect
                      x={x0 + barGroupWidth}
                      y={yScale(actualVal)}
                      width={barGroupWidth}
                      height={Math.max(0, chartHeight - yScale(actualVal))}
                      rx={4}
                      fill={actualColor}
                      opacity={hoveredBar !== null && hoveredBar !== `${d.month}-${actualKey}` ? 0.3 : 0.9}
                      style={{ cursor: 'pointer', transition: 'opacity 0.2s ease' }}
                      onMouseMove={(e) =>
                        onBarHover(e, `${d.month}-${actualKey}`, (
                          <div>
                            <div style={{ fontWeight: 600, marginBottom: 2 }}>{d.month}</div>
                            <div>{catName} (Actual): {formatCurrencyFull(actualVal, currency)}</div>
                          </div>
                        ))
                      }
                      onMouseLeave={onBarLeave}
                    />
                  )}
                </React.Fragment>
              );
            });
          })}
        </g>
      </svg>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 12, paddingLeft: margin.left, paddingTop: 4, fontSize: 11, opacity: 0.6, flexWrap: 'wrap' }}>
        {budgetCategories.map((budget, idx) => {
          const catName = budget.category?.name ?? 'Uncategorized';
          const budgetKey = `${catName}_budget`;
          const actualKey = `${catName}_actual`;
          return (
            <React.Fragment key={budget.id}>
              <div
                style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', opacity: hiddenSeries.has(budgetKey) ? 0.3 : 1 }}
                onClick={() => onLegendClick(budgetKey)}
              >
                <div style={{ width: 12, height: 12, borderRadius: 2, backgroundColor: getSeriesColor(idx * 2) }} />
                <span>{catName} (Budget)</span>
              </div>
              <div
                style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', opacity: hiddenSeries.has(actualKey) ? 0.3 : 1 }}
                onClick={() => onLegendClick(actualKey)}
              >
                <div style={{ width: 12, height: 12, borderRadius: 2, backgroundColor: getSeriesColor(idx * 2 + 1) }} />
                <span>{catName} (Actual)</span>
              </div>
            </React.Fragment>
          );
        })}
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Horizontal Bar Chart (category breakdown)
// ---------------------------------------------------------------------------

interface HorizontalBarProps {
  data: Array<{ name: string; value: number }>;
  width: number;
  height: number;
  currency: string;
  hiddenSeries: Set<string>;
  hoveredBar: string | null;
  onBarHover: (event: React.MouseEvent, key: string, content: React.ReactNode) => void;
  onBarLeave: () => void;
}

function HorizontalBarChart({
  data,
  width,
  height,
  currency,
  hiddenSeries,
  hoveredBar,
  onBarHover,
  onBarLeave,
}: HorizontalBarProps): React.JSX.Element {
  const margin = MARGIN_HORIZONTAL;
  const chartWidth = width - margin.left - margin.right;
  const chartHeight = height - margin.top - margin.bottom;

  const visibleData = useMemo(
    () => data.filter((d) => !hiddenSeries.has(d.name)),
    [data, hiddenSeries]
  );

  const yScale = useMemo(
    () =>
      d3
        .scaleBand()
        .domain(visibleData.map((d) => d.name))
        .range([0, chartHeight])
        .padding(0.25),
    [visibleData, chartHeight]
  );

  const xScale = useMemo(() => {
    const maxVal = d3.max(visibleData, (d) => d.value) ?? 100;
    return d3.scaleLinear().domain([0, maxVal * 1.05]).range([0, chartWidth]).nice();
  }, [visibleData, chartWidth]);

  const xTicks = xScale.ticks(5);

  if (chartWidth <= 0 || chartHeight <= 0) return <div />;

  return (
    <svg width={width} height={height} style={{ display: 'block' }}>
      <g transform={`translate(${margin.left},${margin.top})`}>
        {/* Vertical grid */}
        {xTicks.map((tick) => (
          <line key={`grid-${tick}`} x1={xScale(tick)} x2={xScale(tick)} y1={0} y2={chartHeight} stroke="#e5e7eb" strokeDasharray="3 3" strokeOpacity={0.5} />
        ))}

        {/* X-axis labels */}
        {xTicks.map((tick) => (
          <text key={`xt-${tick}`} x={xScale(tick)} y={chartHeight + 20} textAnchor="middle" fontSize={11} fill="#9ca3af">
            {formatAxisTick(tick)}
          </text>
        ))}

        {/* Y-axis labels (category names) */}
        {visibleData.map((d) => (
          <text
            key={`yt-${d.name}`}
            x={-8}
            y={(yScale(d.name) ?? 0) + yScale.bandwidth() / 2}
            textAnchor="end"
            dominantBaseline="middle"
            fontSize={11}
            fill="#9ca3af"
          >
            {d.name.length > 16 ? `${d.name.slice(0, 14)}...` : d.name}
          </text>
        ))}

        {/* Bars */}
        {visibleData.map((d, i) => {
          const barWidth = xScale(d.value);
          return (
            <rect
              key={d.name}
              x={0}
              y={yScale(d.name) ?? 0}
              width={Math.max(0, barWidth)}
              height={yScale.bandwidth()}
              rx={4}
              fill={getSeriesColor(i)}
              opacity={hoveredBar !== null && hoveredBar !== d.name ? 0.4 : 0.9}
              style={{ cursor: 'pointer', transition: 'opacity 0.2s ease' }}
              onMouseMove={(e) =>
                onBarHover(e, d.name, (
                  <div>
                    <div style={{ fontWeight: 600, marginBottom: 2 }}>{d.name}</div>
                    <div>{formatCurrencyFull(d.value, currency)}</div>
                  </div>
                ))
              }
              onMouseLeave={onBarLeave}
            />
          );
        })}
      </g>
    </svg>
  );
}
