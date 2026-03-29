/**
 * SankeyChart Component
 * D3-sankey-powered Sankey diagram for cash flow visualization.
 * Follows sure app's sankey_chart_controller.js patterns.
 *
 * Features:
 * - d3-sankey layout with dynamic node padding
 * - Gradient links (source-to-target color at 10% opacity)
 * - Rounded corner nodes (left for source, right for target)
 * - Two-line labels: name + currency value
 * - Label collision detection per column
 * - Hover: dim non-connected to 40%, reveal hidden labels
 * - Custom tooltip following cursor
 * - Responsive via ResizeObserver
 */

import React, { useMemo, useState, useCallback, useRef } from 'react';
import * as d3 from 'd3';
import { sankey, sankeyLinkHorizontal } from 'd3-sankey';
import type { SankeyNode as D3SankeyNode, SankeyGraph } from 'd3-sankey';
import { useResizeObserver } from './charts/useResizeObserver';
import { D3Tooltip } from './charts/D3Tooltip';
import { getCurrencySymbol } from './charts/chartUtils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Node data passed from the data layer */
export interface SankeyNodeData {
  name: string;
  value: number;
  percentage: number;
  color: string;
}

/** Link data passed from the data layer */
export interface SankeyLinkData {
  source: number;
  target: number;
  value: number;
  color: string;
  percentage: number;
}

/** Full chart data */
export interface SankeyChartData {
  nodes: SankeyNodeData[];
  links: SankeyLinkData[];
  currencySymbol: string;
}

/** Props */
interface SankeyChartProps {
  data: SankeyChartData;
  height: number;
  currency: string;
}

// ---------------------------------------------------------------------------
// Constants (from sure app)
// ---------------------------------------------------------------------------

const HOVER_OPACITY = 0.4;
const HOVER_FILTER = 'saturate(1.3) brightness(1.1)';
const EXTENT_MARGIN = 16;
const MIN_NODE_PADDING = 4;
const MAX_PADDING_RATIO = 0.4;
const CORNER_RADIUS = 8;
const NODE_WIDTH = 15;
const DEFAULT_NODE_PADDING = 20;
const MIN_LABEL_SPACING = 28;
const DEFAULT_COLOR = '#9E9E9E';

// ---------------------------------------------------------------------------
// Internal types for d3-sankey layout results
// ---------------------------------------------------------------------------

type SNode = D3SankeyNode<SankeyNodeData, SankeyLinkData>;
type SGraph = SankeyGraph<SankeyNodeData, SankeyLinkData>;

// ---------------------------------------------------------------------------
// Utility functions
// ---------------------------------------------------------------------------

/**
 * Resolve a D3 color with opacity. Handles hex colors.
 */
function colorWithOpacity(nodeColor: string, opacity = 0.1): string {
  const c = d3.color(nodeColor);
  if (c) {
    c.opacity = opacity;
    return c.formatRgb();
  }
  return nodeColor;
}

/**
 * Calculate dynamic node padding to prevent padding from dominating with many nodes.
 * Ported from sure app's calculateNodePadding.
 */
function calculateNodePadding(nodeCount: number, chartHeight: number): number {
  const availableHeight = chartHeight - EXTENT_MARGIN * 2;
  const maxPaddingTotal = availableHeight * MAX_PADDING_RATIO;
  const gaps = Math.max(nodeCount - 1, 1);
  const dynamicPadding = Math.min(DEFAULT_NODE_PADDING, Math.floor(maxPaddingTotal / gaps));
  return Math.max(MIN_NODE_PADDING, dynamicPadding);
}

/**
 * Build SVG path for a node rectangle with rounded corners.
 * Source nodes get left-rounded, target nodes get right-rounded.
 * Ported from sure app's nodePath.
 */
function buildNodePath(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  isSource: boolean,
  isTarget: boolean
): string {
  const h = y1 - y0;
  const r = Math.max(0, Math.min(CORNER_RADIUS, h / 2));

  if (h < r * 2) {
    return `M ${x0},${y0} L ${x1},${y0} L ${x1},${y1} L ${x0},${y1} Z`;
  }

  if (isSource) {
    return `M ${x0 + r},${y0} L ${x1},${y0} L ${x1},${y1} L ${x0 + r},${y1} Q ${x0},${y1} ${x0},${y1 - r} L ${x0},${y0 + r} Q ${x0},${y0} ${x0 + r},${y0} Z`;
  }

  if (isTarget) {
    return `M ${x0},${y0} L ${x1 - r},${y0} Q ${x1},${y0} ${x1},${y0 + r} L ${x1},${y1 - r} Q ${x1},${y1} ${x1 - r},${y1} L ${x0},${y1} Z`;
  }

  return `M ${x0},${y0} L ${x1},${y0} L ${x1},${y1} L ${x0},${y1} Z`;
}

/**
 * Calculate which labels should be hidden to prevent overlap.
 * Ported from sure app's calculateHiddenLabels.
 */
function calculateHiddenLabels(nodes: SNode[], chartHeight: number): Set<number> {
  const hidden = new Set<number>();
  const isLarge = chartHeight > 600;
  const minSpacing = isLarge ? MIN_LABEL_SPACING * 0.7 : MIN_LABEL_SPACING;

  // Group by depth (column)
  const columns = new Map<number, SNode[]>();
  for (const node of nodes) {
    const depth = node.depth ?? 0;
    if (!columns.has(depth)) columns.set(depth, []);
    columns.get(depth)!.push(node);
  }

  for (const columnNodes of columns.values()) {
    columnNodes.sort((a, b) => ((a.y0! + a.y1!) / 2) - ((b.y0! + b.y1!) / 2));

    let lastVisibleY = -Infinity;

    for (const node of columnNodes) {
      const nodeY = (node.y0! + node.y1!) / 2;
      const nodeHeight = node.y1! - node.y0!;

      if (isLarge && nodeHeight > minSpacing * 1.5) {
        lastVisibleY = nodeY;
      } else if (nodeY - lastVisibleY < minSpacing) {
        hidden.add(node.index!);
      } else {
        lastVisibleY = nodeY;
      }
    }
  }

  return hidden;
}

/**
 * Format currency with symbol.
 */
function formatCurrency(value: number, symbol: string): string {
  const formatted = Math.abs(value).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${value < 0 ? '-' : ''}${symbol}${formatted}`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * D3-sankey Sankey Chart component.
 */
export function SankeyChart({ data, height, currency }: SankeyChartProps): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);
  const { width: containerWidth } = useResizeObserver(containerRef);

  const [hoveredElement, setHoveredElement] = useState<{ type: 'node' | 'link'; index: number } | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  const currencySymbol = data.currencySymbol || getCurrencySymbol(currency);

  // Compute sankey layout
  const layoutResult = useMemo<SGraph | null>(() => {
    if (!data.nodes.length || !data.links.length || containerWidth <= 0 || height <= 0) return null;

    const nodePadding = calculateNodePadding(data.nodes.length, height);

    const sankeyGen = sankey<SankeyNodeData, SankeyLinkData>()
      .nodeWidth(NODE_WIDTH)
      .nodePadding(nodePadding)
      .extent([
        [EXTENT_MARGIN, EXTENT_MARGIN],
        [containerWidth - EXTENT_MARGIN, height - EXTENT_MARGIN],
      ]);

    try {
      return sankeyGen({
        nodes: data.nodes.map((d) => ({ ...d })),
        links: data.links.map((d) => ({ ...d })),
      });
    } catch {
      return null;
    }
  }, [data, containerWidth, height]);

  // Hidden labels
  const hiddenLabels = useMemo(() => {
    if (!layoutResult) return new Set<number>();
    return calculateHiddenLabels(layoutResult.nodes, height);
  }, [layoutResult, height]);

  // Connected elements for hover highlighting
  const hoverConnected = useMemo(() => {
    if (!hoveredElement || !layoutResult) return { links: new Set<number>(), nodes: new Set<number>() };

    const connLinks = new Set<number>();
    const connNodes = new Set<number>();

    if (hoveredElement.type === 'link') {
      connLinks.add(hoveredElement.index);
      const link = layoutResult.links[hoveredElement.index];
      if (link) {
        const srcNode = link.source as SNode;
        const tgtNode = link.target as SNode;
        if (srcNode.index !== undefined) connNodes.add(srcNode.index);
        if (tgtNode.index !== undefined) connNodes.add(tgtNode.index);
      }
    } else {
      connNodes.add(hoveredElement.index);
      for (let i = 0; i < layoutResult.links.length; i++) {
        const link = layoutResult.links[i];
        if (!link) continue;
        const srcNode = link.source as SNode;
        const tgtNode = link.target as SNode;
        if (srcNode.index === hoveredElement.index || tgtNode.index === hoveredElement.index) {
          connLinks.add(i);
          if (srcNode.index !== undefined) connNodes.add(srcNode.index);
          if (tgtNode.index !== undefined) connNodes.add(tgtNode.index);
        }
      }
    }

    return { links: connLinks, nodes: connNodes };
  }, [hoveredElement, layoutResult]);

  // Link path generator
  const linkPathGen = useMemo(() => sankeyLinkHorizontal(), []);

  // Tooltip content
  const tooltipContent = useMemo(() => {
    if (!hoveredElement || !layoutResult) return null;

    if (hoveredElement.type === 'node') {
      const node = layoutResult.nodes[hoveredElement.index];
      if (!node) return null;
      return (
        <div>
          <div style={{ fontWeight: 600, marginBottom: 2 }}>{node.name}</div>
          <div>{formatCurrency(node.value ?? 0, currencySymbol)} ({node.percentage ?? 0}%)</div>
        </div>
      );
    }

    const link = layoutResult.links[hoveredElement.index];
    if (!link) return null;
    const percentage = (link as unknown as SankeyLinkData).percentage ?? 0;
    return (
      <div>
        {formatCurrency(link.value ?? 0, currencySymbol)} ({percentage}%)
      </div>
    );
  }, [hoveredElement, layoutResult, currencySymbol]);

  // Handlers
  const handleNodeEnter = useCallback((event: React.MouseEvent, nodeIndex: number) => {
    setHoveredElement({ type: 'node', index: nodeIndex });
    setTooltipPos({ x: event.pageX, y: event.pageY });
  }, []);

  const handleLinkEnter = useCallback((event: React.MouseEvent, linkIndex: number) => {
    setHoveredElement({ type: 'link', index: linkIndex });
    setTooltipPos({ x: event.pageX, y: event.pageY });
  }, []);

  const handleMouseMove = useCallback((event: React.MouseEvent) => {
    setTooltipPos({ x: event.pageX, y: event.pageY });
  }, []);

  const handleMouseLeave = useCallback(() => {
    setHoveredElement(null);
  }, []);

  if (containerWidth <= 0 || !layoutResult) {
    return <div ref={containerRef} style={{ width: '100%', height }} />;
  }

  const isHovering = hoveredElement !== null;

  return (
    <div ref={containerRef} style={{ width: '100%', height, position: 'relative' }}>
      <svg width={containerWidth} height={height} style={{ display: 'block' }}>
        {/* Gradient definitions for links */}
        <defs>
          {layoutResult.links.map((link, i) => {
            const srcNode = link.source as SNode;
            const tgtNode = link.target as SNode;
            const srcColor = srcNode.color || DEFAULT_COLOR;
            const tgtColor = tgtNode.color || DEFAULT_COLOR;
            return (
              <linearGradient
                key={`link-grad-${i}`}
                id={`sankey-link-grad-${i}`}
                gradientUnits="userSpaceOnUse"
                x1={srcNode.x1}
                x2={tgtNode.x0}
              >
                <stop offset="0%" stopColor={colorWithOpacity(srcColor, 0.1)} />
                <stop offset="100%" stopColor={colorWithOpacity(tgtColor, 0.1)} />
              </linearGradient>
            );
          })}
        </defs>

        {/* Links */}
        <g fill="none">
          {layoutResult.links.map((link, i) => {
            const isConnected = hoverConnected.links.has(i);
            const opacity = isHovering ? (isConnected ? 1 : HOVER_OPACITY) : 1;
            const filter = isHovering && isConnected ? HOVER_FILTER : 'none';

            return (
              <path
                key={`link-${i}`}
                d={linkPathGen(link as never) ?? ''}
                stroke={`url(#sankey-link-grad-${i})`}
                strokeWidth={Math.max(1, link.width ?? 1)}
                opacity={opacity}
                filter={filter}
                style={{ transition: 'opacity 0.3s ease', cursor: 'default' }}
                onMouseEnter={(e) => handleLinkEnter(e, i)}
                onMouseMove={handleMouseMove}
                onMouseLeave={handleMouseLeave}
              />
            );
          })}
        </g>

        {/* Nodes */}
        <g>
          {layoutResult.nodes.map((node) => {
            const nodeIdx = node.index ?? 0;
            const isSource = (node.sourceLinks?.length ?? 0) > 0 && (node.targetLinks?.length ?? 0) === 0;
            const isTarget = (node.targetLinks?.length ?? 0) > 0 && (node.sourceLinks?.length ?? 0) === 0;
            const isConnected = hoverConnected.nodes.has(nodeIdx);
            const nodeOpacity = isHovering ? (isConnected ? 1 : HOVER_OPACITY) : 1;

            const x0 = node.x0 ?? 0;
            const y0 = node.y0 ?? 0;
            const x1 = node.x1 ?? 0;
            const y1 = node.y1 ?? 0;
            const color = node.color || DEFAULT_COLOR;

            // Label positioning (left of node or right, based on position)
            const isLeftSide = x0 < containerWidth / 2;
            const labelX = isLeftSide ? x1 + 6 : x0 - 6;
            const labelAnchor = isLeftSide ? 'start' : 'end';
            const labelY = (y0 + y1) / 2;

            // Label visibility
            const isLabelHidden = hiddenLabels.has(nodeIdx);
            const showLabel = isHovering
              ? isConnected ? true : !isLabelHidden
              : !isLabelHidden;
            const labelOpacity = isHovering
              ? (isConnected ? 1 : (isLabelHidden ? 0 : HOVER_OPACITY))
              : (isLabelHidden ? 0 : 1);

            return (
              <g
                key={`node-${nodeIdx}`}
                style={{ transition: 'opacity 0.3s ease' }}
                opacity={nodeOpacity}
              >
                {/* Node rectangle with rounded corners */}
                <path
                  d={buildNodePath(x0, y0, x1, y1, isSource, isTarget)}
                  fill={color}
                  stroke="none"
                  style={{ cursor: 'default' }}
                  onMouseEnter={(e) => handleNodeEnter(e, nodeIdx)}
                  onMouseMove={handleMouseMove}
                  onMouseLeave={handleMouseLeave}
                />

                {/* Label: name + currency value */}
                {showLabel ? <text
                    x={labelX}
                    y={labelY}
                    textAnchor={labelAnchor}
                    dy="-0.2em"
                    style={{
                      opacity: labelOpacity,
                      transition: 'opacity 0.2s ease',
                      pointerEvents: 'none',
                      userSelect: 'none',
                    }}
                  >
                    <tspan
                      fontSize={12}
                      fontWeight={500}
                      fill="currentColor"
                    >
                      {node.name}
                    </tspan>
                    <tspan
                      x={labelX}
                      dy="1.2em"
                      fontSize={10.4}
                      fontFamily="monospace"
                      fill="#737373"
                    >
                      {formatCurrency(node.value ?? 0, currencySymbol)}
                    </tspan>
                  </text> : null}
              </g>
            );
          })}
        </g>
      </svg>

      <D3Tooltip
        visible={hoveredElement !== null}
        x={tooltipPos.x}
        y={tooltipPos.y}
        content={tooltipContent}
      />
    </div>
  );
}
