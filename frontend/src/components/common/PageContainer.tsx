/**
 * Page Container Component
 * Provides consistent nested container structure for all pages
 * Mobile-first responsive design with Material Design 3 patterns
 */

import React, { memo } from 'react';
import { Box, type SxProps, type Theme } from '@mui/material';

export interface PageContainerProps {
  /** Child elements to render inside the container */
  children: React.ReactNode;
  /** Custom sx styles to override default styles */
  sx?: SxProps<Theme>;
  /** Maximum width override (default: responsive) */
  maxWidth?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | false;
}

/**
 * Page Container Component
 * Provides responsive nested container structure:
 * - Mobile (xs): Full width, minimal padding
 * - Tablet (sm): Max-width 680px, centered, padding
 * - Desktop (md+): Max-width 800px, centered, padding
 *
 * Follows Material Design 3 spacing and responsive patterns
 */
function PageContainerComponent({ children, sx, maxWidth }: PageContainerProps): React.JSX.Element {
  return (
    <Box
      sx={{
        width: { xs: '100%', sm: '100%' },
        maxWidth: maxWidth
          ? undefined
          : {
              xs: '100%',
              sm: '680px', // Tablet
              md: '800px', // Desktop
            },
        mx: { xs: 0, sm: 'auto' },
        ...sx,
      }}
    >
      {children}
    </Box>
  );
}

/**
 * Memoized PageContainer component to prevent unnecessary re-renders
 */
export const PageContainer = memo(PageContainerComponent);
