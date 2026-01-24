/**
 * Material Design 3 Design Tokens
 * Following M3 specifications for colors, typography, spacing, elevation, shape, and motion
 */

/**
 * M3 Color Tokens
 * Based on Material Design 3 color system
 */
export const m3Colors = {
  // Primary colors (will be generated from color scheme)
  primary: {
    light: '#6750A4',
    dark: '#D0BCFF',
  },
  onPrimary: {
    light: '#FFFFFF',
    dark: '#381E72',
  },
  primaryContainer: {
    light: '#EADDFF',
    dark: '#4F378B',
  },
  onPrimaryContainer: {
    light: '#21005D',
    dark: '#EADDFF',
  },
  // Secondary colors
  secondary: {
    light: '#625B71',
    dark: '#CCC2DC',
  },
  onSecondary: {
    light: '#FFFFFF',
    dark: '#332D41',
  },
  secondaryContainer: {
    light: '#E8DEF8',
    dark: '#4A4458',
  },
  onSecondaryContainer: {
    light: '#1D192B',
    dark: '#E8DEF8',
  },
  // Tertiary colors
  tertiary: {
    light: '#7D5260',
    dark: '#EFB8C8',
  },
  onTertiary: {
    light: '#FFFFFF',
    dark: '#492532',
  },
  tertiaryContainer: {
    light: '#FFD8E4',
    dark: '#633B48',
  },
  onTertiaryContainer: {
    light: '#31111D',
    dark: '#FFD8E4',
  },
  // Error colors
  error: {
    light: '#BA1A1A',
    dark: '#FFB4AB',
  },
  onError: {
    light: '#FFFFFF',
    dark: '#690005',
  },
  errorContainer: {
    light: '#FFDAD6',
    dark: '#93000A',
  },
  onErrorContainer: {
    light: '#410002',
    dark: '#FFDAD6',
  },
  // Surface colors
  surface: {
    light: '#FFFBFE',
    dark: '#1C1B1F',
  },
  onSurface: {
    light: '#1C1B1F',
    dark: '#E6E1E5',
  },
  surfaceVariant: {
    light: '#E7E0EC',
    dark: '#49454F',
  },
  onSurfaceVariant: {
    light: '#49454F',
    dark: '#CAC4D0',
  },
  // Outline colors
  outline: {
    light: '#79747E',
    dark: '#938F99',
  },
  outlineVariant: {
    light: '#CAC4D0',
    dark: '#49454F',
  },
  // Background colors
  background: {
    light: '#FFFBFE',
    dark: '#1C1B1F',
  },
  onBackground: {
    light: '#1C1B1F',
    dark: '#E6E1E5',
  },
  // Inverse colors
  inverseSurface: {
    light: '#313033',
    dark: '#E6E1E5',
  },
  inverseOnSurface: {
    light: '#F4EFF4',
    dark: '#313033',
  },
  inversePrimary: {
    light: '#D0BCFF',
    dark: '#6750A4',
  },
  // Shadow
  shadow: {
    light: '#000000',
    dark: '#000000',
  },
  // Scrim
  scrim: {
    light: '#000000',
    dark: '#000000',
  },
  // Surface tint
  surfaceTint: {
    light: '#6750A4',
    dark: '#D0BCFF',
  },
} as const;

/**
 * M3 Typography Tokens
 * Following Material Design 3 typography scale
 */
export const m3Typography = {
  fontFamily: {
    display: '"Roboto", "Helvetica", "Arial", sans-serif',
    body: '"Roboto", "Helvetica", "Arial", sans-serif',
    mono: '"Roboto Mono", "Courier New", monospace',
  },
  fontSize: {
    displayLarge: '57px',
    displayMedium: '45px',
    displaySmall: '36px',
    headlineLarge: '32px',
    headlineMedium: '28px',
    headlineSmall: '24px',
    titleLarge: '22px',
    titleMedium: '16px',
    titleSmall: '14px',
    labelLarge: '14px',
    labelMedium: '12px',
    labelSmall: '11px',
    bodyLarge: '16px',
    bodyMedium: '14px',
    bodySmall: '12px',
  },
  fontWeight: {
    regular: 400,
    medium: 500,
    bold: 700,
  },
  lineHeight: {
    displayLarge: '64px',
    displayMedium: '52px',
    displaySmall: '44px',
    headlineLarge: '40px',
    headlineMedium: '36px',
    headlineSmall: '32px',
    titleLarge: '28px',
    titleMedium: '20px',
    titleSmall: '20px',
    labelLarge: '20px',
    labelMedium: '16px',
    labelSmall: '16px',
    bodyLarge: '24px',
    bodyMedium: '20px',
    bodySmall: '16px',
  },
  letterSpacing: {
    displayLarge: '-0.25px',
    displayMedium: '0px',
    displaySmall: '0px',
    headlineLarge: '0px',
    headlineMedium: '0px',
    headlineSmall: '0px',
    titleLarge: '0px',
    titleMedium: '0.15px',
    titleSmall: '0.1px',
    labelLarge: '0.1px',
    labelMedium: '0.5px',
    labelSmall: '0.5px',
    bodyLarge: '0.5px',
    bodyMedium: '0.25px',
    bodySmall: '0.4px',
  },
} as const;

/**
 * M3 Spacing Tokens
 * Based on 4dp grid system
 */
export const m3Spacing = {
  0: '0px',
  1: '4px',
  2: '8px',
  3: '12px',
  4: '16px',
  5: '20px',
  6: '24px',
  7: '28px',
  8: '32px',
  9: '36px',
  10: '40px',
  11: '44px',
  12: '48px',
  13: '52px',
  14: '56px',
  15: '60px',
  16: '64px',
} as const;

/**
 * M3 Elevation Tokens
 * Shadow values for different elevation levels
 */
export const m3Elevation = {
  0: {
    light: 'none',
    dark: 'none',
  },
  1: {
    light: '0px 1px 2px 0px rgba(0, 0, 0, 0.3), 0px 1px 3px 1px rgba(0, 0, 0, 0.15)',
    dark: '0px 1px 2px 0px rgba(0, 0, 0, 0.3), 0px 1px 3px 1px rgba(0, 0, 0, 0.15)',
  },
  2: {
    light: '0px 1px 2px 0px rgba(0, 0, 0, 0.3), 0px 2px 6px 2px rgba(0, 0, 0, 0.15)',
    dark: '0px 1px 2px 0px rgba(0, 0, 0, 0.3), 0px 2px 6px 2px rgba(0, 0, 0, 0.15)',
  },
  3: {
    light: '0px 1px 3px 0px rgba(0, 0, 0, 0.3), 0px 4px 8px 3px rgba(0, 0, 0, 0.15)',
    dark: '0px 1px 3px 0px rgba(0, 0, 0, 0.3), 0px 4px 8px 3px rgba(0, 0, 0, 0.15)',
  },
  4: {
    light: '0px 2px 3px 0px rgba(0, 0, 0, 0.3), 0px 6px 10px 4px rgba(0, 0, 0, 0.15)',
    dark: '0px 2px 3px 0px rgba(0, 0, 0, 0.3), 0px 6px 10px 4px rgba(0, 0, 0, 0.15)',
  },
  5: {
    light: '0px 4px 4px 0px rgba(0, 0, 0, 0.3), 0px 8px 12px 6px rgba(0, 0, 0, 0.15)',
    dark: '0px 4px 4px 0px rgba(0, 0, 0, 0.3), 0px 8px 12px 6px rgba(0, 0, 0, 0.15)',
  },
} as const;

/**
 * M3 Shape Tokens
 * Border radius values
 */
export const m3Shape = {
  none: '0px',
  extraSmall: '4px',
  small: '8px',
  medium: '12px',
  large: '16px',
  extraLarge: '28px',
  full: '9999px',
} as const;

/**
 * M3 Motion Tokens
 * Duration and easing values
 */
export const m3Motion = {
  duration: {
    short1: '50ms',
    short2: '100ms',
    short3: '150ms',
    short4: '200ms',
    medium1: '250ms',
    medium2: '300ms',
    medium3: '350ms',
    medium4: '400ms',
    long1: '450ms',
    long2: '500ms',
    long3: '550ms',
    long4: '600ms',
    extraLong1: '700ms',
    extraLong2: '800ms',
    extraLong3: '900ms',
    extraLong4: '1000ms',
  },
  easing: {
    standard: 'cubic-bezier(0.2, 0, 0, 1)',
    standardAccelerate: 'cubic-bezier(0.3, 0, 1, 1)',
    standardDecelerate: 'cubic-bezier(0, 0, 0.2, 1)',
    emphasized: 'cubic-bezier(0.2, 0, 0, 1)',
    emphasizedAccelerate: 'cubic-bezier(0.3, 0, 0.8, 0.15)',
    emphasizedDecelerate: 'cubic-bezier(0.05, 0.7, 0.1, 1)',
  },
} as const;

/**
 * M3 Breakpoints
 * Responsive design breakpoints
 */
export const m3Breakpoints = {
  xs: 0,
  sm: 600,
  md: 960,
  lg: 1280,
  xl: 1920,
} as const;
