import { StyleSheet } from 'react-native';

// ========================================
// Design Tokens — 股票AI分析APP 深色主题
// 配色继承 Web 端：cyan 主色 + purple 辅色
// ========================================

export const colors = {
  // 主色系
  primary: '#00d4ff',
  primaryLight: '#33ddff',
  primaryDark: '#00a8cc',
  secondary: '#a855f7',
  secondaryLight: '#c084fc',

  // 涨跌色（红涨绿跌，与 Web 端一致）
  up: '#ff3b30',
  down: '#34c759',
  warning: '#ff9500',

  // 背景
  bg: '#0a0a0f',
  bgCard: 'rgba(255,255,255,0.03)',
  bgElevated: '#1a1a2e',
  bgOverlay: 'rgba(0,0,0,0.6)',

  // 文字
  textPrimary: '#f1f5f9',
  textSecondary: '#94a3b8',
  textMuted: '#64748b',

  // 边框/分隔
  borderCard: 'rgba(0,212,255,0.15)',
  borderSubtle: 'rgba(255,255,255,0.06)',
  divider: 'rgba(255,255,255,0.08)',

  // 特殊
  glassBorder: 'rgba(0,212,255,0.25)',
  skeleton: 'rgba(255,255,255,0.06)',
  skeletonHighlight: 'rgba(255,255,255,0.1)',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};

export const radius = {
  sm: 6,
  md: 12,
  lg: 16,
  xl: 20,
  full: 9999,
};

export const fontSize = {
  xs: 11,
  sm: 13,
  base: 14,
  md: 15,
  lg: 17,
  xl: 20,
  xxl: 24,
  title: 28,
};

export const shadows = {
  card: {
    shadowColor: '#00d4ff',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  elevated: {
    shadowColor: '#a855f7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 4,
  },
};

// ========================================
// 全局通用样式
// ========================================
export const globalStyles = StyleSheet.create({
  // 容器
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.bg,
  },
  contentPadding: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.lg,
  },
  scrollContent: {
    padding: spacing.md,
    paddingBottom: spacing.xl,
  },

  // 卡片基础
  card: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderCard,
    ...shadows.card,
  },
  cardPadding: {
    padding: spacing.md,
  },

  // 分隔线
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.divider,
  },

  // 标签
  chip: {
    paddingHorizontal: spacing.sm + 4,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.full,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  chipText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  chipActive: {
    backgroundColor: 'rgba(0,212,255,0.15)',
    borderColor: colors.primary,
  },
  chipTextActive: {
    color: colors.primary,
  },

  // Header 标题风格
  sectionTitle: {
    fontSize: fontSize.lg,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  sectionSubtitle: {
    fontSize: fontSize.s