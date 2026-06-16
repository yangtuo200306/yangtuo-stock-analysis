import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, ViewStyle } from 'react-native';
import { useTheme, spacing, borderRadius } from '../theme';

interface SkeletonProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
}

function SkeletonBlock({ width = '100%', height = 16, borderRadius: br = 6, style }: SkeletonProps) {
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.7,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.3,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [opacity]);

  const { isDark } = useTheme();

  return (
    <Animated.View
      style={[
        {
          width: width as any,
          height,
          borderRadius: br,
          backgroundColor: isDark ? '#1E1E22' : '#E2E8F0',
          opacity,
        },
        style,
      ]}
    />
  );
}

// ─── 自选列表骨架屏 ────────────────────────────────────────

export function StockListSkeleton({ count = 3 }: { count?: number }) {
  const { theme } = useTheme();
  return (
    <View style={{ paddingTop: spacing.sm }}>
      {Array.from({ length: count }).map((_, i) => (
        <View
          key={i}
          style={[
            styles.card,
            {
              backgroundColor: theme.card,
              borderColor: theme.border,
              marginBottom: spacing.sm,
            },
          ]}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.sm }}>
            <SkeletonBlock width={120} height={18} />
            <SkeletonBlock width={60} height={18} />
          </View>
          <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'center' }}>
            <SkeletonBlock width={100} height={28} />
            <SkeletonBlock width={80} height={22} borderRadius={6} />
          </View>
        </View>
      ))}
    </View>
  );
}

// ─── 分析报告骨架屏 ────────────────────────────────────────

export function ReportSkeleton() {
  const { theme } = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
      <SkeletonBlock width={120} height={20} style={{ marginBottom: spacing.lg }} />
      <SkeletonBlock width="100%" height={120} borderRadius={10} style={{ marginBottom: spacing.lg }} />
      <SkeletonBlock width="100%" height={14} style={{ marginBottom: spacing.sm }} />
      <SkeletonBlock width="90%" height={14} style={{ marginBottom: spacing.sm }} />
      <SkeletonBlock width="80%" height={14} style={{ marginBottom: spacing.sm }} />
      <SkeletonBlock width="95%" height={14} style={{ marginBottom: spacing.sm }} />
      <SkeletonBlock width="60%" height={14} />
    </View>
  );
}

// ─── 页面骨架屏 ────────────────────────────────────────────

export function PageSkeleton() {
  const { theme } = useTheme();
  return (
    <View style={{ flex: 1, padding: spacing.lg }}>
      <StockListSkeleton count={2} />
      <View style={{ height: spacing.lg }} />
      <ReportSkeleton />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    padding: spacing.lg,
    marginHorizontal: spacing.lg,
  },
});