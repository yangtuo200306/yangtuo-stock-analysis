import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import { ChatMessageList } from "../ChatMessageList";
import { Text } from "react-native";

// ThemeProvider stub
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
];

const mockSteps = [
  { key: "data", label: "Fetch data" },
  { key: "analyze", label: "Analyze" },
];

const scrollRef = { current: null } as any;

describe("ChatMessageList", () => {
  it("shows empty state when no messages", () => {
    const { getByText } = render(
      <ChatMessageList
        messages={[]}
        selectedSkill="chan"
        currentStep={0}
        streaming={false}
        skills={mockSkills}
        steps={mockSteps}
        scrollRef={scrollRef}
        onLongPress={jest.fn()}
        onExamplePress={jest.fn()}
      />,
    );
    expect(getByText(/选择上方策略/)).toBeTruthy();
  });

  it("renders user and assistant messages", () => {
    const messages = [
      { role: "user" as const, content: "Analyze Moutai" },
      { role: "assistant" as const, content: "Here is the analysis..." },
    ];
    const { getByText } = render(
      <ChatMessageList
        messages={messages}
        selectedSkill="chan"
        currentStep={0}
        streaming={false}
        skills={mockSkills}
        steps={mockSteps}
        scrollRef={scrollRef}
        onLongPress={jest.fn()}
        onExamplePress={jest.fn()}
      />,
    );
    expect(getByText("Analyze Moutai")).toBeTruthy();
    expect(getByText("Here is the analysis...")).toBeTruthy();
  });

  it("renders streaming indicator for empty assistant message", () => {
    const messages = [
      { role: "user" as const, content: "test" },
      { role: "assistant" as const, content: "" },
    ];
    const { getByText } = render(
      <ChatMessageList
        messages={messages}
        selectedSkill="chan"
        currentStep={0}
        streaming={true}
        skills={mockSkills}
        steps={mockSteps}
        scrollRef={scrollRef}
        onLongPress={jest.fn()}
        onExamplePress={jest.fn()}
      />,
    );
    expect(getByText(/分析中/)).toBeTruthy();
    expect(getByText("Fetch data")).toBeTruthy();
  });

  it("renders skill change system message", () => {
    const messages = [
      {
        role: "assistant" as const,
        content: "Strategy changed",
        skillChanged: true,
      },
    ];
    const { getByText } = render(
      <ChatMessageList
        messages={messages}
        selectedSkill="chan"
        currentStep={0}
        streaming={false}
        skills={mockSkills}
        steps={mockSteps}
        scrollRef={scrollRef}
        onLongPress={jest.fn()}
        onExamplePress={jest.fn()}
      />,
    );
    expect(getByText("Strategy changed")).toBeTruthy();
  });

  it("calls onExamplePress when example chip is pressed", () => {
    const onExamplePress = jest.fn();
    const { getByText } = render(
      <ChatMessageList
        messages={[]}
        selectedSkill="chan"
        currentStep={0}
        streaming={false}
        skills={mockSkills}
        steps={mockSteps}
        scrollRef={scrollRef}
        onLongPress={jest.fn()}
        onExamplePress={onExamplePress}
      />,
    );
    fireEvent.press(getByText("茅台买点"));
    expect(onExamplePress).toHaveBeenCalledWith(
      "分析贵州茅台的买点",
      "chan",
    );
  });

  it("calls onLongPress on message long press", () => {
    const onLongPress = jest.fn();
    const messages = [
      { role: "user" as const, content: "Hello" },
    ];
    const { getByText } = render(
      <ChatMessageList
        messages={messages}
        selectedSkill="chan"
        currentStep={0}
        streaming={false}
        skills={mockSkills}
        steps={mockSteps}
        scrollRef={scrollRef}
        onLongPress={onLongPress}
        onExamplePress={jest.fn()}
      />,
    );
    fireEvent(getByText("Hello"), "onLongPress");
    expect(onLongPress).toHaveBeenCalled();
  });
});
