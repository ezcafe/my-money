/**
 * Keypad Layout Selector Component
 * Displays miniview previews of keypad layouts for selection
 */

import React from 'react';
import { Box, Typography, ToggleButtonGroup, ToggleButton, Paper } from '@mui/material';
import Grid from '@mui/material/Grid2';
import type { KeypadLayout } from '../calculator/CalculatorKeypad';

interface KeypadLayoutSelectorProps {
  value: KeypadLayout;
  onChange: (layout: KeypadLayout) => void;
  disabled?: boolean;
}

/**
 * Miniview component for Layout 1
 */
function Layout1Miniview(): React.JSX.Element {
  return (
    <Box sx={{ p: 0.5 }}>
      <Grid container spacing={0.25} sx={{ width: '100%' }}>
        {/* Row 1: 7, 8, 9, * */}
        <Grid size={3}>
          <Paper
            sx={{
              height: '12px',
              bgcolor: 'primary.main',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '6px',
              color: 'primary.contrastText',
            }}
          >
            7
          </Paper>
        </Grid>
        <Grid size={3}>
          <Paper
            sx={{
              height: '12px',
              bgcolor: 'primary.main',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '6px',
              color: 'primary.contrastText',
            }}
          >
            8
          </Paper>
        </Grid>
        <Grid size={3}>
          <Paper
            sx={{
              height: '12px',
              bgcolor: 'primary.main',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '6px',
              color: 'primary.contrastText',
            }}
          >
            9
          </Paper>
        </Grid>
        <Grid size={3}>
          <Paper
            sx={{
              height: '12px',
              bgcolor: 'action.selected',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '6px',
            }}
          >
            ×
          </Paper>
        </Grid>
        {/* Row 2: 4, 5, 6, - */}
        <Grid size={3}>
          <Paper
            sx={{
              height: '12px',
              bgcolor: 'primary.main',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '6px',
              color: 'primary.contrastText',
            }}
          >
            4
          </Paper>
        </Grid>
        <Grid size={3}>
          <Paper
            sx={{
              height: '12px',
              bgcolor: 'primary.main',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '6px',
              color: 'primary.contrastText',
            }}
          >
            5
          </Paper>
        </Grid>
        <Grid size={3}>
          <Paper
            sx={{
              height: '12px',
              bgcolor: 'primary.main',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '6px',
              color: 'primary.contrastText',
            }}
          >
            6
          </Paper>
        </Grid>
        <Grid size={3}>
          <Paper
            sx={{
              height: '12px',
              bgcolor: 'action.selected',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '6px',
            }}
          >
            −
          </Paper>
        </Grid>
        {/* Row 3: 1, 2, 3, + */}
        <Grid size={3}>
          <Paper
            sx={{
              height: '12px',
              bgcolor: 'primary.main',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '6px',
              color: 'primary.contrastText',
            }}
          >
            1
          </Paper>
        </Grid>
        <Grid size={3}>
          <Paper
            sx={{
              height: '12px',
              bgcolor: 'primary.main',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '6px',
              color: 'primary.contrastText',
            }}
          >
            2
          </Paper>
        </Grid>
        <Grid size={3}>
          <Paper
            sx={{
              height: '12px',
              bgcolor: 'primary.main',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '6px',
              color: 'primary.contrastText',
            }}
          >
            3
          </Paper>
        </Grid>
        <Grid size={3}>
          <Paper
            sx={{
              height: '12px',
              bgcolor: 'action.selected',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '6px',
            }}
          >
            +
          </Paper>
        </Grid>
        {/* Row 4: Settings, 0, ., Go */}
        <Grid size={3}>
          <Paper
            sx={{
              height: '12px',
              bgcolor: 'action.selected',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '6px',
            }}
          >
            ⚙
          </Paper>
        </Grid>
        <Grid size={3}>
          <Paper
            sx={{
              height: '12px',
              bgcolor: 'primary.main',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '6px',
              color: 'primary.contrastText',
            }}
          >
            0
          </Paper>
        </Grid>
        <Grid size={3}>
          <Paper
            sx={{
              height: '12px',
              bgcolor: 'primary.main',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '6px',
              color: 'primary.contrastText',
            }}
          >
            .
          </Paper>
        </Grid>
        <Grid size={3}>
          <Paper
            sx={{
              height: '12px',
              bgcolor: 'success.main',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '6px',
              color: 'success.contrastText',
            }}
          >
            ✓
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}

/**
 * Miniview component for Layout 2
 */
function Layout2Miniview(): React.JSX.Element {
  return (
    <Box sx={{ p: 0.5 }}>
      <Grid container spacing={0.25} sx={{ width: '100%' }}>
        {/* Row 1: 7, 8, 9 */}
        <Grid size={4}>
          <Paper
            sx={{
              height: '12px',
              bgcolor: 'primary.main',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '6px',
              color: 'primary.contrastText',
            }}
          >
            7
          </Paper>
        </Grid>
        <Grid size={4}>
          <Paper
            sx={{
              height: '12px',
              bgcolor: 'primary.main',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '6px',
              color: 'primary.contrastText',
            }}
          >
            8
          </Paper>
        </Grid>
        <Grid size={4}>
          <Paper
            sx={{
              height: '12px',
              bgcolor: 'primary.main',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '6px',
              color: 'primary.contrastText',
            }}
          >
            9
          </Paper>
        </Grid>
        {/* Row 2: 4, 5, 6 */}
        <Grid size={4}>
          <Paper
            sx={{
              height: '12px',
              bgcolor: 'primary.main',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '6px',
              color: 'primary.contrastText',
            }}
          >
            4
          </Paper>
        </Grid>
        <Grid size={4}>
          <Paper
            sx={{
              height: '12px',
              bgcolor: 'primary.main',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '6px',
              color: 'primary.contrastText',
            }}
          >
            5
          </Paper>
        </Grid>
        <Grid size={4}>
          <Paper
            sx={{
              height: '12px',
              bgcolor: 'primary.main',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '6px',
              color: 'primary.contrastText',
            }}
          >
            6
          </Paper>
        </Grid>
        {/* Row 3: 1, 2, 3 */}
        <Grid size={4}>
          <Paper
            sx={{
              height: '12px',
              bgcolor: 'primary.main',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '6px',
              color: 'primary.contrastText',
            }}
          >
            1
          </Paper>
        </Grid>
        <Grid size={4}>
          <Paper
            sx={{
              height: '12px',
              bgcolor: 'primary.main',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '6px',
              color: 'primary.contrastText',
            }}
          >
            2
          </Paper>
        </Grid>
        <Grid size={4}>
          <Paper
            sx={{
              height: '12px',
              bgcolor: 'primary.main',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '6px',
              color: 'primary.contrastText',
            }}
          >
            3
          </Paper>
        </Grid>
        {/* Row 4: Settings, 0, Go */}
        <Grid size={4}>
          <Paper
            sx={{
              height: '12px',
              bgcolor: 'action.selected',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '6px',
            }}
          >
            ⚙
          </Paper>
        </Grid>
        <Grid size={4}>
          <Paper
            sx={{
              height: '12px',
              bgcolor: 'primary.main',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '6px',
              color: 'primary.contrastText',
            }}
          >
            0
          </Paper>
        </Grid>
        <Grid size={4}>
          <Paper
            sx={{
              height: '12px',
              bgcolor: 'success.main',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '6px',
              color: 'success.contrastText',
            }}
          >
            ✓
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}

/**
 * Miniview component for Layout 3
 */
function Layout3Miniview(): React.JSX.Element {
  return (
    <Box sx={{ p: 0.5 }}>
      <Grid container spacing={0.25} sx={{ width: '100%' }}>
        {/* Row 1: +, 7, 8, 9 */}
        <Grid size={3}>
          <Paper
            sx={{
              height: '12px',
              bgcolor: 'action.selected',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '6px',
            }}
          >
            +
          </Paper>
        </Grid>
        <Grid size={3}>
          <Paper
            sx={{
              height: '12px',
              bgcolor: 'primary.main',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '6px',
              color: 'primary.contrastText',
            }}
          >
            7
          </Paper>
        </Grid>
        <Grid size={3}>
          <Paper
            sx={{
              height: '12px',
              bgcolor: 'primary.main',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '6px',
              color: 'primary.contrastText',
            }}
          >
            8
          </Paper>
        </Grid>
        <Grid size={3}>
          <Paper
            sx={{
              height: '12px',
              bgcolor: 'primary.main',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '6px',
              color: 'primary.contrastText',
            }}
          >
            9
          </Paper>
        </Grid>
        {/* Row 2: -, 4, 5, 6 */}
        <Grid size={3}>
          <Paper
            sx={{
              height: '12px',
              bgcolor: 'action.selected',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '6px',
            }}
          >
            −
          </Paper>
        </Grid>
        <Grid size={3}>
          <Paper
            sx={{
              height: '12px',
              bgcolor: 'primary.main',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '6px',
              color: 'primary.contrastText',
            }}
          >
            4
          </Paper>
        </Grid>
        <Grid size={3}>
          <Paper
            sx={{
              height: '12px',
              bgcolor: 'primary.main',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '6px',
              color: 'primary.contrastText',
            }}
          >
            5
          </Paper>
        </Grid>
        <Grid size={3}>
          <Paper
            sx={{
              height: '12px',
              bgcolor: 'primary.main',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '6px',
              color: 'primary.contrastText',
            }}
          >
            6
          </Paper>
        </Grid>
        {/* Row 3: *, 1, 2, 3 */}
        <Grid size={3}>
          <Paper
            sx={{
              height: '12px',
              bgcolor: 'action.selected',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '6px',
            }}
          >
            ×
          </Paper>
        </Grid>
        <Grid size={3}>
          <Paper
            sx={{
              height: '12px',
              bgcolor: 'primary.main',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '6px',
              color: 'primary.contrastText',
            }}
          >
            1
          </Paper>
        </Grid>
        <Grid size={3}>
          <Paper
            sx={{
              height: '12px',
              bgcolor: 'primary.main',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '6px',
              color: 'primary.contrastText',
            }}
          >
            2
          </Paper>
        </Grid>
        <Grid size={3}>
          <Paper
            sx={{
              height: '12px',
              bgcolor: 'primary.main',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '6px',
              color: 'primary.contrastText',
            }}
          >
            3
          </Paper>
        </Grid>
        {/* Row 4: Settings, 0, ., Go */}
        <Grid size={3}>
          <Paper
            sx={{
              height: '12px',
              bgcolor: 'action.selected',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '6px',
            }}
          >
            ⚙
          </Paper>
        </Grid>
        <Grid size={3}>
          <Paper
            sx={{
              height: '12px',
              bgcolor: 'primary.main',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '6px',
              color: 'primary.contrastText',
            }}
          >
            0
          </Paper>
        </Grid>
        <Grid size={3}>
          <Paper
            sx={{
              height: '12px',
              bgcolor: 'primary.main',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '6px',
              color: 'primary.contrastText',
            }}
          >
            .
          </Paper>
        </Grid>
        <Grid size={3}>
          <Paper
            sx={{
              height: '12px',
              bgcolor: 'success.main',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '6px',
              color: 'success.contrastText',
            }}
          >
            ✓
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}

/**
 * Keypad Layout Selector Component
 */
export function KeypadLayoutSelector({
  value,
  onChange,
  disabled = false,
}: KeypadLayoutSelectorProps): React.JSX.Element {
  return (
    <ToggleButtonGroup
      value={value}
      exclusive
      onChange={(_, newValue: KeypadLayout | null) => {
        if (newValue !== null) {
          onChange(newValue);
        }
      }}
      aria-label="keypad layout"
      fullWidth
      disabled={disabled}
      size="large"
    >
      <ToggleButton value="layout1" aria-label="Layout 1">
        <Box sx={{ textAlign: 'center', width: '100%' }}>
          <Layout1Miniview />
          <Typography variant="body2" sx={{ fontWeight: 'bold', mt: 0.5 }}>
            Layout 1
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Operations on right
          </Typography>
        </Box>
      </ToggleButton>
      <ToggleButton value="layout2" aria-label="Layout 2">
        <Box sx={{ textAlign: 'center', width: '100%' }}>
          <Layout2Miniview />
          <Typography variant="body2" sx={{ fontWeight: 'bold', mt: 0.5 }}>
            Layout 2
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Numbers only
          </Typography>
        </Box>
      </ToggleButton>
      <ToggleButton value="layout3" aria-label="Layout 3">
        <Box sx={{ textAlign: 'center', width: '100%' }}>
          <Layout3Miniview />
          <Typography variant="body2" sx={{ fontWeight: 'bold', mt: 0.5 }}>
            Layout 3
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Operations on left
          </Typography>
        </Box>
      </ToggleButton>
    </ToggleButtonGroup>
  );
}
