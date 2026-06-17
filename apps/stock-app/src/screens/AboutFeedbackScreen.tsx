import React, { useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, TextInput,
  Alert,
} from 'react-native';
import { useTheme, colors, spacing, borderRadius, fontSize } from '../theme';

export default function AboutFeedbackScreen() {
  const { theme } = useTheme();
  const [feedback, setFeedback] = useState('');

  const handleSubmitFeedback = () => {
    if (!feedback.trim()) {
      Alert.alert('提示', '请输入反馈内容');
      return;
    }
    Alert.alert(
      '反馈暂未开放',
      '当前版本还没有接入反馈后端。请先保存这段内容，后续我们会开放正式反馈入口。'
    );
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.background }]}
      contentContainerStyle={styles.content}>

      {/* App 信息 */}
      <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <Text style={styles.appIcon}>📈</Text>
        <Text style={[styles.appName, { color: theme.text }]}>智能股票分析</Text>
        <Text style={[styles.version, { color: theme.textMuted }]}>版本 1.0.0</Text>
        <Text style={[styles.desc, { color: theme.textSecondary }]}> 
          基于 AI 的智能股票分析工具，当前重点支持 A 股、港股行情与深度分析。
        </Text>
        <View style={[styles.divider, { backgroundColor: theme.borderLight }]} />
        <TouchableOpacity style={styles.linkRow} onPress={() => Alert.alert('提示', '项目地址暂未公开')}>
          <Text style={[styles.linkText, { color: colors.primary }]}>项目状态</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.linkRow} onPress={() => Alert.alert('提示', '技术栈：React Native + Expo + FastAPI')}>
          <Text style={[styles.linkText, { color: colors.primary }]}>技术栈</Text>
        </TouchableOpacity>
      </View>

      {/* 反馈 */}
      <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>💬 意见反馈</Text>
        <Text style={[styles.noticeText, { color: theme.textMuted, backgroundColor: theme.inputBackground }]}>当前反馈后端暂未接入，填写内容不会自动上传。你可以先记录问题，后续版本会开放正式反馈入口。</Text>
        <TextInput
          style={[styles.input, { backgroundColor: theme.inputBackground, color: theme.text, borderColor: theme.border }]}
          value={feedback}
          onChangeText={setFeedback}
          placeholder="请描述您的问题或建议..."
          placeholderTextColor={theme.textMuted}
          multiline
          numberOfLines={5}
          textAlignVertical="top"
        />
        <TouchableOpacity
          style={[styles.submitBtn, { backgroundColor: theme.inputBackground, borderColor: theme.border }]}
          onPress={handleSubmitFeedback}
        >
          <Text style={[styles.submitBtnText, { color: colors.primary }]}>查看反馈说明</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: spacing.lg, paddingBottom: 40 },
  card: {
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    marginBottom: spacing.lg,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
  },
  appIcon: { fontSize: 48, marginBottom: spacing.md },
  appName: { fontSize: fontSize.xl, fontWeight: '700', marginBottom: spacing.xs },
  version: { fontSize: fontSize.sm, marginBottom: spacing.md },
  desc: { fontSize: fontSize.md, textAlign: 'center', lineHeight: 22, marginBottom: spacing.sm },
  divider: { height: StyleSheet.hairlineWidth, width: '100%', marginVertical: spacing.md },
  linkRow: { paddingVertical: spacing.sm, width: '100%', alignItems: 'center' },
  linkText: { fontSize: fontSize.md, fontWeight: '500' },
  sectionTitle: { fontSize: fontSize.lg, fontWeight: '600', marginBottom: spacing.md, alignSelf: 'flex-start' },
  noticeText: {
    width: '100%', borderRadius: borderRadius.md,
    padding: spacing.md, fontSize: fontSize.sm,
    lineHeight: 20, marginBottom: spacing.md,
  },
  input: {
    width: '100%', borderRadius: borderRadius.md,
    padding: spacing.md, fontSize: fontSize.md,
    minHeight: 120, borderWidth: StyleSheet.hairlineWidth,
  },
  submitBtn: {
    width: '100%', borderRadius: borderRadius.md,
    paddingVertical: spacing.md, alignItems: 'center', marginTop: spacing.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  submitBtnText: { fontSize: fontSize.lg, fontWeight: '600' },
});