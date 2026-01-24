/**
 * Sankey Chart Component
 * Custom SVG-based Sankey diagram for cash flow visualization
 * Refactored with proper graph analysis, interactive tooltips, and improved visual design
 */

import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { Box, Tooltip, Typography, useTheme } from '@mui/material';
import type { Theme } from '@mui/material/styles';
import { formatCurrencyPreserveDecimals } from '../utils/formatting';

/**
 * Sankey node data
 */
interface SankeyNode {
  id: string;
  label: string;
  value: number;
  column: number;
  y: number;
  height: number;
  x: number;
  width: number;
}

/**
 * Sankey link data
 */
interface SankeyLink {
  source: string;
  target: string;
  value: number;
  sourceNode: SankeyNode;
  targetNode: SankeyNode;
}

/**
 * Sankey chart data
 */
interface SankeyData {
  nodes: SankeyNode[];
  links: SankeyLink[];
}

/**
 * Sankey chart props
 */
interface SankeyChartProps {
  data: {
    node: {
      label: string[];
      pad?: number;
      thickness?: number;
    };
    link: {
      source: number[];
      target: number[];
      value: number[];
    };
  };
  width?: number;
  height?: number;
  currency?: string;
}

/**
 * Analyze graph structure to determine node columns
 * Uses topological sorting to assign nodes to columns based on their position in the flow
 */
function analyzeGraphStructure(
  nodeLabels: string[],
  linkSources: number[],
  linkTargets: number[]
): Map<number, number> {
  const columnMap = new Map<number, number>();
  const inDegree = new Map<number, number>();
  const outDegree = new Map<number, number>();
  const outgoingLinks = new Map<number, number[]>();
  const incomingLinks = new Map<number, number[]>();

  // Initialize maps
  for (let i = 0; i < nodeLabels.length; i++) {
    inDegree.set(i, 0);
    outDegree.set(i, 0);
    outgoingLinks.set(i, []);
    incomingLinks.set(i, []);
  }

  // Build graph structure
  for (let i = 0; i < linkSources.length; i++) {
    const source = linkSources[i] ?? 0;
    const target = linkTargets[i] ?? 0;

    inDegree.set(target, (inDegree.get(target) ?? 0) + 1);
    outDegree.set(source, (outDegree.get(source) ?? 0) + 1);

    outgoingLinks.get(source)!.push(target);
    incomingLinks.get(target)!.push(source);
  }

  // Find source nodes (nodes with no incoming links) - these are column 0
  const sourceNodes: number[] = [];
  for (let i = 0; i < nodeLabels.length; i++) {
    if ((inDegree.get(i) ?? 0) === 0) {
      sourceNodes.push(i);
      columnMap.set(i, 0);
    }
  }

  // BFS to assign columns
  const visited = new Set<number>();
  const queue: Array<{ node: number; column: number }> = sourceNodes.map((node) => ({
    node,
    column: 0,
  }));

  while (queue.length > 0) {
    const { node, column } = queue.shift()!;
    if (visited.has(node)) {
      continue;
    }
    visited.add(node);

    const currentColumn = columnMap.get(node) ?? 0;
    columnMap.set(node, Math.max(currentColumn, column));

    // Process outgoing links
    const targets = outgoingLinks.get(node) ?? [];
    for (const target of targets) {
      if (!visited.has(target)) {
        const targetColumn = Math.max(columnMap.get(target) ?? 0, column + 1);
        columnMap.set(target, targetColumn);
        queue.push({ node: target, column: column + 1 });
      }
    }
  }

  // Handle any unvisited nodes (isolated nodes)
  for (let i = 0; i < nodeLabels.length; i++) {
    if (!columnMap.has(i)) {
      // Assign to last column if it has no outgoing links, otherwise find max column
      const maxColumn = Math.max(...Array.from(columnMap.values()), 0);
      columnMap.set(i, (outDegree.get(i) ?? 0) === 0 ? maxColumn + 1 : maxColumn);
    }
  }

  return columnMap;
}

/**
 * Calculate Sankey layout with proper graph analysis
 */
function calculateLayout(
  nodeLabels: string[],
  linkSources: number[],
  linkTargets: number[],
  linkValues: number[],
  width: number,
  height: number
): SankeyData {
  const nodePadding = 8;
  const minNodeHeight = 24;
  const nodeWidth = 24;
  const columnPadding = 40;

  // Analyze graph structure to determine columns
  const columnMap = analyzeGraphStructure(nodeLabels, linkSources, linkTargets);
  const maxColumn = Math.max(...Array.from(columnMap.values()), 0);
  const columnCount = maxColumn + 1;

  // Calculate node values
  const nodeValues = new Map<number, number>();
  for (let i = 0; i < linkSources.length; i++) {
    const source = linkSources[i] ?? 0;
    const target = linkTargets[i] ?? 0;
    const value = linkValues[i] ?? 0;

    // For source nodes, accumulate outgoing values
    // For target nodes, accumulate incoming values
    nodeValues.set(source, (nodeValues.get(source) ?? 0) + value);
    nodeValues.set(target, (nodeValues.get(target) ?? 0) + value);
  }

  // Group nodes by column
  const nodesByColumn: Map<
    number,
    Array<{ index: number; value: number; label: string }>
  > = new Map();

  for (let i = 0; i < nodeLabels.length; i++) {
    const column = columnMap.get(i) ?? 0;
    if (!nodesByColumn.has(column)) {
      nodesByColumn.set(column, []);
    }
    const label = nodeLabels[i];
    if (label) {
      const nodeValue = nodeValues.get(i) ?? 0;
      nodesByColumn.get(column)!.push({
        index: i,
        value: nodeValue,
        label,
      });
    }
  }

  // Calculate column width
  const availableWidth = width - (columnCount - 1) * columnPadding;
  const columnWidth = availableWidth / columnCount;

  // Calculate positions for each column
  const nodes: SankeyNode[] = [];

  for (let col = 0; col < columnCount; col++) {
    const columnNodes = nodesByColumn.get(col) ?? [];

    // Sort nodes by value (largest first) for better visual hierarchy
    columnNodes.sort((a, b) => b.value - a.value);

    const totalValue = columnNodes.reduce((sum, n) => sum + n.value, 0);
    const minTotalHeight =
      minNodeHeight * columnNodes.length + nodePadding * (columnNodes.length - 1);
    const totalHeight = Math.max(totalValue, minTotalHeight);
    const scale =
      totalHeight > 0 ? (height - nodePadding * (columnNodes.length + 1)) / totalHeight : 1;

    let currentY = nodePadding;

    for (const nodeData of columnNodes) {
      const nodeHeight = Math.max(nodeData.value * scale, minNodeHeight);
      const x = col * (columnWidth + columnPadding) + (columnWidth - nodeWidth) / 2;

      nodes.push({
        id: `node-${nodeData.index}`,
        label: nodeData.label,
        value: nodeData.value,
        column: col,
        y: currentY,
        height: nodeHeight,
        x,
        width: nodeWidth,
      });
      currentY += nodeHeight + nodePadding;
    }
  }

  // Create links
  const nodeMap = new Map(
    nodes.map((n) => {
      const match = n.id.match(/node-(\d+)/);
      const index = match ? parseInt(match[1] ?? '0', 10) : 0;
      return [index, n];
    })
  );
  const links: SankeyLink[] = [];

  for (let i = 0; i < linkSources.length; i++) {
    const sourceIdx = linkSources[i] ?? 0;
    const targetIdx = linkTargets[i] ?? 0;
    const value = linkValues[i] ?? 0;

    const sourceNode = nodeMap.get(sourceIdx);
    const targetNode = nodeMap.get(targetIdx);

    if (sourceNode && targetNode) {
      links.push({
        source: `node-${sourceIdx}`,
        target: `node-${targetIdx}`,
        value,
        sourceNode,
        targetNode,
      });
    }
  }

  return { nodes, links };
}

/**
 * Generate SVG path for Sankey link with smooth curves
 */
function generateLinkPath(
  sourceX: number,
  sourceY: number,
  sourceHeight: number,
  targetX: number,
  targetY: number,
  targetHeight: number
): string {
  const dx = targetX - sourceX;
  const curvature = 0.4;

  const cp1x = sourceX + dx * curvature;
  const cp2x = sourceX + dx * (1 - curvature);

  return `M ${sourceX} ${sourceY}
          L ${sourceX} ${sourceY + sourceHeight}
          C ${cp1x} ${sourceY + sourceHeight} ${cp2x} ${targetY + targetHeight} ${targetX} ${targetY + targetHeight}
          L ${targetX} ${targetY}
          C ${cp2x} ${targetY} ${cp1x} ${sourceY} ${sourceX} ${sourceY}
          Z`;
}

/**
 * Truncate label to fit available space
 */
function truncateLabel(label: string, maxLength: number): string {
  if (label.length <= maxLength) {
    return label;
  }
  return `${label.slice(0, maxLength - 3)}...`;
}

/**
 * Get color for node based on column and value
 */
function getNodeColor(column: number, maxColumn: number, theme: Theme): string {
  // Income flow (early columns) - green shades
  if (column === 0) {
    return theme.palette.success.main;
  }
  // Budget node (middle) - primary color
  if (column === Math.floor(maxColumn / 2)) {
    return theme.palette.primary.main;
  }
  // Expense flow (later columns) - red/orange shades
  if (column > maxColumn / 2) {
    return theme.palette.error.main;
  }
  // Default - secondary
  return theme.palette.secondary.main;
}

/**
 * Get color for link based on source and target columns
 */
function getLinkColor(
  sourceColumn: number,
  targetColumn: number,
  maxColumn: number,
  theme: Theme
): string {
  // Income flow
  if (sourceColumn < maxColumn / 2 && targetColumn < maxColumn / 2) {
    return theme.palette.success.main;
  }
  // Expense flow
  if (sourceColumn > maxColumn / 2 || targetColumn > maxColumn / 2) {
    return theme.palette.error.main;
  }
  // Default
  return theme.palette.primary.main;
}

/**
 * Sankey Chart Component
 */
export function SankeyChart({
  data,
  width = 800,
  height = 600,
  currency = 'USD',
}: SankeyChartProps): React.JSX.Element {
  const theme = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(width);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [hoveredLink, setHoveredLink] = useState<number | null>(null);

  useEffect(() => {
    const updateWidth = (): void => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.offsetWidth);
      }
    };

    updateWidth();
    window.addEventListener('resize', updateWidth);
    return (): void => {
      window.removeEventListener('resize', updateWidth);
    };
  }, []);

  const chartWidth = containerWidth > 0 ? containerWidth : width;

  const sankeyData = useMemo(() => {
    return calculateLayout(
      data.node.label,
      data.link.source.map((s) => s ?? 0),
      data.link.target.map((t) => t ?? 0),
      data.link.value.map((v) => v ?? 0),
      chartWidth,
      height
    );
  }, [data, chartWidth, height]);

  const maxColumn = useMemo(() => {
    return Math.max(...sankeyData.nodes.map((n) => n.column), 0);
  }, [sankeyData.nodes]);

  const handleNodeMouseEnter = useCallback((nodeId: string) => {
    setHoveredNode(nodeId);
  }, []);

  const handleNodeMouseLeave = useCallback(() => {
    setHoveredNode(null);
  }, []);

  const handleLinkMouseEnter = useCallback((linkIndex: number) => {
    setHoveredLink(linkIndex);
  }, []);

  const handleLinkMouseLeave = useCallback(() => {
    setHoveredLink(null);
  }, []);

  // Calculate label position and max length
  const labelMaxLength = useMemo(() => {
    if (chartWidth < 600) {
      return 12;
    }
    if (chartWidth < 1000) {
      return 18;
    }
    return 25;
  }, [chartWidth]);

  return (
    <Box ref={containerRef} sx={{ width: '100%', height, position: 'relative' }}>
      <svg width={chartWidth} height={height} style={{ display: 'block' }}>
        <defs>
          <linearGradient id="linkGradientIncome" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={theme.palette.success.main} stopOpacity={0.4} />
            <stop offset="100%" stopColor={theme.palette.success.main} stopOpacity={0.6} />
          </linearGradient>
          <linearGradient id="linkGradientExpense" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={theme.palette.error.main} stopOpacity={0.4} />
            <stop offset="100%" stopColor={theme.palette.error.main} stopOpacity={0.6} />
          </linearGradient>
          <linearGradient id="linkGradientDefault" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={theme.palette.primary.main} stopOpacity={0.4} />
            <stop offset="100%" stopColor={theme.palette.primary.main} stopOpacity={0.6} />
          </linearGradient>
        </defs>

        {/* Render links */}
        {sankeyData.links.map((link, idx) => {
          const sourceX = link.sourceNode.x + link.sourceNode.width;
          const targetX = link.targetNode.x;
          const path = generateLinkPath(
            sourceX,
            link.sourceNode.y,
            link.sourceNode.height,
            targetX,
            link.targetNode.y,
            link.targetNode.height
          );

          const linkColor = getLinkColor(
            link.sourceNode.column,
            link.targetNode.column,
            maxColumn,
            theme
          );
          const isHovered =
            hoveredLink === idx || hoveredNode === link.source || hoveredNode === link.target;
          const gradientId =
            link.sourceNode.column < maxColumn / 2 && link.targetNode.column < maxColumn / 2
              ? 'linkGradientIncome'
              : link.sourceNode.column > maxColumn / 2 || link.targetNode.column > maxColumn / 2
                ? 'linkGradientExpense'
                : 'linkGradientDefault';

          return (
            <Tooltip
              key={`link-${idx}`}
              title={
                <Box>
                  <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
                    {link.sourceNode.label} → {link.targetNode.label}
                  </Typography>
                  <Typography variant="body2">
                    {formatCurrencyPreserveDecimals(link.value, currency)}
                  </Typography>
                </Box>
              }
              arrow
            >
              <path
                d={path}
                fill={`url(#${gradientId})`}
                stroke={linkColor}
                strokeWidth={isHovered ? 2 : 1}
                opacity={isHovered ? 0.8 : 0.5}
                style={{ cursor: 'pointer' }}
                onMouseEnter={() => handleLinkMouseEnter(idx)}
                onMouseLeave={handleLinkMouseLeave}
              />
            </Tooltip>
          );
        })}

        {/* Render nodes */}
        {sankeyData.nodes.map((node) => {
          const isHovered = hoveredNode === node.id;
          const nodeColor = getNodeColor(node.column, maxColumn, theme);
          const labelX = node.column === 0 ? node.x - 8 : node.x + node.width + 8;
          const labelAnchor = node.column === 0 ? 'end' : 'start';
          const truncatedLabel = truncateLabel(node.label, labelMaxLength);

          return (
            <Tooltip
              key={node.id}
              title={
                <Box>
                  <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
                    {node.label}
                  </Typography>
                  <Typography variant="body2">
                    {formatCurrencyPreserveDecimals(node.value, currency)}
                  </Typography>
                </Box>
              }
              arrow
            >
              <g
                onMouseEnter={() => handleNodeMouseEnter(node.id)}
                onMouseLeave={handleNodeMouseLeave}
                style={{ cursor: 'pointer' }}
              >
                <rect
                  x={node.x}
                  y={node.y}
                  width={node.width}
                  height={node.height}
                  fill={nodeColor}
                  stroke={isHovered ? theme.palette.text.primary : theme.palette.divider}
                  strokeWidth={isHovered ? 2 : 1}
                  rx={4}
                  opacity={isHovered ? 1 : 0.9}
                  style={{ transition: 'all 0.2s ease' }}
                />
                <text
                  x={labelX}
                  y={node.y + node.height / 2}
                  textAnchor={labelAnchor}
                  dominantBaseline="middle"
                  fontSize={12}
                  fill={theme.palette.text.primary}
                  fontWeight={isHovered ? 600 : 400}
                  style={{ pointerEvents: 'none', transition: 'font-weight 0.2s ease' }}
                >
                  {truncatedLabel}
                </text>
              </g>
            </Tooltip>
          );
        })}
      </svg>
    </Box>
  );
}
