/**
 * Sankey Chart Component
 * Custom SVG-based Sankey diagram for cash flow visualization
 */

import React, {useMemo} from 'react';
import {Box, useTheme} from '@mui/material';

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
 * Calculate Sankey layout
 */
function calculateLayout(
  nodeLabels: string[],
  linkSources: number[],
  linkTargets: number[],
  linkValues: number[],
  _width: number,
  height: number,
): SankeyData {
  const columnCount = 4; // Earnings, Budget, Categories, Spendings
  const nodePadding = 10;
  const minNodeHeight = 20;

  // Calculate node values
  const nodeValues = new Map<number, number>();
  for (let i = 0; i < linkSources.length; i++) {
    const source = linkSources[i] ?? 0;
    const target = linkTargets[i] ?? 0;
    const value = linkValues[i] ?? 0;

    nodeValues.set(source, (nodeValues.get(source) ?? 0) + value);
    nodeValues.set(target, (nodeValues.get(target) ?? 0) + value);
  }

  // Group nodes by column
  const nodesByColumn: Map<number, Array<{index: number; value: number; label: string}>> = new Map();

  // Determine column for each node based on its position in the array
  // This is a simplified approach - in a real implementation, you'd analyze the graph structure
  const totalNodes = nodeLabels.length;
  const nodesPerColumn = Math.ceil(totalNodes / columnCount);

  for (let i = 0; i < nodeLabels.length; i++) {
    let column = Math.floor(i / nodesPerColumn);
    if (column >= columnCount) {
      column = columnCount - 1;
    }

    if (!nodesByColumn.has(column)) {
      nodesByColumn.set(column, []);
    }
    const label = nodeLabels[i];
    if (label) {
    const nodeValue = nodeValues.get(i);
    if (nodeValue !== undefined) {
      nodesByColumn.get(column)!.push({
        index: i,
        value: nodeValue,
        label,
      });
    } else {
      nodesByColumn.get(column)!.push({
        index: i,
        value: 0,
        label,
      });
    }
    }
  }

  // Calculate positions for each column
  const nodes: SankeyNode[] = [];

  for (let col = 0; col < columnCount; col++) {
    const columnNodes = nodesByColumn.get(col) ?? [];
    const totalValue = columnNodes.reduce((sum, n) => sum + n.value, 0);
    const totalHeight = Math.max(totalValue, minNodeHeight * columnNodes.length);
    const scale = totalHeight > 0 ? (height - nodePadding * (columnNodes.length + 1)) / totalHeight : 1;

    let currentY = (height - totalHeight * scale) / 2;

    for (const nodeData of columnNodes) {
      const nodeHeight = Math.max(nodeData.value * scale, minNodeHeight);
      nodes.push({
        id: `node-${nodeData.index}`,
        label: nodeData.label,
        value: nodeData.value,
        column: col,
        y: currentY,
        height: nodeHeight,
      });
      currentY += nodeHeight + nodePadding;
    }
  }

  // Create links
  const nodeMap = new Map(nodes.map((n, idx) => [idx, n]));
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

  return {nodes, links};
}

/**
 * Generate SVG path for Sankey link
 */
function generateLinkPath(
  sourceX: number,
  sourceY: number,
  sourceHeight: number,
  targetX: number,
  targetY: number,
  targetHeight: number,
): string {
  const dx = targetX - sourceX;
  const curvature = 0.5;

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
 * Sankey Chart Component
 */
export function SankeyChart({data, width = 800, height = 600}: SankeyChartProps): React.JSX.Element {
  const theme = useTheme();

  const sankeyData = useMemo(() => {
    return calculateLayout(
      data.node.label,
      data.link.source.map((s) => s ?? 0),
      data.link.target.map((t) => t ?? 0),
      data.link.value.map((v) => v ?? 0),
      width,
      height,
    );
  }, [data, width, height]);

  const columnWidth = width / 5;
  const nodeWidth = 20;

  return (
    <Box sx={{width: '100%', height, overflow: 'auto'}}>
      <svg width={width} height={height} style={{display: 'block'}}>
        <defs>
          <linearGradient id="linkGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={theme.palette.primary.main} stopOpacity={0.6} />
            <stop offset="100%" stopColor={theme.palette.secondary.main} stopOpacity={0.6} />
          </linearGradient>
        </defs>

        {/* Render links */}
        {sankeyData.links.map((link, idx) => {
          const sourceX = link.sourceNode.column * columnWidth + columnWidth - nodeWidth;
          const targetX = link.targetNode.column * columnWidth + columnWidth;
          const path = generateLinkPath(
            sourceX,
            link.sourceNode.y,
            link.sourceNode.height,
            targetX,
            link.targetNode.y,
            link.targetNode.height,
          );

          return (
            <path
              key={`link-${idx}`}
              d={path}
              fill="url(#linkGradient)"
              stroke={theme.palette.divider}
              strokeWidth={1}
              opacity={0.6}
            />
          );
        })}

        {/* Render nodes */}
        {sankeyData.nodes.map((node) => {
          const x = node.column * columnWidth + columnWidth - nodeWidth;
          return (
            <g key={node.id}>
              <rect
                x={x}
                y={node.y}
                width={nodeWidth}
                height={node.height}
                fill={theme.palette.primary.main}
                stroke={theme.palette.divider}
                strokeWidth={1}
                rx={2}
              />
              <text
                x={node.column === 0 ? x - 5 : x + nodeWidth + 5}
                y={node.y + node.height / 2}
                textAnchor={node.column === 0 ? 'end' : 'start'}
                dominantBaseline="middle"
                fontSize={11}
                fill={theme.palette.text.primary}
                style={{pointerEvents: 'none'}}
              >
                {node.label}
              </text>
            </g>
          );
        })}
      </svg>
    </Box>
  );
}

