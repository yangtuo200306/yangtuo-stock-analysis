import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ViewStyle } from 'react-native';
import { useTheme, colors, spacing, borderRadius, fontSize } from '../theme';
import { CHANGE_COLORS, CHANGE_SYMBOLS } from '../constants';

interface StockCardProps {
  name: string;
  code: string;
  price?: number;
  change?: number;
  changePercent?: number;
  onPress?: () => void;
  rightSlot?: React.ReactNode;
  bottomSlot?: React.ReactNode;
  style?: ViewStyle;
  loading?: boolean;
}

export default function StockCard({
  name, code, price, change, changePercent,
  onPress, rightSlot, bottomSlot, style, loading
}: StockCardProps) {
  const { theme, isDark } = useTheme();

  const changeColor = change === undefined ? theme.textMuted
    : change > 0 ? CHANGE_COLORS.up
    : change < 0 ? CHANGE_COLORS.down
    : CHANGE_COLORS.flat;

  const changeSymbol = change === undefined ? CHANGE_SYMBOLS.flat
    : change > 0 ? CHANGE_SYMBOLS.up
    : change < 0 ? CHANGE_SYMBOLS.down
    : CHANGE_SYMBOLS.flat;

  const formatPrice = (v?: number) => v !== undefined ? `¥${v.toFixed(2)}` : '—';
  const formatPercent = (v?: number) => v !== undefined ? `${v >= 0 ? '+' : ''}${v.toFixed(2)}%` : '—';

  const Card = onPress ? TouchableOpacity : View;

  return (
    <Card
      style={[
        styles.card,
        {
          backgroundColor: theme.card,
          borderColor: theme.border,
        },
        onPress && styles.cardPressable,
        style,
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {/* 顶部：名称 + 代码 + 右侧插槽 */}
      <View style={styles.topRow}>
        <View style={styles.nameRow}>
          <Text style={[styles.name, { color: theme.text }]}>{name}</Text>
          <Text style={[styles.code, { color: theme.textMuted }]}>{code}</Text>
        </View>
        {rightSlot}
      </View>

      {/* 中间：价格行情 */}
      {!loading && (
        <View style={styles.priceRow}>
          <Text style={[styles.price, { color: theme.text }]}>
            {formatPrice(price)}
          </Text>
          <View style={[styles.changeBadge, { backgroundColor: changeColor + '20' }]}>
            <Text style={[styles.changeText, { color: changeColor }]}>
              {changeSymbol} {formatPercent(changePercent)}
            </Text>
          </View>
        </View>
      )}

      {/* 底部插槽：评分/建议等 */}
      {bottomSlot && (
        <View style={[styles.bottomSlot, { borderTopColor: theme.borderLight }]}>
          {bottomSlot}
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    padding: spacing.lg,
    marginHorizontal: spacing.lg,
    marginVertical: spacing.xs,
  },
  cardPressable: {},
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.sm,
  },
  name: {
    fontSize: fontSize.lg,
    fontWeight: '600',
  },
  code: {
    fontSize: fontSize.sm,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  price: {
    fontSize: fontSize['2xl'],
    fontWeight: '700',
  },
  changeBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  changeText: {
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  bottomSlot: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});