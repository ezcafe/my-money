/**
 * Backspace Icon Component
 * Custom icon for backspace « symbol with larger size
 */

import React from 'react';
import {SvgIcon} from '@mui/material';
import type {SvgIconProps} from '@mui/material';

/**
 * Backspace Icon
 * Displays a left-pointing double angle quotation mark «
 */
export function BackspaceIcon(props: SvgIconProps): React.JSX.Element {
  return (
    <SvgIcon {...props} viewBox="0 0 24 24">
      {/* Left-pointing double angle quotation mark « */}
      <text
        x="12"
        y="16"
        textAnchor="middle"
        fontSize="16"
        fill="currentColor"
        fontFamily="Arial, sans-serif"
        fontWeight="bold"
      >
        «
      </text>
    </SvgIcon>
  );
}

