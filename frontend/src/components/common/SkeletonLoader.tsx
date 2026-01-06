/**
 * Skeleton Loader Component
 * Provides skeleton loading states for better perceived performance
 */

import React from 'react';
import {Box, Skeleton, type SxProps, type Theme} from '@mui/material';

/**
 * Props for SkeletonLoader component
 */
export interface SkeletonLoaderProps {
  /** Type of skeleton to display */
  variant?: 'list' | 'table' | 'card' | 'form' | 'text';
  /** Number of items to show (for list/table variants) */
  count?: number;
  /** Custom sx props */
  sx?: SxProps<Theme>;
}

/**
 * Skeleton Loader Component
 * Displays skeleton placeholders while content is loading
 */
export function SkeletonLoader({variant = 'list', count = 3, sx}: SkeletonLoaderProps): React.JSX.Element {
  /**
   * Render list skeleton
   */
  const renderListSkeleton = (): React.JSX.Element => (
    <Box sx={{display: 'flex', flexDirection: 'column', gap: 1, ...sx}}>
      {Array.from({length: count}).map((_, index) => (
        <Box key={index} sx={{display: 'flex', gap: 2, alignItems: 'center', p: 2}}>
          <Skeleton variant="circular" width={40} height={40} />
          <Box sx={{flex: 1}}>
            <Skeleton variant="text" width="60%" height={24} />
            <Skeleton variant="text" width="40%" height={20} sx={{mt: 0.5}} />
          </Box>
          <Skeleton variant="text" width={80} height={24} />
        </Box>
      ))}
    </Box>
  );

  /**
   * Render table skeleton
   */
  const renderTableSkeleton = (): React.JSX.Element => (
    <Box sx={{...sx}}>
      <Box sx={{display: 'flex', gap: 2, p: 2, borderBottom: 1, borderColor: 'divider'}}>
        {Array.from({length: 5}).map((_, index) => (
          <Skeleton key={index} variant="text" width="20%" height={24} />
        ))}
      </Box>
      {Array.from({length: count}).map((_, index) => (
        <Box key={index} sx={{display: 'flex', gap: 2, p: 2, borderBottom: 1, borderColor: 'divider'}}>
          {Array.from({length: 5}).map((_, colIndex) => (
            <Skeleton key={colIndex} variant="text" width="20%" height={20} />
          ))}
        </Box>
      ))}
    </Box>
  );

  /**
   * Render card skeleton
   */
  const renderCardSkeleton = (): React.JSX.Element => (
    <Box sx={{p: 3, ...sx}}>
      <Skeleton variant="text" width="60%" height={32} sx={{mb: 2}} />
      <Skeleton variant="rectangular" height={200} sx={{mb: 2, borderRadius: 1}} />
      <Skeleton variant="text" width="100%" height={20} sx={{mb: 1}} />
      <Skeleton variant="text" width="80%" height={20} />
    </Box>
  );

  /**
   * Render form skeleton
   */
  const renderFormSkeleton = (): React.JSX.Element => (
    <Box sx={{display: 'flex', flexDirection: 'column', gap: 3, p: 3, ...sx}}>
      {Array.from({length: count}).map((_, index) => (
        <Box key={index}>
          <Skeleton variant="text" width="30%" height={20} sx={{mb: 1}} />
          <Skeleton variant="rectangular" height={56} sx={{borderRadius: 1}} />
        </Box>
      ))}
      <Box sx={{display: 'flex', gap: 2, justifyContent: 'flex-end', mt: 2}}>
        <Skeleton variant="rectangular" width={100} height={36} sx={{borderRadius: 1}} />
        <Skeleton variant="rectangular" width={100} height={36} sx={{borderRadius: 1}} />
      </Box>
    </Box>
  );

  /**
   * Render text skeleton
   */
  const renderTextSkeleton = (): React.JSX.Element => (
    <Box sx={{...sx}}>
      <Skeleton variant="text" width="100%" height={24} sx={{mb: 1}} />
      <Skeleton variant="text" width="100%" height={24} sx={{mb: 1}} />
      <Skeleton variant="text" width="80%" height={24} />
    </Box>
  );

  switch (variant) {
    case 'table':
      return renderTableSkeleton();
    case 'card':
      return renderCardSkeleton();
    case 'form':
      return renderFormSkeleton();
    case 'text':
      return renderTextSkeleton();
    case 'list':
    default:
      return renderListSkeleton();
  }
}




