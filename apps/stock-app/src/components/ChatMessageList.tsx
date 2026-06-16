import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { useTheme, colors } from "../theme";
import type { ChatMessage } from "../hooks/useSSEStream";

// ── Props ────────────────────────────────────────────────────────────────

export interface ChatMessageListProps {
  messages: ChatMessage[];
  selectedSkill: string;
  currentStep: number;
  streaming: boolean;
  skills: { id: string; name: string }[];
  steps: { key: string; label: string }[];
  scrollRef: React.RefObject<ScrollView>;
  onLongPress: (msg: ChatMessage) => void;
  onExamplePress: (question: string, skill: string) => void;
}

// ── Component ────────────────────────────────────────────────────────────

export function ChatMessageList({
  messages,
  selectedSkill,
  currentStep,
  streaming,
  skills,
  steps,
  scrollRef,
  onLongPress,
  onExamplePress,
}: ChatMessageListProps) {
  const { theme } = useTheme();

  const skillName = (id?: string) =>
    skills.find((s) => s.id === id)?.name || id || "";

  return (
    <ScrollView
      ref={scrollRef}
      style={[styles.chatScroll, { backgroundColor: theme.background }]}
      contentContainerStyle={styles.chatContent}
      onContentSizeChange={() =>
        scrollRef.current?.scrollToEnd({ animated: true })
      }
    >
      {messages.length === 0 && (
        <View style={styles.emptyState}>
          <Text style={[styles.emptyTitle, { color: theme.textMuted }]}>
            选择上方策略，输入股票和问题即可开始分析。
          </Text>
          <View style={styles.exampleSection}>
            <Text style={[styles.exampleLabel, { color: theme.textMuted }]}>
              示例问题:
            </Text>
            <TouchableOpacity
              style={[
                styles.exampleChip,
                { backgroundColor: theme.card, borderColor: theme.border },
              ]}
              onPress={() => onExamplePress("分析贵州茅台的买点", "chan")}
            >
              <Text style={[styles.exampleChipText, { color: theme.text }]}>
                茅台买点
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.exampleChip,
                { backgroundColor: theme.card, borderColor: theme.border },
              ]}
              onPress={() => onExamplePress("宁德时代当前趋势如何", "wave")}
            >
              <Text style={[styles.exampleChipText, { color: theme.text }]}>
                宁德趋势
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.exampleChip,
                { backgroundColor: theme.card, borderColor: theme.border },
              ]}
              onPress={() => onExamplePress("分析当前大盘趋势", "trend")}
            >
              <Text style={[styles.exampleChipText, { color: theme.text }]}>
                大盘趋势
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.exampleChip,
                { backgroundColor: theme.card, borderColor: theme.border },
              ]}
              onPress={() => onExamplePress("半导体板块热度如何", "hot")}
            >
              <Text style={[styles.exampleChipText, { color: theme.text }]}>
                半导体热度
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {messages.map((msg, i) => (
        <TouchableOpacity
          key={i}
          onLongPress={() => onLongPress(msg)}
          activeOpacity={0.8}
        >
          <View
            style={[
              styles.bubble,
              msg.role === "user"
                ? [styles.bubbleUser, { backgroundColor: colors.primary }]
                : msg.skillChanged
                  ? [
                      styles.bubbleSystem,
                      {
                        backgroundColor: theme.card,
                        borderColor: colors.warning,
                      },
                    ]
                  : [
                      styles.bubbleAssistant,
                      {
                        backgroundColor: theme.card,
                        borderColor: theme.border,
                      },
                    ],
            ]}
          >
            {msg.skillChanged ? (
              <Text style={[styles.systemText, { color: colors.warning }]}>
                {msg.content}
              </Text>
            ) : (
              <>
                {msg.skill && msg.role === "assistant" && msg.content && (
                  <Text style={[styles.skillTag, { color: colors.primary }]}>
                    [{skillName(msg.skill)}]
                  </Text>
                )}
                {msg.role === "user" ? (
                  <Text style={styles.bubbleTextUser}>{msg.content}</Text>
                ) : msg.content ? (
                  <Text
                    style={[
                      styles.bubbleTextAssistant,
                      { color: theme.text },
                    ]}
                  >
                    {msg.content}
                  </Text>
                ) : (
                  <View>
                    <Text
                      style={[styles.skillTag, { color: colors.primary }]}
                    >
                      [{skillName(selectedSkill)}] 分析中...
                    </Text>
                    {steps.map((step, si) => (
                      <View key={step.key} style={styles.stepRow}>
                        <Text
                          style={[
                            styles.stepIcon,
                            {
                              color:
                                si <= currentStep
                                  ? colors.up
                                  : theme.textMuted,
                            },
                          ]}
                        >
                          {si < currentStep
                            ? "\u2713"
                            : si === currentStep
                              ? "\u25CF"
                              : "\u25CB"}
                        </Text>
                        <Text
                          style={[
                            styles.stepLabel,
                            {
                              color:
                                si <= currentStep
                                  ? theme.text
                                  : theme.textMuted,
                            },
                          ]}
                        >
                          {step.label}
                        </Text>
                      </View>
                    ))}
                    <ActivityIndicator
                      size="small"
                      color={colors.primary}
                      style={{ marginTop: 8 }}
                    />
                  </View>
                )}
              </>
            )}
          </View>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  chatScroll: { flex: 1 },
  chatContent: { padding: 16, paddingBottom: 8 },
  emptyState: { alignItems: "flex-start", marginTop: 20 },
  emptyTitle: { fontSize: 14, lineHeight: 22, marginBottom: 20 },
  exampleSection: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  exampleLabel: { fontSize: 13, width: "100%", marginBottom: 4 },
  exampleChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
  },
  exampleChipText: { fontSize: 13 },
  bubble: {
    maxWidth: "90%",
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
  },
  bubbleUser: { alignSelf: "flex-end", borderBottomRightRadius: 4 },
  bubbleAssistant: {
    alignSelf: "flex-start",
    borderBottomLeftRadius: 4,
    borderWidth: StyleSheet.hairlineWidth,
  },
  bubbleSystem: {
    alignSelf: "center",
    maxWidth: "85%",
    padding: 10,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
  },
  bubbleTextUser: { color: "#FFF", fontSize: 15, lineHeight: 22 },
  bubbleTextAssistant: { fontSize: 14, lineHeight: 22 },
  systemText: { fontSize: 12, textAlign: "center", lineHeight: 18 },
  skillTag: { fontSize: 11, fontWeight: "600", marginBottom: 4 },
  stepRow: { flexDirection: "row", alignItems: "center", marginTop: 4 },
  stepIcon: { width: 20, fontSize: 14, textAlign: "center" },
  stepLabel: { fontSize: 13, marginLeft: 6 },
});
