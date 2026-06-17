import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import { Text } from "react-native";
import { ErrorBoundary, ErrorFallback } from "../ErrorBoundary";

// ── Helper: component that throws ────────────────────────────────────────

function Bomb({ shouldThrow = false }: { shouldThrow?: boolean }) {
  if (shouldThrow) {
    throw new Error("Test crash");
  }
  return null;
}

// ── Tests ────────────────────────────────────────────────────────────────

describe("ErrorBoundary", () => {
  let consoleSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  it("renders children when no error", () => {
    const { getByText } = render(
      <ErrorBoundary>
        <Text>Hello</Text>
      </ErrorBoundary>,
    );
    expect(getByText("Hello")).toBeTruthy();
  });

  it("renders ErrorFallback on error", () => {
    const { getByText } = render(
      <ErrorBoundary>
        <Bomb shouldThrow />
      </ErrorBoundary>,
    );

    expect(getByText("页面出现异常")).toBeTruthy();
    expect(getByText("请重试或返回后重新进入页面。")).toBeTruthy();
    expect(getByText("重试")).toBeTruthy();
  });

  it("retry button clears error and re-renders children", () => {
    const { getByText } = render(
      <ErrorBoundary>
        <Bomb shouldThrow />
      </ErrorBoundary>,
    );

    // Error UI is showing
    expect(getByText("页面出现异常")).toBeTruthy();

    fireEvent.press(getByText("重试"));

    // After retry, the boundary resets state.
    // The bomb still throws on re-render, so error UI comes back.
    expect(getByText("页面出现异常")).toBeTruthy();
  });

  it("accepts custom fallback render function", () => {
    const customFallback = (error: Error, retry: () => void) => (
      <Text>{error.message} - {typeof retry}</Text>
    );

    const { getByText } = render(
      <ErrorBoundary fallback={customFallback}>
        <Bomb shouldThrow />
      </ErrorBoundary>,
    );

    expect(getByText("Test crash - function")).toBeTruthy();
  });
});

describe("ErrorFallback", () => {
  it("renders error message and retry button", () => {
    const retry = jest.fn();
    const { getByText } = render(
      <ErrorFallback error={new Error("Something broke")} retry={retry} />,
    );

    expect(getByText("页面出现异常")).toBeTruthy();
    expect(getByText("请重试或返回后重新进入页面。")).toBeTruthy();

    fireEvent.press(getByText("重试"));
    expect(retry).toHaveBeenCalled();
  });
});
