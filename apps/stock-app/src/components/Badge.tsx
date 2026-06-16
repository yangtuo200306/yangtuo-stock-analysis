import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme, colors, spacing, borderRadius, fontSize } from '../theme';

interface BadgeProps {
  text: string;
  variant?: 'default' | 'up' | 'down' | 'buy' | 'sell' | 'hold' | 'watch' | 'info' | 'warning';
  small?: boolean;
}

const variantColors: Record<string, { bg: string; text: string }> = {
  default: { bg: '#2A2A2E', text: '#94A3B8' },
  up: { bg: '#22C55E20', text: '#22C55E' },
  down: { bg: '#EF444420', text: '#EF4444' },
  buy: { bg: '#22C55E20', text: '#22C55E' },
  sell: { bg: '#EF444420', text: '#EF4444' },
  hold: { bg: '#F59E0B20', text: '#F59E0B' },
  watch: { bg: '#3B82F620', text: '#3B82F6' },
  info: { bg: '#00D4FF20', text: '#00D4FF' },
  warning: { bg: '#F59E0B20', text: '#F59E0B' },
};

export default function Badge({ text, variant = 'default', small = false }: BadgeProps) {
  const { isDark } = useTheme();
  const v = variantColors[variant] || variantColors.default;

  return (
    <View style={[
      styles.badge,
      { backgroundColor: v.bg },
      small && styles.small,
    ]}>
      <Text style={[
        styles.text,
        { color: v.text },
        small && styles.smallText,
      ]}>
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: borderRadius.sm,
    alignSelf: 'flex-start',
  },
  small: {
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  text: {
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  smallText: {
    fontSize: fontSize.xs,
  },
});