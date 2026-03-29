/**
 * D3Tooltip Component
 * Shared tooltip for D3 charts following sure app's tooltip pattern.
 * Absolute-positioned div, dark background, white text, follows cursor.
 */

import React from 'react';

/** Props for the D3Tooltip component */
interface D3TooltipProps {
  /** Whether the tooltip is visible */
  visible: boolean;
  /** X position (page coordinates) */
  x: number;
  /** Y position (page coordinates) */
  y: number;
  /** Tooltip content (HTML string or ReactNode) */
  content: React.ReactNode;
  /** Whether the tooltip is inside a dialog (uses fixed positioning) */
  inDialog?: boolean;
}

/**
 * Shared tooltip component for D3 charts.
 * Follows sure app's tooltip pattern: dark bg, white text, absolute positioned,
 * follows cursor with 10px offset, fade in/out transition.
 */
export function D3Tooltip({ visible, x, y, content, inDialog = false }: D3TooltipProps): React.JSX.Element {
  return (
    <div
      style={{
        position: inDialog ? 'fixed' : 'absolute',
        left: `${x + 10}px`,
        top: `${y - 10}px`,
        opacity: visible ? 1 : 0,
        pointerEvents: 'none',
        transition: 'opacity 100ms ease',
        zIndex: 50,
        backgroundColor: '#374151',
        color: '#ffffff',
        fontSize: '0.875rem',
        padding: '8px',
        borderRadius: '6px',
        whiteSpace: 'nowrap',
        maxWidth: '300px',
      }}
    >
      {content}
    </div>
  );
}
