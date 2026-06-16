import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { useTheme, colors, spacing, borderRadius, fontSize } from "../theme";

// ── Props ────────────────────────────────────────────────────────────────

export interface FallbackHandlerProps {
  /** True while the fallback request is in flight. */
  loading: boolean;
  /** Error message to display. */
  error?: string;
  /** Called when the user taps retry. */
  onRetry?: () => void;
  /** Called when the user taps cancel. */
  onCancel?: () => void;
}

// ── Component ────────────────────────────────────────────────────────────

export function FallbackHandler({
  loading,
  error,
  onRetry,
  onCancel,
}: FallbackHandlerProps) {
  const { theme } = useTheme();

  if (!error && !loading) return null;

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: theme.card, borderTopColor: colors.warning },
      ]}
    >
      {loading ? (
        <View style={styles.row}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={[styles.text, { color: theme.textMuted }]}>
            正在切换到基础模式...
          </Text>
        </View>
      ) : (
        <>
          <Text style={[styles.text, { color: colors.error }]}>
            {"\u26A0\uFE0F"} {error || "请求失败"}
          </Text>
          <View style={styles.actions}>
            {onCancel && (
              <TouchableOpacity
                style={[
                  styles.btn,
                  { backgroundColor: theme.inputBackground },
                ]}
                onPress={onCancel}
              >
                <Text
                  style={[styles.btnText, { color: theme.textSecondary }]}
                >
                  取消
                </Text>
              </TouchableOpacity>
            )}
            {onRetry && (
              <TouchableOpacity
                style={[styles.btn, { backgroundColor: colors.primary }]}
                onPress={onRetry}
              >
                <Text style={styles.btnTextPrimary}>重试</Text>
              </TouchableOpacity>
            )}
          </View>
        </>
      )}
    </View>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  text: {
    fontSize: 13,
    fontWeight: "500",
    flex: 1,
  },
  actions: {
    flexDirection: "row",
    gap: 8,
  },
  btn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  btnText: {
    fontSize: 13,
    fontWeight: "500",
  },
  btnTextPrimary: {
    color: "#FFF",
    fontSize: 13,
    fontWeight: "500",
  },
});
