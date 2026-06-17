import React, { Component, type ErrorInfo, type ReactNode } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { colors, fontSize, spacing, borderRadius } from "../theme";

// ── Props ────────────────────────────────────────────────────────────────

interface ErrorBoundaryProps {
  children: ReactNode;
  /** Display name for error reporting, e.g. "WatchlistScreen". */
  name?: string;
  /** Optional custom fallback. When omitted, the default ErrorFallback is used. */
  fallback?: ReactNode | ((error: Error, retry: () => void) => ReactNode);
}

interface ErrorBoundaryState {
  error: Error | null;
}

// ── Error logging helper ─────────────────────────────────────────────────

function reportError(error: Error, info: ErrorInfo, name?: string): void {
  const tag = name ? `[ErrorBoundary:${name}]` : "[ErrorBoundary]";
  console.error(`${tag} Caught an error:`, error);
  console.error(`${tag} Component stack:`, info.componentStack);
  // Future: send to Sentry / Datadog / custom log service
  // e.g. logService.captureException(error, { extra: { componentStack: info.componentStack, boundaryName: name } });
}

// ── Default fallback UI ──────────────────────────────────────────────────

interface ErrorFallbackProps {
  error: Error;
  retry: () => void;
  theme?: "dark" | "light";
}

export function ErrorFallback({ retry }: ErrorFallbackProps) {
  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.icon}>{'\u26A0\uFE0F'}</Text>
        <Text style={styles.title}>页面出现异常</Text>
        <Text style={styles.subtitle}>
          请重试或返回后重新进入页面。
        </Text>
        <TouchableOpacity style={styles.retryBtn} onPress={retry}>
          <Text style={styles.retryBtnText}>重试</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ── ErrorBoundary class component ────────────────────────────────────────

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    reportError(error, info, this.props.name);
  }

  private handleRetry = (): void => {
    this.setState({ error: null });
  };

  render(): ReactNode {
    if (this.state.error) {
      const { fallback } = this.props;
      if (typeof fallback === "function") {
        return fallback(this.state.error, this.handleRetry);
      }
      if (fallback) {
        return fallback;
      }
      return (
        <ErrorFallback
          error={this.state.error}
          retry={this.handleRetry}
        />
      );
    }
    return this.props.children;
  }
}

// ── Styles ───────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0D0D0F",
    justifyContent: "center",
    alignItems: "center",
    padding: spacing["2xl"],
  },
  content: {
    alignItems: "center",
    maxWidth: 320,
  },
  icon: {
    fontSize: 48,
    marginBottom: spacing.lg,
  },
  title: {
    fontSize: fontSize.xl,
    fontWeight: "700",
    color: "#F1F5F9",
    marginBottom: spacing.sm,
    textAlign: "center",
  },
  subtitle: {
    fontSize: fontSize.md,
    color: "#94A3B8",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: spacing.lg,
  },
  retryBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing["2xl"],
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
  },
  retryBtnText: {
    color: "#FFF",
    fontSize: fontSize.md,
    fontWeight: "600",
  },
});
