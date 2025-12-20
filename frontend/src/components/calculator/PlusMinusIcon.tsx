/**
 * PlusMinus Icon Component
 * Custom icon matching iPhone calculator style for ± symbol
 */

import React from 'react';
import {SvgIcon} from '@mui/material';
import type {SvgIconProps} from '@mui/material';

/**
 * PlusMinus Icon
 * Displays a plus sign on top and minus sign on bottom, matching iPhone calculator style
 */
export function PlusMinusIcon(props: SvgIconProps): React.JSX.Element {
  return (
    <SvgIcon {...props} viewBox="0 0 24 24">
      {/* Plus sign on top - vertical line */}
      <path d="M12 6v6" stroke="currentColor" strokeWidth="1" strokeLinecap="round" fill="none" />
      {/* Plus sign on top - horizontal line */}
      <path d="M9 9h6" stroke="currentColor" strokeWidth="1" strokeLinecap="round" fill="none" />
      {/* Minus sign on bottom */}
      <path d="M9 15h6" stroke="currentColor" strokeWidth="1" strokeLinecap="round" fill="none" />
    </SvgIcon>
  );
}

