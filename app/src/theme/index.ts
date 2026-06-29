import { MD3DarkTheme, MD3LightTheme } from "react-native-paper";
import type { MD3Theme } from "react-native-paper";

/**
 * Midnight — dark warm theme (Style C)
 * Sand — light warm theme (Style D)
 */

export const MidnightTheme: MD3Theme = {
  ...MD3DarkTheme,
  colors: {
    ...MD3DarkTheme.colors,
    primary:          "#C8A86A",
    onPrimary:        "#111110",
    primaryContainer: "#2A2318",
    onPrimaryContainer: "#F0D9A8",
    secondary:        "#A09888",
    onSecondary:      "#111110",
    secondaryContainer: "#2A2820",
    onSecondaryContainer: "#D0C8B8",
    background:       "#111110",
    onBackground:     "#E8E6E0",
    surface:          "#1C1C1A",
    onSurface:        "#E8E6E0",
    surfaceVariant:   "#2A2A28",
    onSurfaceVariant: "#A0A09A",
    outline:          "#3A3A38",
    outlineVariant:   "#2A2A28",
    error:            "#F87171",
    onError:          "#111110",
    errorContainer:   "#3D1515",
    onErrorContainer: "#F87171",
    inverseSurface:   "#E8E6E0",
    inverseOnSurface: "#1C1C1A",
    inversePrimary:   "#8B6F47",
    elevation: {
      level0: "transparent",
      level1: "#1C1C1A",
      level2: "#222220",
      level3: "#2A2A28",
      level4: "#2C2C2A",
      level5: "#303030",
    },
    surfaceDisabled:  "rgba(232,230,224,0.12)",
    onSurfaceDisabled: "rgba(232,230,224,0.38)",
    backdrop:         "rgba(0,0,0,0.6)",
  },
};

export const SandTheme: MD3Theme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary:          "#8B6F47",
    onPrimary:        "#FFFFFF",
    primaryContainer: "#EDE0D0",
    onPrimaryContainer: "#4A3520",
    secondary:        "#7A6858",
    onSecondary:      "#FFFFFF",
    secondaryContainer: "#EDE0D0",
    onSecondaryContainer: "#4A3520",
    background:       "#F5F0EB",
    onBackground:     "#2D2A26",
    surface:          "#FFFFFF",
    onSurface:        "#2D2A26",
    surfaceVariant:   "#EDE8E2",
    onSurfaceVariant: "#6A6058",
    outline:          "#C0B8B0",
    outlineVariant:   "#DDD5CB",
    error:            "#C0392B",
    onError:          "#FFFFFF",
    errorContainer:   "#FDECEA",
    onErrorContainer: "#8B1A14",
    inverseSurface:   "#2D2A26",
    inverseOnSurface: "#F5F0EB",
    inversePrimary:   "#C8A86A",
    elevation: {
      level0: "transparent",
      level1: "#F5F0EB",
      level2: "#EDE8E2",
      level3: "#E5DDD5",
      level4: "#E0D8D0",
      level5: "#D8D0C8",
    },
    surfaceDisabled:  "rgba(45,42,38,0.12)",
    onSurfaceDisabled: "rgba(45,42,38,0.38)",
    backdrop:         "rgba(0,0,0,0.4)",
  },
};

// Semantic color helpers that work with either theme
export function getColors(isDark: boolean) {
  return {
    positive: isDark ? "#4ADE80" : "#3A8C5C",
    negative: isDark ? "#F87171" : "#C0392B",
    accent:   isDark ? "#C8A86A" : "#8B6F47",
    bg:       isDark ? "#111110" : "#F5F0EB",
    surface:  isDark ? "#1C1C1A" : "#FFFFFF",
    elevated: isDark ? "#2A2A28" : "#EDE8E2",
    border:   isDark ? "#2A2A28" : "#DDD5CB",
    text:     isDark ? "#E8E6E0" : "#2D2A26",
    muted:    isDark ? "#666660" : "#9A9186",
    accentDim: isDark ? "#2A2318" : "#EDE0D0",
    textAccent: isDark ? "#C8A86A" : "#8B6F47",
    borderFaint: isDark ? "#222220" : "#EDE8E2",
  };
}

// Keep these for any legacy usage during migration
export const colors = {
  bg:         "#111110",
  surface:    "#1C1C1A",
  elevated:   "#2A2A28",
  accent:     "#C8A86A",
  accentDim:  "#2A2318",
  textPrimary:  "#E8E6E0",
  textMuted:    "#666660",
  textAccent:   "#C8A86A",
  positive:   "#4ADE80",
  negative:   "#F87171",
  warning:    "#FBBF24",
  border:     "#2A2A28",
  borderFaint: "#222220",
};

export const radius = {
  sm:   8,
  md:   14,
  lg:   20,
  full: 999,
};

export const space = {
  xs:  4,
  sm:  8,
  md:  16,
  lg:  24,
  xl:  32,
  xxl: 48,
};

export const shadow = {
  card: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
};

export const font = {
  display: "SpaceGrotesk",
  body:    "Inter",
};