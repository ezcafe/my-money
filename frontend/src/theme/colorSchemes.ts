/**
 * Material Design 3 Color Scheme System
 * Supports both dynamic (Material You) and static color schemes
 */

/**
 * Color scheme type
 */
export type ColorSchemeType = 'dynamic' | 'static' | null;

/**
 * Static color scheme names
 */
export type StaticColorSchemeName =
  | 'blue'
  | 'green'
  | 'purple'
  | 'orange'
  | 'red'
  | 'teal'
  | 'pink'
  | 'cyan'
  | 'indigo'
  | 'amber';

/**
 * Color palette structure
 */
export interface ColorPalette {
  primary: string;
  onPrimary: string;
  primaryContainer: string;
  onPrimaryContainer: string;
  secondary: string;
  onSecondary: string;
  secondaryContainer: string;
  onSecondaryContainer: string;
  tertiary: string;
  onTertiary: string;
  tertiaryContainer: string;
  onTertiaryContainer: string;
  error: string;
  onError: string;
  errorContainer: string;
  onErrorContainer: string;
  surface: string;
  onSurface: string;
  surfaceVariant: string;
  onSurfaceVariant: string;
  outline: string;
  outlineVariant: string;
  background: string;
  onBackground: string;
  inverseSurface: string;
  inverseOnSurface: string;
  inversePrimary: string;
  shadow: string;
  scrim: string;
  surfaceTint: string;
}

/**
 * Check if a string is a valid hex color
 * @param hex - String to validate
 * @returns True if the string is a valid hex color
 */
function isValidHexColor(hex: string): boolean {
  return /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.test(hex);
}

/**
 * Convert hex color to RGB
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result?.[1] || !result[2] || !result[3]) {
    throw new Error(`Invalid hex color: ${hex}`);
  }
  return {
    r: Number.parseInt(result[1], 16),
    g: Number.parseInt(result[2], 16),
    b: Number.parseInt(result[3], 16),
  };
}

/**
 * Convert RGB to hex
 */
function rgbToHex(r: number, g: number, b: number): string {
  return `#${[r, g, b]
    .map((x) => {
      const hex = x.toString(16);
      return hex.length === 1 ? `0${hex}` : hex;
    })
    .join('')}`;
}

/**
 * Convert RGB to HSL
 */
function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  r /= 255;
  g /= 255;
  b /= 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
      default:
        break;
    }
  }

  return { h: h * 360, s: s * 100, l: l * 100 };
}

/**
 * Convert HSL to RGB
 */
function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
  h /= 360;
  s /= 100;
  l /= 100;

  let r: number;
  let g: number;
  let b: number;

  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p: number, q: number, t: number): number => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }

  return {
    r: Math.round(r * 255),
    g: Math.round(g * 255),
    b: Math.round(b * 255),
  };
}

/**
 * Generate Material You dynamic color palette from source color
 * Based on Material Design 3 dynamic color algorithm
 */
export function generateDynamicPalette(sourceColor: string, isDark: boolean): ColorPalette {
  const rgb = hexToRgb(sourceColor);
  const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);

  // Adjust hue for primary color
  const primaryHue = hsl.h;
  const primarySaturation = Math.min(hsl.s, 40);
  const primaryLightness = isDark ? 80 : 50;

  // Generate primary color
  const primaryRgb = hslToRgb(primaryHue, primarySaturation, primaryLightness);
  const primary = rgbToHex(primaryRgb.r, primaryRgb.g, primaryRgb.b);

  // Generate secondary (complementary hue)
  const secondaryHue = (primaryHue + 60) % 360;
  const secondaryRgb = hslToRgb(secondaryHue, Math.min(primarySaturation, 30), isDark ? 75 : 45);
  const secondary = rgbToHex(secondaryRgb.r, secondaryRgb.g, secondaryRgb.b);

  // Generate tertiary (split complementary)
  const tertiaryHue = (primaryHue + 120) % 360;
  const tertiaryRgb = hslToRgb(tertiaryHue, Math.min(primarySaturation, 25), isDark ? 70 : 50);
  const tertiary = rgbToHex(tertiaryRgb.r, tertiaryRgb.g, tertiaryRgb.b);

  // Generate on-primary (contrast color)
  const onPrimary = isDark ? '#381E72' : '#FFFFFF';

  // Generate primary container
  const primaryContainerLightness = isDark ? 30 : 90;
  const primaryContainerRgb = hslToRgb(
    primaryHue,
    Math.min(primarySaturation * 0.5, 20),
    primaryContainerLightness
  );
  const primaryContainer = rgbToHex(
    primaryContainerRgb.r,
    primaryContainerRgb.g,
    primaryContainerRgb.b
  );
  const onPrimaryContainer = isDark ? '#EADDFF' : '#21005D';

  // Generate secondary colors
  const secondaryContainerLightness = isDark ? 30 : 90;
  const secondaryContainerRgb = hslToRgb(
    secondaryHue,
    Math.min(primarySaturation * 0.4, 15),
    secondaryContainerLightness
  );
  const secondaryContainer = rgbToHex(
    secondaryContainerRgb.r,
    secondaryContainerRgb.g,
    secondaryContainerRgb.b
  );
  const onSecondary = isDark ? '#332D41' : '#FFFFFF';
  const onSecondaryContainer = isDark ? '#E8DEF8' : '#1D192B';

  // Generate tertiary colors
  const tertiaryContainerLightness = isDark ? 30 : 90;
  const tertiaryContainerRgb = hslToRgb(
    tertiaryHue,
    Math.min(primarySaturation * 0.4, 15),
    tertiaryContainerLightness
  );
  const tertiaryContainer = rgbToHex(
    tertiaryContainerRgb.r,
    tertiaryContainerRgb.g,
    tertiaryContainerRgb.b
  );
  const onTertiary = isDark ? '#492532' : '#FFFFFF';
  const onTertiaryContainer = isDark ? '#FFD8E4' : '#31111D';

  // Error colors (consistent across themes)
  const error = isDark ? '#FFB4AB' : '#BA1A1A';
  const onError = isDark ? '#690005' : '#FFFFFF';
  const errorContainer = isDark ? '#93000A' : '#FFDAD6';
  const onErrorContainer = isDark ? '#FFDAD6' : '#410002';

  // Surface colors
  const surface = isDark ? '#1C1B1F' : '#FFFBFE';
  const onSurface = isDark ? '#E6E1E5' : '#1C1B1F';
  const surfaceVariant = isDark ? '#49454F' : '#E7E0EC';
  const onSurfaceVariant = isDark ? '#CAC4D0' : '#49454F';

  // Outline colors
  const outline = isDark ? '#938F99' : '#79747E';
  const outlineVariant = isDark ? '#49454F' : '#CAC4D0';

  // Background
  const background = isDark ? '#1C1B1F' : '#FFFBFE';
  const onBackground = isDark ? '#E6E1E5' : '#1C1B1F';

  // Inverse colors
  const inverseSurface = isDark ? '#E6E1E5' : '#313033';
  const inverseOnSurface = isDark ? '#313033' : '#F4EFF4';
  const inversePrimary = isDark ? '#6750A4' : primary;

  // Shadow and scrim
  const shadow = '#000000';
  const scrim = '#000000';
  const surfaceTint = primary;

  return {
    primary,
    onPrimary,
    primaryContainer,
    onPrimaryContainer,
    secondary,
    onSecondary,
    secondaryContainer,
    onSecondaryContainer,
    tertiary,
    onTertiary,
    tertiaryContainer,
    onTertiaryContainer,
    error,
    onError,
    errorContainer,
    onErrorContainer,
    surface,
    onSurface,
    surfaceVariant,
    onSurfaceVariant,
    outline,
    outlineVariant,
    background,
    onBackground,
    inverseSurface,
    inverseOnSurface,
    inversePrimary,
    shadow,
    scrim,
    surfaceTint,
  };
}

/**
 * Static color schemes
 * Predefined palettes for common color choices
 */
export const staticColorSchemes: Record<
  StaticColorSchemeName,
  { light: ColorPalette; dark: ColorPalette }
> = {
  blue: {
    light: {
      primary: '#006A6B',
      onPrimary: '#FFFFFF',
      primaryContainer: '#6FF6F7',
      onPrimaryContainer: '#002020',
      secondary: '#4A6363',
      onSecondary: '#FFFFFF',
      secondaryContainer: '#CCE8E7',
      onSecondaryContainer: '#051F1F',
      tertiary: '#456179',
      onTertiary: '#FFFFFF',
      tertiaryContainer: '#CCE5FF',
      onTertiaryContainer: '#001E31',
      error: '#BA1A1A',
      onError: '#FFFFFF',
      errorContainer: '#FFDAD6',
      onErrorContainer: '#410002',
      surface: '#FAFDFC',
      onSurface: '#191C1C',
      surfaceVariant: '#DAE5E4',
      onSurfaceVariant: '#3F4949',
      outline: '#6F7979',
      outlineVariant: '#BEC9C9',
      background: '#FAFDFC',
      onBackground: '#191C1C',
      inverseSurface: '#2E3131',
      inverseOnSurface: '#EFF1F1',
      inversePrimary: '#4CDADB',
      shadow: '#000000',
      scrim: '#000000',
      surfaceTint: '#006A6B',
    },
    dark: {
      primary: '#4CDADB',
      onPrimary: '#003738',
      primaryContainer: '#004F50',
      onPrimaryContainer: '#6FF6F7',
      secondary: '#B0CCCB',
      onSecondary: '#1A3535',
      secondaryContainer: '#324B4B',
      onSecondaryContainer: '#CCE8E7',
      tertiary: '#A5C8E3',
      onTertiary: '#0F3449',
      tertiaryContainer: '#2B4A62',
      onTertiaryContainer: '#CCE5FF',
      error: '#FFB4AB',
      onError: '#690005',
      errorContainer: '#93000A',
      onErrorContainer: '#FFDAD6',
      surface: '#0F1515',
      onSurface: '#C4C7C7',
      surfaceVariant: '#3F4949',
      onSurfaceVariant: '#BEC9C9',
      outline: '#899393',
      outlineVariant: '#3F4949',
      background: '#0F1515',
      onBackground: '#C4C7C7',
      inverseSurface: '#C4C7C7',
      inverseOnSurface: '#191C1C',
      inversePrimary: '#006A6B',
      shadow: '#000000',
      scrim: '#000000',
      surfaceTint: '#4CDADB',
    },
  },
  green: {
    light: {
      primary: '#006E1C',
      onPrimary: '#FFFFFF',
      primaryContainer: '#95F990',
      onPrimaryContainer: '#002204',
      secondary: '#536352',
      onSecondary: '#FFFFFF',
      secondaryContainer: '#D6E8D1',
      onSecondaryContainer: '#111F10',
      tertiary: '#386667',
      onTertiary: '#FFFFFF',
      tertiaryContainer: '#BBEBEC',
      onTertiaryContainer: '#001F20',
      error: '#BA1A1A',
      onError: '#FFFFFF',
      errorContainer: '#FFDAD6',
      onErrorContainer: '#410002',
      surface: '#FCFDF6',
      onSurface: '#1A1C19',
      surfaceVariant: '#DEE5D9',
      onSurfaceVariant: '#424940',
      outline: '#72796F',
      outlineVariant: '#C2C9BD',
      background: '#FCFDF6',
      onBackground: '#1A1C19',
      inverseSurface: '#2F312E',
      inverseOnSurface: '#F0F1EB',
      inversePrimary: '#79DC7A',
      shadow: '#000000',
      scrim: '#000000',
      surfaceTint: '#006E1C',
    },
    dark: {
      primary: '#79DC7A',
      onPrimary: '#003908',
      primaryContainer: '#005313',
      onPrimaryContainer: '#95F990',
      secondary: '#BACBB5',
      onSecondary: '#253424',
      secondaryContainer: '#3B4B3A',
      onSecondaryContainer: '#D6E8D1',
      tertiary: '#9FCFD0',
      onTertiary: '#003738',
      tertiaryContainer: '#1E4E4F',
      onTertiaryContainer: '#BBEBEC',
      error: '#FFB4AB',
      onError: '#690005',
      errorContainer: '#93000A',
      onErrorContainer: '#FFDAD6',
      surface: '#111411',
      onSurface: '#E1E3DD',
      surfaceVariant: '#424940',
      onSurfaceVariant: '#C2C9BD',
      outline: '#8C9388',
      outlineVariant: '#424940',
      background: '#111411',
      onBackground: '#E1E3DD',
      inverseSurface: '#E1E3DD',
      inverseOnSurface: '#1A1C19',
      inversePrimary: '#006E1C',
      shadow: '#000000',
      scrim: '#000000',
      surfaceTint: '#79DC7A',
    },
  },
  purple: {
    light: {
      primary: '#6750A4',
      onPrimary: '#FFFFFF',
      primaryContainer: '#EADDFF',
      onPrimaryContainer: '#21005D',
      secondary: '#625B71',
      onSecondary: '#FFFFFF',
      secondaryContainer: '#E8DEF8',
      onSecondaryContainer: '#1D192B',
      tertiary: '#7D5260',
      onTertiary: '#FFFFFF',
      tertiaryContainer: '#FFD8E4',
      onTertiaryContainer: '#31111D',
      error: '#BA1A1A',
      onError: '#FFFFFF',
      errorContainer: '#FFDAD6',
      onErrorContainer: '#410002',
      surface: '#FFFBFE',
      onSurface: '#1C1B1F',
      surfaceVariant: '#E7E0EC',
      onSurfaceVariant: '#49454F',
      outline: '#79747E',
      outlineVariant: '#CAC4D0',
      background: '#FFFBFE',
      onBackground: '#1C1B1F',
      inverseSurface: '#313033',
      inverseOnSurface: '#F4EFF4',
      inversePrimary: '#D0BCFF',
      shadow: '#000000',
      scrim: '#000000',
      surfaceTint: '#6750A4',
    },
    dark: {
      primary: '#D0BCFF',
      onPrimary: '#381E72',
      primaryContainer: '#4F378B',
      onPrimaryContainer: '#EADDFF',
      secondary: '#CCC2DC',
      onSecondary: '#332D41',
      secondaryContainer: '#4A4458',
      onSecondaryContainer: '#E8DEF8',
      tertiary: '#EFB8C8',
      onTertiary: '#492532',
      tertiaryContainer: '#633B48',
      onTertiaryContainer: '#FFD8E4',
      error: '#FFB4AB',
      onError: '#690005',
      errorContainer: '#93000A',
      onErrorContainer: '#FFDAD6',
      surface: '#1C1B1F',
      onSurface: '#E6E1E5',
      surfaceVariant: '#49454F',
      onSurfaceVariant: '#CAC4D0',
      outline: '#938F99',
      outlineVariant: '#49454F',
      background: '#1C1B1F',
      onBackground: '#E6E1E5',
      inverseSurface: '#E6E1E5',
      inverseOnSurface: '#313033',
      inversePrimary: '#6750A4',
      shadow: '#000000',
      scrim: '#000000',
      surfaceTint: '#D0BCFF',
    },
  },
  orange: {
    light: {
      primary: '#9C4221',
      onPrimary: '#FFFFFF',
      primaryContainer: '#FFDBCE',
      onPrimaryContainer: '#3A0A00',
      secondary: '#77574A',
      onSecondary: '#FFFFFF',
      secondaryContainer: '#FFDBCE',
      onSecondaryContainer: '#2C160B',
      tertiary: '#6B5D2F',
      onTertiary: '#FFFFFF',
      tertiaryContainer: '#F5E0A7',
      onTertiaryContainer: '#231B00',
      error: '#BA1A1A',
      onError: '#FFFFFF',
      errorContainer: '#FFDAD6',
      onErrorContainer: '#410002',
      surface: '#FFFBF9',
      onSurface: '#231917',
      surfaceVariant: '#F4DDD6',
      onSurfaceVariant: '#53433E',
      outline: '#85736C',
      outlineVariant: '#D7C2BA',
      background: '#FFFBF9',
      onBackground: '#231917',
      inverseSurface: '#382E2B',
      inverseOnSurface: '#FFEDE7',
      inversePrimary: '#FFB59C',
      shadow: '#000000',
      scrim: '#000000',
      surfaceTint: '#9C4221',
    },
    dark: {
      primary: '#FFB59C',
      onPrimary: '#5D1500',
      primaryContainer: '#7D2A0C',
      onPrimaryContainer: '#FFDBCE',
      secondary: '#E7BEAF',
      onSecondary: '#432A1F',
      secondaryContainer: '#5D4034',
      onSecondaryContainer: '#FFDBCE',
      tertiary: '#D8C48D',
      onTertiary: '#3B3005',
      tertiaryContainer: '#52461A',
      onTertiaryContainer: '#F5E0A7',
      error: '#FFB4AB',
      onError: '#690005',
      errorContainer: '#93000A',
      onErrorContainer: '#FFDAD6',
      surface: '#1A100D',
      onSurface: '#FFEDE7',
      surfaceVariant: '#53433E',
      onSurfaceVariant: '#D7C2BA',
      outline: '#A08D85',
      outlineVariant: '#53433E',
      background: '#1A100D',
      onBackground: '#FFEDE7',
      inverseSurface: '#FFEDE7',
      inverseOnSurface: '#382E2B',
      inversePrimary: '#9C4221',
      shadow: '#000000',
      scrim: '#000000',
      surfaceTint: '#FFB59C',
    },
  },
  red: {
    light: {
      primary: '#C00114',
      onPrimary: '#FFFFFF',
      primaryContainer: '#FFDAD6',
      onPrimaryContainer: '#410002',
      secondary: '#775654',
      onSecondary: '#FFFFFF',
      secondaryContainer: '#FFDAD6',
      onSecondaryContainer: '#2C1514',
      tertiary: '#735B2E',
      onTertiary: '#FFFFFF',
      tertiaryContainer: '#FFDEA6',
      onTertiaryContainer: '#271900',
      error: '#BA1A1A',
      onError: '#FFFFFF',
      errorContainer: '#FFDAD6',
      onErrorContainer: '#410002',
      surface: '#FFFBF9',
      onSurface: '#231917',
      surfaceVariant: '#F4DDD6',
      onSurfaceVariant: '#53433E',
      outline: '#85736C',
      outlineVariant: '#D7C2BA',
      background: '#FFFBF9',
      onBackground: '#231917',
      inverseSurface: '#382E2B',
      inverseOnSurface: '#FFEDE7',
      inversePrimary: '#FFB4AB',
      shadow: '#000000',
      scrim: '#000000',
      surfaceTint: '#C00114',
    },
    dark: {
      primary: '#FFB4AB',
      onPrimary: '#680003',
      primaryContainer: '#930006',
      onPrimaryContainer: '#FFDAD6',
      secondary: '#E7BDB8',
      onSecondary: '#442928',
      secondaryContainer: '#5D3F3D',
      onSecondaryContainer: '#FFDAD6',
      tertiary: '#E1C28C',
      onTertiary: '#3E2E04',
      tertiaryContainer: '#574419',
      onTertiaryContainer: '#FFDEA6',
      error: '#FFB4AB',
      onError: '#690005',
      errorContainer: '#93000A',
      onErrorContainer: '#FFDAD6',
      surface: '#1A100D',
      onSurface: '#FFEDE7',
      surfaceVariant: '#53433E',
      onSurfaceVariant: '#D7C2BA',
      outline: '#A08D85',
      outlineVariant: '#53433E',
      background: '#1A100D',
      onBackground: '#FFEDE7',
      inverseSurface: '#FFEDE7',
      inverseOnSurface: '#382E2B',
      inversePrimary: '#C00114',
      shadow: '#000000',
      scrim: '#000000',
      surfaceTint: '#FFB4AB',
    },
  },
  teal: {
    light: {
      primary: '#006A60',
      onPrimary: '#FFFFFF',
      primaryContainer: '#6FF7ED',
      onPrimaryContainer: '#00201C',
      secondary: '#4A6360',
      onSecondary: '#FFFFFF',
      secondaryContainer: '#CCE8E4',
      onSecondaryContainer: '#051F1C',
      tertiary: '#456179',
      onTertiary: '#FFFFFF',
      tertiaryContainer: '#CCE5FF',
      onTertiaryContainer: '#001E31',
      error: '#BA1A1A',
      onError: '#FFFFFF',
      errorContainer: '#FFDAD6',
      onErrorContainer: '#410002',
      surface: '#FAFDFB',
      onSurface: '#191C1B',
      surfaceVariant: '#DAE5E2',
      onSurfaceVariant: '#3F4947',
      outline: '#6F7977',
      outlineVariant: '#BEC9C6',
      background: '#FAFDFB',
      onBackground: '#191C1B',
      inverseSurface: '#2E3130',
      inverseOnSurface: '#EFF1EF',
      inversePrimary: '#4CDBD3',
      shadow: '#000000',
      scrim: '#000000',
      surfaceTint: '#006A60',
    },
    dark: {
      primary: '#4CDBD3',
      onPrimary: '#003731',
      primaryContainer: '#00504A',
      onPrimaryContainer: '#6FF7ED',
      secondary: '#B0CCC8',
      onSecondary: '#1B3532',
      secondaryContainer: '#324B48',
      onSecondaryContainer: '#CCE8E4',
      tertiary: '#A5C8E3',
      onTertiary: '#0F3449',
      tertiaryContainer: '#2B4A62',
      onTertiaryContainer: '#CCE5FF',
      error: '#FFB4AB',
      onError: '#690005',
      errorContainer: '#93000A',
      onErrorContainer: '#FFDAD6',
      surface: '#0F1514',
      onSurface: '#C4C7C5',
      surfaceVariant: '#3F4947',
      onSurfaceVariant: '#BEC9C6',
      outline: '#899391',
      outlineVariant: '#3F4947',
      background: '#0F1514',
      onBackground: '#C4C7C5',
      inverseSurface: '#C4C7C5',
      inverseOnSurface: '#191C1B',
      inversePrimary: '#006A60',
      shadow: '#000000',
      scrim: '#000000',
      surfaceTint: '#4CDBD3',
    },
  },
  pink: {
    light: {
      primary: '#8B4A6B',
      onPrimary: '#FFFFFF',
      primaryContainer: '#FFD8E8',
      onPrimaryContainer: '#38071A',
      secondary: '#6E5865',
      onSecondary: '#FFFFFF',
      secondaryContainer: '#F7DAE6',
      onSecondaryContainer: '#271420',
      tertiary: '#815343',
      onTertiary: '#FFFFFF',
      tertiaryContainer: '#FFDBCE',
      onTertiaryContainer: '#31120A',
      error: '#BA1A1A',
      onError: '#FFFFFF',
      errorContainer: '#FFDAD6',
      onErrorContainer: '#410002',
      surface: '#FFFBF9',
      onSurface: '#231917',
      surfaceVariant: '#F4DDD6',
      onSurfaceVariant: '#53433E',
      outline: '#85736C',
      outlineVariant: '#D7C2BA',
      background: '#FFFBF9',
      onBackground: '#231917',
      inverseSurface: '#382E2B',
      inverseOnSurface: '#FFEDE7',
      inversePrimary: '#FFB0D0',
      shadow: '#000000',
      scrim: '#000000',
      surfaceTint: '#8B4A6B',
    },
    dark: {
      primary: '#FFB0D0',
      onPrimary: '#541B35',
      primaryContainer: '#6F3250',
      onPrimaryContainer: '#FFD8E8',
      secondary: '#DABECB',
      onSecondary: '#3E2834',
      secondaryContainer: '#563E4B',
      onSecondaryContainer: '#F7DAE6',
      tertiary: '#F5BAA8',
      onTertiary: '#4B2518',
      tertiaryContainer: '#663B2C',
      onTertiaryContainer: '#FFDBCE',
      error: '#FFB4AB',
      onError: '#690005',
      errorContainer: '#93000A',
      onErrorContainer: '#FFDAD6',
      surface: '#1A100D',
      onSurface: '#FFEDE7',
      surfaceVariant: '#53433E',
      onSurfaceVariant: '#D7C2BA',
      outline: '#A08D85',
      outlineVariant: '#53433E',
      background: '#1A100D',
      onBackground: '#FFEDE7',
      inverseSurface: '#FFEDE7',
      inverseOnSurface: '#382E2B',
      inversePrimary: '#8B4A6B',
      shadow: '#000000',
      scrim: '#000000',
      surfaceTint: '#FFB0D0',
    },
  },
  cyan: {
    light: {
      primary: '#006874',
      onPrimary: '#FFFFFF',
      primaryContainer: '#9EEFFD',
      onPrimaryContainer: '#001F24',
      secondary: '#4A6267',
      onSecondary: '#FFFFFF',
      secondaryContainer: '#CCE7ED',
      onSecondaryContainer: '#051F23',
      tertiary: '#565E7E',
      onTertiary: '#FFFFFF',
      tertiaryContainer: '#DEE1FF',
      onTertiaryContainer: '#111B3C',
      error: '#BA1A1A',
      onError: '#FFFFFF',
      errorContainer: '#FFDAD6',
      onErrorContainer: '#410002',
      surface: '#F8FDFF',
      onSurface: '#191C1D',
      surfaceVariant: '#DBE4E7',
      onSurfaceVariant: '#3F484B',
      outline: '#6F797B',
      outlineVariant: '#BFC8CB',
      background: '#F8FDFF',
      onBackground: '#191C1D',
      inverseSurface: '#2E3132',
      inverseOnSurface: '#EFF1F3',
      inversePrimary: '#4FD8EB',
      shadow: '#000000',
      scrim: '#000000',
      surfaceTint: '#006874',
    },
    dark: {
      primary: '#4FD8EB',
      onPrimary: '#00363D',
      primaryContainer: '#004D58',
      onPrimaryContainer: '#9EEFFD',
      secondary: '#B0CBCF',
      onSecondary: '#1A3439',
      secondaryContainer: '#334A4F',
      onSecondaryContainer: '#CCE7ED',
      tertiary: '#BEC2E8',
      onTertiary: '#263051',
      tertiaryContainer: '#3E4665',
      onTertiaryContainer: '#DEE1FF',
      error: '#FFB4AB',
      onError: '#690005',
      errorContainer: '#93000A',
      onErrorContainer: '#FFDAD6',
      surface: '#0F1416',
      onSurface: '#C4C7C8',
      surfaceVariant: '#3F484B',
      onSurfaceVariant: '#BFC8CB',
      outline: '#899295',
      outlineVariant: '#3F484B',
      background: '#0F1416',
      onBackground: '#C4C7C8',
      inverseSurface: '#C4C7C8',
      inverseOnSurface: '#191C1D',
      inversePrimary: '#006874',
      shadow: '#000000',
      scrim: '#000000',
      surfaceTint: '#4FD8EB',
    },
  },
  indigo: {
    light: {
      primary: '#3D5AA8',
      onPrimary: '#FFFFFF',
      primaryContainer: '#DCE1FF',
      onPrimaryContainer: '#001258',
      secondary: '#5A5D72',
      onSecondary: '#FFFFFF',
      secondaryContainer: '#DEE1F9',
      onSecondaryContainer: '#161B2C',
      tertiary: '#76546A',
      onTertiary: '#FFFFFF',
      tertiaryContainer: '#FFD8E8',
      onTertiaryContainer: '#2D1225',
      error: '#BA1A1A',
      onError: '#FFFFFF',
      errorContainer: '#FFDAD6',
      onErrorContainer: '#410002',
      surface: '#FEFBFF',
      onSurface: '#1A1B21',
      surfaceVariant: '#E3E1EC',
      onSurfaceVariant: '#46464F',
      outline: '#767680',
      outlineVariant: '#C6C5D0',
      background: '#FEFBFF',
      onBackground: '#1A1B21',
      inverseSurface: '#2F3036',
      inverseOnSurface: '#F1F0F4',
      inversePrimary: '#B4C5FF',
      shadow: '#000000',
      scrim: '#000000',
      surfaceTint: '#3D5AA8',
    },
    dark: {
      primary: '#B4C5FF',
      onPrimary: '#00228C',
      primaryContainer: '#1F3E90',
      onPrimaryContainer: '#DCE1FF',
      secondary: '#C2C5DD',
      onSecondary: '#2B3042',
      secondaryContainer: '#424659',
      onSecondaryContainer: '#DEE1F9',
      tertiary: '#E4BDD2',
      onTertiary: '#44263B',
      tertiaryContainer: '#5C3C52',
      onTertiaryContainer: '#FFD8E8',
      error: '#FFB4AB',
      onError: '#690005',
      errorContainer: '#93000A',
      onErrorContainer: '#FFDAD6',
      surface: '#121318',
      onSurface: '#E3E1E9',
      surfaceVariant: '#46464F',
      onSurfaceVariant: '#C6C5D0',
      outline: '#90909A',
      outlineVariant: '#46464F',
      background: '#121318',
      onBackground: '#E3E1E9',
      inverseSurface: '#E3E1E9',
      inverseOnSurface: '#2F3036',
      inversePrimary: '#3D5AA8',
      shadow: '#000000',
      scrim: '#000000',
      surfaceTint: '#B4C5FF',
    },
  },
  amber: {
    light: {
      primary: '#8C5000',
      onPrimary: '#FFFFFF',
      primaryContainer: '#FFDBCE',
      onPrimaryContainer: '#2D1600',
      secondary: '#76574A',
      onSecondary: '#FFFFFF',
      secondaryContainer: '#FFDBCE',
      onSecondaryContainer: '#2C160B',
      tertiary: '#5E6332',
      onTertiary: '#FFFFFF',
      tertiaryContainer: '#E3E8AB',
      onTertiaryContainer: '#1B1E00',
      error: '#BA1A1A',
      onError: '#FFFFFF',
      errorContainer: '#FFDAD6',
      onErrorContainer: '#410002',
      surface: '#FFFBF9',
      onSurface: '#231917',
      surfaceVariant: '#F4DDD6',
      onSurfaceVariant: '#53433E',
      outline: '#85736C',
      outlineVariant: '#D7C2BA',
      background: '#FFFBF9',
      onBackground: '#231917',
      inverseSurface: '#382E2B',
      inverseOnSurface: '#FFEDE7',
      inversePrimary: '#FFB68C',
      shadow: '#000000',
      scrim: '#000000',
      surfaceTint: '#8C5000',
    },
    dark: {
      primary: '#FFB68C',
      onPrimary: '#4A2800',
      primaryContainer: '#6B3A00',
      onPrimaryContainer: '#FFDBCE',
      secondary: '#E7BEAF',
      onSecondary: '#432A1F',
      secondaryContainer: '#5D4034',
      onSecondaryContainer: '#FFDBCE',
      tertiary: '#C7CC7F',
      onTertiary: '#303508',
      tertiaryContainer: '#474C1C',
      onTertiaryContainer: '#E3E8AB',
      error: '#FFB4AB',
      onError: '#690005',
      errorContainer: '#93000A',
      onErrorContainer: '#FFDAD6',
      surface: '#1A100D',
      onSurface: '#FFEDE7',
      surfaceVariant: '#53433E',
      onSurfaceVariant: '#D7C2BA',
      outline: '#A08D85',
      outlineVariant: '#53433E',
      background: '#1A100D',
      onBackground: '#FFEDE7',
      inverseSurface: '#FFEDE7',
      inverseOnSurface: '#382E2B',
      inversePrimary: '#8C5000',
      shadow: '#000000',
      scrim: '#000000',
      surfaceTint: '#FFB68C',
    },
  },
};

/**
 * Get color palette based on scheme type and value
 */
export function getColorPalette(
  schemeType: ColorSchemeType,
  schemeValue: string | null | undefined,
  isDark: boolean
): ColorPalette {
  if (schemeType === 'dynamic' && schemeValue) {
    // Validate that schemeValue is a valid hex color
    // If not, default to a valid hex color
    const validHexColor = isValidHexColor(schemeValue) ? schemeValue : '#6750A4';
    return generateDynamicPalette(validHexColor, isDark);
  }

  if (schemeType === 'static' && schemeValue) {
    const scheme = staticColorSchemes[schemeValue as StaticColorSchemeName];
    if (scheme) {
      return isDark ? scheme.dark : scheme.light;
    }
  }

  // Default to purple static scheme
  return isDark ? staticColorSchemes.purple.dark : staticColorSchemes.purple.light;
}

/**
 * Get list of available static color scheme names
 */
export function getStaticColorSchemeNames(): StaticColorSchemeName[] {
  return Object.keys(staticColorSchemes) as StaticColorSchemeName[];
}
