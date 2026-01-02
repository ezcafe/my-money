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
        elevation={isSelected ? 3 : 1}
        sx={{
          p: 1,
          cursor: 'pointer',
          border: isSelected ? 2 : 0,
          borderColor: 'primary.main',
          '&:hover': {
            elevation: 2,
          },
        }}
        onClick={onClick}
      >
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            gap: 0.5,
          }}
        >
          <Box
            sx={{
              backgroundColor: primaryColor,
              borderRadius: 1,
            }}
          />
          <Box
            sx={{
              display: 'flex',
              gap: 0.5,
            }}
          >
            <Box
              sx={{
                flex: 1,
                backgroundColor: secondaryColor,
                borderRadius: 0.5,
              }}
            />
            <Box
              sx={{
                flex: 1,
                backgroundColor: tertiaryColor,
                borderRadius: 0.5,
              }}
            />
          </Box>
        </Box>
        {isSelected && (
          <CheckCircle
            sx={{
              color: 'primary.main',
            }}
          />
        )}
        <Typography
          variant="caption"
          sx={{
            mt: 0.5,
            display: 'block',
            textAlign: 'center',
            textTransform: 'capitalize',
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
  const [dynamicColor, setDynamicColor] = useState<string>(colorScheme?.value ?? '#6750A4');
  const [staticScheme, setStaticScheme] = useState<StaticColorSchemeName>(
    (colorScheme?.value as StaticColorSchemeName) ?? 'purple',
  );

  // Sync with theme context
  useEffect(() => {
    if (colorScheme) {
      setSchemeType(colorScheme.type);
      if (colorScheme.type === 'dynamic') {
        setDynamicColor(colorScheme.value ?? '#6750A4');
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

  return (
    <Box>
      <Typography variant="body2" color="text.secondary" gutterBottom sx={{mb: 2}}>
        Color Scheme
      </Typography>
      <ToggleButtonGroup
        value={schemeType}
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

      {schemeType === 'dynamic' && (
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
                borderRadius: 8,
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
                  borderRadius: 1,
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

      {schemeType === 'static' && (
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

