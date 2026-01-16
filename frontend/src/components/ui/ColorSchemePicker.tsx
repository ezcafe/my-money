/**
 * Color Scheme Picker Component
 * Allows users to customize color scheme (dynamic or static)
 */

import React, {useState, useEffect, useCallback} from 'react';
import {
  Box,
  Typography,
  ToggleButtonGroup,
  ToggleButton,
  Grid,
  Paper,
  Tooltip,
} from '@mui/material';
import {CheckCircle} from '@mui/icons-material';
import {useTheme} from '../../theme/ThemeProvider';
import {useMutation} from '@apollo/client/react';
import {UPDATE_PREFERENCES} from '../../graphql/mutations';
import {
  getStaticColorSchemeNames,
  getColorPalette,
  type StaticColorSchemeName,
  type ColorSchemeType,
} from '../../theme/colorSchemes';
import type {ColorSchemeConfig} from '../../theme/index';

/**
 * Color scheme preview box
 */
interface ColorSchemePreviewProps {
  name: string;
  primaryColor: string;
  secondaryColor: string;
  tertiaryColor: string;
  isSelected: boolean;
  onClick: () => void;
}

function ColorSchemePreview({
  name,
  primaryColor,
  secondaryColor,
  tertiaryColor,
  isSelected,
  onClick,
}: ColorSchemePreviewProps): React.JSX.Element {
  return (
    <Tooltip title={name.charAt(0).toUpperCase() + name.slice(1)}>
      <Paper
        elevation={0}
        sx={{
          p: 0.5,
          cursor: 'pointer',
          border: 1.5,
          borderColor: isSelected ? 'primary.main' : 'divider',
          borderRadius: 0, // Flat style: no rounded corners
          boxShadow: 'none', // Flat style: no shadows
          boxSizing: 'border-box',
          position: 'relative',
        }}
        onClick={onClick}
      >
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            gap: 0.25,
          }}
        >
          <Box
            sx={{
              height: 24,
              backgroundColor: primaryColor,
              borderRadius: 0, // Flat style: no rounded corners
            }}
          />
          <Box
            sx={{
              display: 'flex',
              gap: 0.25,
            }}
          >
            <Box
              sx={{
                flex: 1,
                height: 12,
                backgroundColor: secondaryColor,
                borderRadius: 0, // Flat style: no rounded corners
              }}
            />
            <Box
              sx={{
                flex: 1,
                height: 12,
                backgroundColor: tertiaryColor,
                borderRadius: 0, // Flat style: no rounded corners
              }}
            />
          </Box>
        </Box>
        {isSelected ? <CheckCircle
            sx={{
              color: 'primary.main',
              position: 'absolute',
              top: 2,
              right: 2,
              fontSize: '1rem',
            }}
          /> : null}
        <Typography
          variant="caption"
          sx={{
            mt: 0.25,
            display: 'block',
            textAlign: 'center',
            textTransform: 'capitalize',
            fontSize: '0.7rem',
            lineHeight: 1.2,
          }}
        >
          {name}
        </Typography>
      </Paper>
    </Tooltip>
  );
}

/**
 * Color Scheme Picker Component
 */
export function ColorSchemePicker(): React.JSX.Element {
  const {colorScheme, updateColorScheme, mode} = useTheme();
  const [updatePreferences] = useMutation(UPDATE_PREFERENCES, {
    refetchQueries: ['GetPreferences'],
  });

  const [schemeType, setSchemeType] = useState<ColorSchemeType>(colorScheme?.type ?? null);
  // Only use colorScheme.value for dynamicColor if type is 'dynamic' and value is a valid hex
  const getInitialDynamicColor = (): string => {
    if (colorScheme?.type === 'dynamic' && colorScheme.value) {
      // Validate hex color format
      const hexPattern = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i;
      if (hexPattern.test(colorScheme.value)) {
        return colorScheme.value.startsWith('#') ? colorScheme.value : `#${colorScheme.value}`;
      }
    }
    return '#6750A4';
  };
  const [dynamicColor, setDynamicColor] = useState<string>(getInitialDynamicColor());
  const [staticScheme, setStaticScheme] = useState<StaticColorSchemeName>(
    (colorScheme?.value as StaticColorSchemeName) ?? 'purple',
  );

  // Sync with theme context
  useEffect(() => {
    if (colorScheme) {
      setSchemeType(colorScheme.type);
      if (colorScheme.type === 'dynamic') {
        // Validate hex color format before setting
        const hexPattern = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i;
        if (colorScheme.value && hexPattern.test(colorScheme.value)) {
          const hexValue = colorScheme.value.startsWith('#') ? colorScheme.value : `#${colorScheme.value}`;
          setDynamicColor(hexValue);
        } else {
          setDynamicColor('#6750A4');
        }
      } else if (colorScheme.type === 'static') {
        setStaticScheme((colorScheme.value as StaticColorSchemeName) ?? 'purple');
      }
    }
  }, [colorScheme]);

  /**
   * Handle scheme type change
   */
  const handleSchemeTypeChange = useCallback(
    (_event: React.MouseEvent<HTMLElement>, newType: ColorSchemeType | null): void => {
      if (newType === null) {
        return;
      }
      setSchemeType(newType);
      const newScheme: ColorSchemeConfig = {
        type: newType,
        value: newType === 'dynamic' ? dynamicColor : staticScheme,
      };
      updateColorScheme(newScheme);
      void updatePreferences({
        variables: {
          input: {
            colorScheme: newType,
            colorSchemeValue: newScheme.value,
          },
        },
      });
    },
    [dynamicColor, staticScheme, updateColorScheme, updatePreferences],
  );

  /**
   * Handle dynamic color change
   */
  const handleDynamicColorChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>): void => {
      const newColor = event.target.value;
      setDynamicColor(newColor);
      const newScheme: ColorSchemeConfig = {
        type: 'dynamic',
        value: newColor,
      };
      updateColorScheme(newScheme);
      void updatePreferences({
        variables: {
          input: {
            colorScheme: 'dynamic',
            colorSchemeValue: newColor,
          },
        },
      });
    },
    [updateColorScheme, updatePreferences],
  );

  /**
   * Handle static scheme selection
   */
  const handleStaticSchemeSelect = useCallback(
    (scheme: StaticColorSchemeName): void => {
      setStaticScheme(scheme);
      const newScheme: ColorSchemeConfig = {
        type: 'static',
        value: scheme,
      };
      updateColorScheme(newScheme);
      void updatePreferences({
        variables: {
          input: {
            colorScheme: 'static',
            colorSchemeValue: scheme,
          },
        },
      });
    },
    [updateColorScheme, updatePreferences],
  );

  const staticSchemes = getStaticColorSchemeNames();

  // Ensure schemeType is never null for ToggleButtonGroup (default to 'static')
  const displaySchemeType: 'dynamic' | 'static' = schemeType ?? 'static';

  return (
    <Box>
      <Typography variant="body2" color="text.secondary" gutterBottom sx={{mb: 2}}>
        Color Scheme
      </Typography>
      <ToggleButtonGroup
        value={displaySchemeType}
        exclusive
        onChange={handleSchemeTypeChange}
        aria-label="color scheme type"
        fullWidth
        sx={{mb: 3}}
      >
        <ToggleButton value="dynamic" aria-label="dynamic color">
          Dynamic
        </ToggleButton>
        <ToggleButton value="static" aria-label="static color">
          Static
        </ToggleButton>
      </ToggleButtonGroup>

      {displaySchemeType === 'dynamic' && (
        <Box>
          <Typography variant="body2" color="text.secondary" gutterBottom sx={{mb: 1}}>
            Choose a source color
          </Typography>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 2,
            }}
          >
            <input
              type="color"
              value={dynamicColor}
              onChange={handleDynamicColorChange}
              style={{
                borderRadius: 0, // Flat style: no rounded corners
                border: 'none',
                cursor: 'pointer',
              }}
            />
            <Box
              sx={{
                flex: 1,
                display: 'flex',
                gap: 1,
                alignItems: 'center',
              }}
            >
              <Box
                sx={{
                  backgroundColor: dynamicColor,
                  borderRadius: 0, // Flat style: no rounded corners
                  border: '1px solid',
                  borderColor: 'divider',
                }}
              />
              <Typography variant="body2" sx={{fontFamily: 'monospace'}}>
                {dynamicColor.toUpperCase()}
              </Typography>
            </Box>
          </Box>
        </Box>
      )}

      {displaySchemeType === 'static' && (
        <Box>
          <Typography variant="body2" color="text.secondary" gutterBottom sx={{mb: 2}}>
            Choose a color scheme
          </Typography>
          <Grid container spacing={2}>
            {staticSchemes.map((scheme) => {
              const palette = getColorPalette('static', scheme, mode === 'dark');
              return (
                <Grid item xs={6} sm={4} md={3} key={scheme}>
                  <ColorSchemePreview
                    name={scheme}
                    primaryColor={palette.primary}
                    secondaryColor={palette.secondary}
                    tertiaryColor={palette.tertiary}
                    isSelected={staticScheme === scheme}
                    onClick={() => {
                      handleStaticSchemeSelect(scheme);
                    }}
                  />
                </Grid>
              );
            })}
          </Grid>
        </Box>
      )}
    </Box>
  );
}

