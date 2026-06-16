import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from "react-native";
import { useTheme, colors } from "../theme";

// ── Types ────────────────────────────────────────────────────────────────

export interface Skill {
  id: string;
  name: string;
}

export interface StrategySelectorProps {
  skills: Skill[];
  selectedSkill: string;
  pendingSkill: string | null;
  showMore: boolean;
  onSkillPress: (skillId: string) => void;
  onToggleMore: () => void;
}

// ── Component ────────────────────────────────────────────────────────────

export function StrategySelector({
  skills,
  selectedSkill,
  pendingSkill,
  showMore,
  onSkillPress,
  onToggleMore,
}: StrategySelectorProps) {
  const { theme } = useTheme();

  const mainSkills = skills.slice(0, 7);
  const moreSkills = skills.slice(7);

  return (
    <>
      {/* Skill chips */}
      <View style={[styles.skillBar, { backgroundColor: theme.background }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {mainSkills.map((s) => (
            <TouchableOpacity
              key={s.id}
              style={[
                styles.skillChip,
                {
                  backgroundColor:
                    selectedSkill === s.id ? colors.primary : theme.inputBackground,
                },
                pendingSkill === s.id && { backgroundColor: colors.warning },
              ]}
              onPress={() => onSkillPress(s.id)}
            >
              <Text
                style={[
                  styles.skillChipText,
                  {
                    color:
                      selectedSkill === s.id ? "#FFF" : theme.textSecondary,
                  },
                ]}
              >
                {s.name}
              </Text>
            </TouchableOpacity>
          ))}
          {moreSkills.length > 0 && (
            <TouchableOpacity
              style={[
                styles.skillChip,
                {
                  backgroundColor: showMore
                    ? colors.primary
                    : theme.inputBackground,
                },
              ]}
              onPress={onToggleMore}
            >
              <Text
                style={[
                  styles.skillChipText,
                  { color: showMore ? "#FFF" : theme.textSecondary },
                ]}
              >
                更多 {"\u25BC"}
              </Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </View>

      {/* More skills panel */}
      {showMore && moreSkills.length > 0 && (
        <View
          style={[
            styles.morePanel,
            { backgroundColor: theme.surface, borderColor: theme.border },
          ]}
        >
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {skills.map((s) => (
              <TouchableOpacity
                key={s.id}
                style={[
                  styles.skillChip,
                  {
                    backgroundColor:
                      selectedSkill === s.id
                        ? colors.primary
                        : theme.inputBackground,
                  },
                  pendingSkill === s.id && { backgroundColor: colors.warning },
                ]}
                onPress={() => onSkillPress(s.id)}
              >
                <Text
                  style={[
                    styles.skillChipText,
                    {
                      color:
                        selectedSkill === s.id ? "#FFF" : theme.textSecondary,
                    },
                  ]}
                >
                  {s.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Active skill indicator */}
      {selectedSkill && (
        <View style={styles.activeSkillRow}>
          <Text style={[styles.activeSkillText, { color: colors.primary }]}>
            当前策略: {skills.find((s) => s.id === selectedSkill)?.name || selectedSkill}
          </Text>
        </View>
      )}
    </>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  skillBar: { paddingVertical: 8, paddingLeft: 12 },
  skillChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
  },
  skillChipText: { fontSize: 13, fontWeight: "500" },
  morePanel: {
    marginHorizontal: 12,
    borderRadius: 10,
    padding: 8,
    elevation: 3,
    marginBottom: 4,
    borderWidth: StyleSheet.hairlineWidth,
  },
  activeSkillRow: { paddingHorizontal: 12, paddingBottom: 4 },
  activeSkillText: { fontSize: 12, fontWeight: "500" },
});
