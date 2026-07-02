/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import { Platform } from 'react-native';

const tintColorLight = '#0a7ea4';
const tintColorDark = '#fff';

export const Colors = {
  light: {
    text: '#11181C',
    background: '#fff',
    tint: tintColorLight,
    icon: '#687076',
    tabIconDefault: '#687076',
    tabIconSelected: tintColorLight,
  },
  dark: {
    text: '#ECEDEE',
    background: '#151718',
    tint: tintColorDark,
    icon: '#9BA1A6',
    tabIconDefault: '#9BA1A6',
    tabIconSelected: tintColorDark,
  },
};

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});

export const COLORS = {
  primary: '#004d99',
  accent: '#d32f2f',
  background: '#f5f6fa',
  card: '#ffffff',
  text: '#222',
  textSecondary: '#888',
  border: '#e0e0e0',
  shadow: '#dce6f1',
};

export const SIZES = {
  padding: 16,
  borderRadius: 12,
  font: 16,
  fontLarge: 22,
  fontSmall: 12,
};

export const SHADOW = {
  shadowColor: COLORS.shadow,
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.15,
  shadowRadius: 6,
  elevation: 4,
};

export const FONT = {
  regular: 'System',
  bold: 'System',
};

export const BRAND = {
  colors: {
    bg: '#06080f',
    bgAlt: '#0b1120',
    card: '#0f1628',
    cardAlt: '#131c32',
    text: '#f2f6ff',
    textMuted: '#9aa8c7',
    accent: '#c7a331',
    accentStrong: '#46f1ff',
    border: '#25324a',
    danger: '#ff6b6b',
    success: '#4de6a1',
    glowBlue: '#2cc7ff',
    glowGold: '#ffd26a',
    ink: '#0a0d17',
  },
  radius: {
    sm: 10,
    md: 16,
    lg: 22,
    xl: 28,
    pill: 999,
  },
  fonts: {
    title: 'Orbitron_600SemiBold',
    body: 'Sora_400Regular',
    semi: 'Sora_600SemiBold',
  },
};
