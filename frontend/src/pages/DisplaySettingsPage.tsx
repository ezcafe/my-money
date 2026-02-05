/**
 * Display Settings Page
 * Allows user to change display-related settings including calculator keypad layout
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Typography,
  ToggleButtonGroup,
  ToggleButton,
  Autocomplete,
  TextField,
  CircularProgress,
  Stack,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Tooltip,
  IconButton,
  Popover,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import { HelpOutline } from '@mui/icons-material';
import { useQuery, useMutation } from '@apollo/client/react';
import { Card } from '../components/ui/Card';
import { ColorSchemePicker } from '../components/ui/ColorSchemePicker';
import { KeypadLayoutSelector } from '../components/settings/KeypadLayoutSelector';
import { CURRENCIES, type Currency } from '../utils/currencies';
import { GET_SETTINGS } from '../graphql/queries';
import { UPDATE_SETTINGS } from '../graphql/mutations';
import { useNotifications } from '../contexts/NotificationContext';
import type { DateFormat } from '../contexts/DateFormatContext';
import { DEFAULT_DATE_FORMAT } from '../contexts/DateFormatContext';
import { PageContainer } from '../components/common/PageContainer';
import type { KeypadLayout } from '../components/calculator/CalculatorKeypad';
import { MobileSelect } from '../components/ui/MobileSelect';

/**
 * Help Icon Component
 * Displays a help icon with tooltip on hover (desktop) and popover on click (mobile)
 * @param helpText - The help text to display
 */
function HelpIcon({ helpText }: { helpText: string }): React.JSX.Element {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const open = Boolean(anchorEl);

  /**
   * Handle help icon click
   * Opens popover on mobile devices
   */
  const handleClick = (event: React.MouseEvent<HTMLElement>): void => {
    setAnchorEl(event.currentTarget);
  };

  /**
   * Handle popover close
   */
  const handleClose = (): void => {
    setAnchorEl(null);
  };

  return (
    <>
      <Tooltip title={helpText} arrow>
        <IconButton
          size="small"
          onClick={handleClick}
          sx={{
            padding: 0.5,
            cursor: 'help',
            '&:hover': {
              backgroundColor: 'action.hover',
            },
          }}
          aria-label="Help"
        >
          <HelpOutline fontSize="small" color="action" />
        </IconButton>
      </Tooltip>
      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'left',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'left',
        }}
        PaperProps={{
          sx: {
            maxWidth: 300,
            p: 1.5,
          },
        }}
      >
        <Typography variant="body2">{helpText}</Typography>
      </Popover>
    </>
  );
}

/**
 * Display Settings Page Component
 */
export function DisplaySettingsPage(): React.JSX.Element {
  const { showSuccessNotification, showErrorNotification } = useNotifications();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const { data: settingsData, loading: settingsLoading } = useQuery<{
    settings?: {
      currency: string;
      useThousandSeparator: boolean;
      dateFormat: string | null;
      keypadLayout: string | null;
    };
  }>(GET_SETTINGS);
  const [updateSettings, { loading: updating }] = useMutation<{
    updateSettings: {
      id: string;
      currency: string;
      useThousandSeparator: boolean;
      colorScheme: string | null;
      colorSchemeValue: string | null;
      dateFormat: string | null;
      keypadLayout: string | null;
    };
  }>(UPDATE_SETTINGS, {
    refetchQueries: ['GetSettings'],
    awaitRefetchQueries: true,
    update: (cache, { data }) => {
      if (data?.updateSettings) {
        // Explicitly write to cache - this ensures the cache is updated before refetchQueries runs
        cache.writeQuery({
          query: GET_SETTINGS,
          data: {
            settings: data.updateSettings,
          },
        });
      }
    },
    onCompleted: () => {
      showSuccessNotification('Settings updated successfully');
    },
    onError: (error) => {
      showErrorNotification(error.message || 'Failed to update settings');
    },
  });

  const [useThousandSeparator, setUseThousandSeparator] = useState(true);
  const [currency, setCurrency] = useState('USD');
  const [dateFormat, setDateFormat] = useState<DateFormat>(DEFAULT_DATE_FORMAT);
  const [keypadLayout, setKeypadLayout] = useState<KeypadLayout>('layout1');
  const currencyUpdateTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize state from loaded settings
  useEffect(() => {
    if (settingsData?.settings) {
      if (settingsData.settings.useThousandSeparator !== undefined) {
        setUseThousandSeparator(settingsData.settings.useThousandSeparator);
      }
      if (settingsData.settings.currency) {
        setCurrency(settingsData.settings.currency);
      }
      const rawFormat = settingsData.settings.dateFormat;
      if (!rawFormat) {
        setDateFormat(DEFAULT_DATE_FORMAT);
      } else {
        // Decode HTML entities (e.g., &#x2F; -> /)
        const format = rawFormat.replace(/&#x2F;/g, '/').replace(/&#x2D;/g, '-');

        if (
          format === 'DD/MM/YYYY' ||
          format === 'MM/DD/YYYY' ||
          format === 'YYYY-MM-DD' ||
          format === 'DD-MM-YYYY' ||
          format === 'MM-DD-YYYY'
        ) {
          setDateFormat(format as DateFormat);
        } else {
          setDateFormat(DEFAULT_DATE_FORMAT);
        }
      }
      if (settingsData.settings.keypadLayout) {
        const layout = settingsData.settings.keypadLayout as KeypadLayout;
        if (layout === 'layout1' || layout === 'layout2' || layout === 'layout3') {
          setKeypadLayout(layout);
        }
      }
    }
  }, [settingsData]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return (): void => {
      if (currencyUpdateTimeoutRef.current) {
        clearTimeout(currencyUpdateTimeoutRef.current);
      }
    };
  }, []);

  /**
   * Handle useThousandSeparator change
   * Saves setting to backend
   * @param newValue - The new value from ToggleButtonGroup ("000" or ".")
   */
  const handleUseThousandSeparatorChange = (newValue: string | null): void => {
    if (newValue === null) {
      return;
    }
    const checked = newValue === '000';
    setUseThousandSeparator(checked);
    void updateSettings({
      variables: {
        input: {
          useThousandSeparator: checked,
        },
      },
    });
  };

  /**
   * Handle currency change
   * Updates local state immediately and debounces the API call to prevent excessive requests
   */
  const handleCurrencyChange = (newCurrency: string): void => {
    setCurrency(newCurrency);

    // Clear existing timeout if user is still typing
    if (currencyUpdateTimeoutRef.current) {
      clearTimeout(currencyUpdateTimeoutRef.current);
    }

    // Set new timeout to update settings after user stops typing (500ms delay)
    currencyUpdateTimeoutRef.current = setTimeout(() => {
      void updateSettings({
        variables: {
          input: {
            currency: newCurrency,
          },
        },
      });
      currencyUpdateTimeoutRef.current = null;
    }, 500);
  };

  /**
   * Handle date format change
   * Saves setting to backend
   * @param newFormat - The new date format
   */
  const handleDateFormatChange = (newFormat: DateFormat): void => {
    setDateFormat(newFormat);
    void updateSettings({
      variables: {
        input: {
          dateFormat: newFormat,
        },
      },
    });
  };

  /**
   * Handle keypad layout change
   * Saves setting to backend
   * @param newLayout - The new keypad layout
   */
  const handleKeypadLayoutChange = (newLayout: KeypadLayout): void => {
    setKeypadLayout(newLayout);
    void updateSettings({
      variables: {
        input: {
          keypadLayout: newLayout,
        },
      },
    });
  };

  return (
    <PageContainer>
      <Card sx={{ mb: 3 }}>
        <Box sx={{ p: 3, pb: 2 }}>
          <Typography variant="h6" component="h2" sx={{ mb: 3 }}>
            Display Settings
          </Typography>

          <Stack spacing={3}>
            {/* Calculator Quick Button Setting */}
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <Typography variant="subtitle2" component="label">
                  Calculator Quick Button
                </Typography>
                <HelpIcon helpText="Choose which quick button appears on the calculator. The '000' button quickly adds '000' to your value (useful for entering thousands). The '.' button quickly adds a decimal point (useful for entering cents)." />
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                Choose which quick button appears on the calculator to help you enter values faster
              </Typography>
              <ToggleButtonGroup
                value={useThousandSeparator ? '000' : '.'}
                exclusive
                onChange={(_, newValue: string | null) => {
                  handleUseThousandSeparatorChange(newValue);
                }}
                aria-label="calculator quick button"
                fullWidth
                disabled={settingsLoading || updating}
                size="large"
              >
                <ToggleButton value="000" aria-label="000 button">
                  <Box sx={{ textAlign: 'center' }}>
                    <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                      000
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Quick button to add &apos;000&apos;
                    </Typography>
                  </Box>
                </ToggleButton>
                <ToggleButton value="." aria-label="decimal point button">
                  <Box sx={{ textAlign: 'center' }}>
                    <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                      .
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Quick button to add decimal point
                    </Typography>
                  </Box>
                </ToggleButton>
              </ToggleButtonGroup>
              {settingsLoading || updating ? (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
                  <CircularProgress size={16} />
                  <Typography variant="caption" color="text.secondary">
                    {updating ? 'Saving...' : 'Loading...'}
                  </Typography>
                </Box>
              ) : null}
            </Box>

            {/* Currency Setting */}
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <Typography variant="subtitle2" component="label">
                  Currency
                </Typography>
                <HelpIcon helpText="Select your preferred currency. This will be used throughout the application for displaying amounts" />
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                Select your preferred currency for displaying amounts
              </Typography>
              {isMobile ? (
                <MobileSelect<Currency>
                  value={CURRENCIES.find((c) => c.code === currency) ?? null}
                  options={CURRENCIES}
                  onChange={(newValue) => {
                    if (newValue) {
                      handleCurrencyChange(newValue.code);
                    }
                  }}
                  getOptionLabel={(option) => `${option.code} - ${option.name}`}
                  getOptionId={(option) => option.code}
                  label="Select Currency"
                  placeholder="Search by code or name..."
                  disabled={settingsLoading || updating}
                  fullWidth
                />
              ) : (
                <Autocomplete
                  options={CURRENCIES}
                  getOptionLabel={(option) => `${option.code} - ${option.name}`}
                  value={CURRENCIES.find((c) => c.code === currency) ?? null}
                  onChange={(_event, newValue: Currency | null) => {
                    if (newValue) {
                      handleCurrencyChange(newValue.code);
                    }
                  }}
                  filterOptions={(options, { inputValue }) => {
                    const searchValue = inputValue.toLowerCase();
                    return options.filter(
                      (option) =>
                        option.code.toLowerCase().includes(searchValue) ||
                        option.name.toLowerCase().includes(searchValue)
                    );
                  }}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Select Currency"
                      placeholder="Search by code or name..."
                      fullWidth
                      helperText={updating ? 'Saving...' : undefined}
                    />
                  )}
                  disabled={settingsLoading || updating}
                  fullWidth
                />
              )}
            </Box>

            {/* Date Format Setting */}
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <Typography variant="subtitle2" component="label">
                  Date Format
                </Typography>
                <HelpIcon helpText="Select your preferred date format. This will be used throughout the application for displaying dates" />
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                Choose how dates are displayed throughout the application
              </Typography>
              {isMobile ? (
                <MobileSelect<DateFormat>
                  value={dateFormat}
                  options={['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD', 'DD-MM-YYYY', 'MM-DD-YYYY']}
                  onChange={(newFormat) => {
                    if (newFormat) {
                      handleDateFormatChange(newFormat);
                    }
                  }}
                  getOptionLabel={(option) => option}
                  label="Date Format"
                  disabled={settingsLoading || updating}
                  fullWidth
                />
              ) : (
                <FormControl fullWidth disabled={settingsLoading || updating}>
                  <InputLabel>Date Format</InputLabel>
                  <Select
                    value={dateFormat}
                    label="Date Format"
                    onChange={(e) => {
                      handleDateFormatChange(e.target.value as DateFormat);
                    }}
                  >
                    <MenuItem value="DD/MM/YYYY">DD/MM/YYYY</MenuItem>
                    <MenuItem value="MM/DD/YYYY">MM/DD/YYYY</MenuItem>
                    <MenuItem value="YYYY-MM-DD">YYYY-MM-DD</MenuItem>
                    <MenuItem value="DD-MM-YYYY">DD-MM-YYYY</MenuItem>
                    <MenuItem value="MM-DD-YYYY">MM-DD-YYYY</MenuItem>
                  </Select>
                  {updating ? (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
                      <CircularProgress size={16} />
                      <Typography variant="caption" color="text.secondary">
                        Saving...
                      </Typography>
                    </Box>
                  ) : null}
                </FormControl>
              )}
            </Box>

            {/* Color Scheme Setting */}
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <Typography variant="subtitle2" component="label">
                  Color Scheme
                </Typography>
                <HelpIcon helpText="Customize the app's color theme. Choose from preset themes or create a custom color scheme" />
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                Customize the app&apos;s appearance with different color themes
              </Typography>
              <ColorSchemePicker />
            </Box>

            {/* Keypad Layout Setting */}
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <Typography variant="subtitle2" component="label">
                  Calculator Keypad Layout
                </Typography>
                <HelpIcon helpText="Choose your preferred calculator keypad layout. Each layout arranges the number and operation buttons differently to suit your preference." />
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                Select how the calculator keypad buttons are arranged
              </Typography>
              <KeypadLayoutSelector
                value={keypadLayout}
                onChange={handleKeypadLayoutChange}
                disabled={settingsLoading || updating}
              />
              {settingsLoading || updating ? (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
                  <CircularProgress size={16} />
                  <Typography variant="caption" color="text.secondary">
                    {updating ? 'Saving...' : 'Loading...'}
                  </Typography>
                </Box>
              ) : null}
            </Box>
          </Stack>
        </Box>
      </Card>
    </PageContainer>
  );
}
