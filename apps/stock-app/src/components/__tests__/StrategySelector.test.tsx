import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import { StrategySelector } from "../StrategySelector";

// ThemeProvider stub for components that use useTheme()
jest.mock("../../theme", () => ({
  useTheme: () => ({
    theme: {
      background: "#0D0D0F",
      card: "#1A1A1E",
      surface: "#1A1A1E",
      inputBackground: "#1A1A1E",
      text: "#F1F5F9",
      textSecondary: "#94A3B8",
      textMuted: "#64748B",
      border: "#2A2A2E",
      skeleton: "#1E1E22",
      skeletonHighlight: "#2A2A2E",
      headerBackground: "#111114",
      headerText: "#F1F5F9",
      tabBar: "#111114",
      tabBarBorder: "#2A2A2E",
      overlay: "rgba(0,0,0,0.6)",
    },
    isDark: true,
  }),
  colors: {
    primary: "#00D4FF",
    secondary: "#A855F7",
    accent: "#00D4FF",
    up: "#22C55E",
    down: "#EF4444",
    flat: "#94A3B8",
    success: "#22C55E",
    warning: "#F59E0B",
    error: "#EF4444",
    info: "#3B82F6",
  },
  spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, "2xl": 24, "3xl": 32 },
  borderRadius: { sm: 6, md: 10, lg: 14, xl: 20, full: 9999 },
  fontSize: { xs: 11, sm: 12, md: 14, lg: 16, xl: 18, "2xl": 22, "3xl": 28 },
  fontWeight: { normal: "400", medium: "500", semibold: "600", bold: "700" },
  shadows: { sm: {}, md: {}, lg: {} },
}));


const mockSkills = [
  { id: "chan", name: "Chan" },
  { id: "wave", name: "Wave" },
  { id: "ma", name: "MA" },
  { id: "hot", name: "Hot" },
  { id: "event", name: "Event" },
  { id: "trend", name: "Trend" },
  { id: "growth", name: "Growth" },
  { id: "expect", name: "Expect" },
];

describe("StrategySelector", () => {
  it("renders skill chips", () => {
    const { getByText } = render(
      <StrategySelector
        skills={mockSkills}
        selectedSkill="chan"
        pendingSkill={null}
        showMore={false}
        onSkillPress={jest.fn()}
        onToggleMore={jest.fn()}
      />,
    );
    expect(getByText("Chan")).toBeTruthy();
    expect(getByText("Wave")).toBeTruthy();
  });

  it("highlights selected skill", () => {
    const { getByText, getAllByText } = render(
      <StrategySelector
        skills={mockSkills}
        selectedSkill="wave"
        pendingSkill={null}
        showMore={false}
        onSkillPress={jest.fn()}
        onToggleMore={jest.fn()}
      />,
    );
    // Current skill indicator shows the selected skill name
    expect(getByText(/当前策略:/)).toBeTruthy();
    expect(getAllByText(/Wave/).length).toBeGreaterThanOrEqual(1);
  });

  it("calls onSkillPress when a chip is pressed", () => {
    const onSkillPress = jest.fn();
    const { getByText } = render(
      <StrategySelector
        skills={mockSkills}
        selectedSkill="chan"
        pendingSkill={null}
        showMore={false}
        onSkillPress={onSkillPress}
        onToggleMore={jest.fn()}
      />,
    );
    fireEvent.press(getByText("Wave"));
    expect(onSkillPress).toHaveBeenCalledWith("wave");
  });

  it("shows More button when there are extra skills", () => {
    const { getByText } = render(
      <StrategySelector
        skills={mockSkills}
        selectedSkill="chan"
        pendingSkill={null}
        showMore={false}
        onSkillPress={jest.fn()}
        onToggleMore={jest.fn()}
      />,
    );
    expect(getByText(/更多/)).toBeTruthy();
  });

  it("calls onToggleMore when More is pressed", () => {
    const onToggleMore = jest.fn();
    const { getByText } = render(
      <StrategySelector
        skills={mockSkills}
        selectedSkill="chan"
        pendingSkill={null}
        showMore={false}
        onSkillPress={jest.fn()}
        onToggleMore={onToggleMore}
      />,
    );
    fireEvent.press(getByText(/更多/));
    expect(onToggleMore).toHaveBeenCalled();
  });

  it("shows more panel when showMore is true", () => {
    const { getByText } = render(
      <StrategySelector
        skills={mockSkills}
        selectedSkill="chan"
        pendingSkill={null}
        showMore={true}
        onSkillPress={jest.fn()}
        onToggleMore={jest.fn()}
      />,
    );
    // All skills should be visible in the expanded panel
    expect(getByText("Expect")).toBeTruthy();
  });
});
