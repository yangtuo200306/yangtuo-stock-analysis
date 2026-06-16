import React, { useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, TextInput,
  Alert, Linking,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTheme, colors, spacing, borderRadius, fontSize } from '../theme';
import { showToast } from '../components/Toast';

export default function AboutFeedbackScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation();
  const [feedback, setFeedback] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmitFeedback = async () => {
    if (!feedback.trim()) {
      Alert.alert('提示', '请输入反馈内容');
      return;
    }
    setSubmitting(true);
    // 模拟提交
    await new Promise(r => setTimeout(r, 1000));
    showToast('感谢您的反馈！', 'success');
    setFeedback('');
    setSubmitting(false);
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
          基于 AI 的智能股票分析工具，支持 A 股、港股、美股实时行情与深度分析。
        </Text>
        <View style={[styles.divider, { backgroundColor: theme.borderLight }]} />
        <TouchableOpacity style={styles.linkRow} onPress={() => Alert.alert('提示', '项目地址：https://gitee.com/xxx')}>
          <Text style={[styles.linkText, { color: colors.primary }]}>开源仓库</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.linkRow} onPress={() => Alert.alert('提示', '技术栈：React Native + Expo + FastAPI')}>
          <Text style={[styles.linkText, { color: colors.primary }]}>技术栈</Text>
        </TouchableOpacity>
      </View>

      {/* 反馈 */}
      <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>💬 意见反馈</Text>
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
          style={[styles.submitBtn, { backgroundColor: colors.primary, opacity: submitting ? 0.6 : 1 }]}
          onPress={handleSubmitFeedback}
          disabled={submitting}
        >
          <Text style={styles.submitBtnText}>{submitting ? '提交中...' : '提交反馈'}</Text>
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
  input: {
    width: '100%', borderRadius: borderRadius.md,
    padding: spacing.md, fontSize: fontSize.md,
    minHeight: 120, borderWidth: StyleSheet.hairlineWidth,
  },
  submitBtn: {
    width: '100%', borderRadius: borderRadius.md,
    paddingVertical: spacing.md, alignItems: 'center', marginTop: spacing.lg,
  },
  submitBtnText: { color: '#FFF', fontSize: fontSize.lg, fontWeight: '600' },
});