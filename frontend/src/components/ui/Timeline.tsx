/**
 * Custom Timeline Component
 * Provides Timeline components compatible with MUI v6
 * Mimics @mui/lab Timeline API
 */

import React from 'react';
import Box from '@mui/material/Box';
import type {BoxProps} from '@mui/material/Box';

/**
 * Timeline Container
 */
export function Timeline({children, ...props}: BoxProps): React.JSX.Element {
  return (
    <Box
      sx={{
        position: 'relative',
        padding: 0,
        '&::before': {
          content: '""',
          position: 'absolute',
          left: '18px',
          top: 0,
          bottom: 0,
          width: '2px',
          backgroundColor: 'divider',
        },
        ...props.sx,
      }}
      {...props}
    >
      {children}
    </Box>
  );
}

/**
 * Timeline Item
 */
export function TimelineItem({children, ...props}: BoxProps): React.JSX.Element {
  return (
    <Box
      sx={{
        position: 'relative',
        display: 'flex',
        alignItems: 'flex-start',
        mb: 2,
        '&:last-child': {
          mb: 0,
        },
        ...props.sx,
      }}
      {...props}
    >
      {children}
    </Box>
  );
}

/**
 * Timeline Separator
 */
export function TimelineSeparator({children, ...props}: BoxProps): React.JSX.Element {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        mr: 2,
        ...props.sx,
      }}
      {...props}
    >
      {children}
    </Box>
  );
}

/**
 * Timeline Connector
 */
export function TimelineConnector({...props}: BoxProps): React.JSX.Element {
  return (
    <Box
      sx={{
        flex: 1,
        width: '2px',
        backgroundColor: 'divider',
        minHeight: '16px',
        ...props.sx,
      }}
      {...props}
    />
  );
}

/**
 * Timeline Content
 */
export function TimelineContent({children, ...props}: BoxProps): React.JSX.Element {
  return (
    <Box
      sx={{
        flex: 1,
        pt: 0.5,
        ...props.sx,
      }}
      {...props}
    >
      {children}
    </Box>
  );
}

/**
 * Timeline Dot Props
 */
export interface TimelineDotProps extends BoxProps {
  color?: 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning' | 'grey';
  variant?: 'filled' | 'outlined';
}

/**
 * Timeline Dot
 */
export function TimelineDot({
  children,
  color = 'primary',
  variant = 'filled',
  ...props
}: TimelineDotProps): React.JSX.Element {
  const isOutlined = variant === 'outlined';
  const colorMap: Record<string, string> = {
    primary: 'primary.main',
    secondary: 'secondary.main',
    error: 'error.main',
    info: 'info.main',
    success: 'success.main',
    warning: 'warning.main',
    grey: 'grey.500',
  };

  return (
    <Box
      sx={{
        width: '36px',
        height: '36px',
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: isOutlined ? 'transparent' : colorMap[color],
        border: `2px solid ${isOutlined ? colorMap[color] : 'transparent'}`,
        color: isOutlined ? colorMap[color] : 'white',
        ...props.sx,
      }}
      {...props}
    >
      {children}
    </Box>
  );
}
