/**
 * Loading Spinner Component
 * Reusable loading indicator with optional skeleton mode
 */

import React from 'react';
import {Box, CircularProgress, Typography} from '@mui/material';
import {SkeletonLoader, type SkeletonLoaderProps} from './SkeletonLoader';

interface LoadingSpinnerProps {
  message?: string;
  /** Use skeleton loader instead of spinner */
  useSkeleton?: boolean;
  /** Skeleton variant (only used if useSkeleton is true) */
  skeletonVariant?: SkeletonLoaderProps['variant'];
  /** Skeleton count (only used if useSkeleton is true) */
  skeletonCount?: number;
}

/**
 * Loading Spinner Component
 * Displays a loading indicator with optional message or skeleton loader
 */
export function LoadingSpinner({
  message,
  useSkeleton = false,
  skeletonVariant = 'list',
  skeletonCount = 3,
}: LoadingSpinnerProps): React.JSX.Element {
  if (useSkeleton) {
    return <SkeletonLoader variant={skeletonVariant} count={skeletonCount} />;
  }

  const content = (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2,
        minHeight: 200,
      }}
    >
      <CircularProgress />
      {message ? <Typography variant="body1" color="text.secondary">
          {message}
        </Typography> : null}
    </Box>
  );

  return content;
}

