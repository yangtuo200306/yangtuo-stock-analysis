import React, { useEffect, useRef, useState } from 'react';
import { RouteProp, useRoute } from '@react-navigation/native';
import type { TabParamList } from '../types';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { getMobileBackendUrl } from '../api/client';
import { useTheme, colors } from '../theme';

const ALL_SKILLS = [
  { id: 'bull_trend', name: '趋势' },
  { id: 'ma_golden_cross', name: '均线' },
  { id: 'chan_theory', name: '缠论' },
  { id: 'hot_theme', name: '热点' },
  { id: 'event_driven', name: '事件' },
  { id: 'growth_quality', name: '成长' },
];

const STEPS = [
  { key: 'understand', label: '正在理解问题' },
  { key: 'tools', label: '正在调用工具' },
  { key: 'answer', label: '正在生成回答' },
];

const CHAT_MODES = [
  { id: 'fast', name: '快速问股', description: '行情、K线、趋势优先' },
  { id: 'deep', name: '深度分析', description: '加入新闻、筹码等完整工具' },
] as const;

type ChatMode = typeof CHAT_MODES[number]['id'];
type AskStockRoute = RouteProp<TabParamList, 'AskStock'>;

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  skill?: string;
  skillChanged?: boolean;
}

function updateLastAssistant(
  messages: ChatMessage[],
  content: string,
  skill: string,
): ChatMessage[] {
  const updated = [...messages];
  for (let i = updated.length - 1; i >= 0; i--) {
    if (updated[i].role === 'assistant') {
      updated[i] = { ...updated[i], content, skill };
      return updated;
    }
  }
  return [...updated, { role: 'assistant', content, skill }];
}

function getFriendlyAskError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error || '');
  const lower = message.toLowerCase();

  if (lower.includes('abort') || lower.includes('timeout') || message.includes('超时')) {
    return '问股响应时间较长，请稍后重试，或切换快速问股。';
  }
  if (
    lower.includes('failed to fetch') ||
    lower.includes('network') ||
    lower.includes('econnrefused') ||
    message.includes('网络')
  ) {
    return '网络连接异常，请检查网络后重试。';
  }
  if (message.includes('HTTP 401') || message.includes('HTTP 403') || lower.includes('api key')) {
    return '问股服务鉴权失败，请到设置页检查服务配置。';
  }
  if (message.includes('HTTP 404') || message.includes('HTTP 500') || message.includes('HTTP 502') || message.includes('HTTP 503') || message.includes('HTTP 504')) {
    return '问股服务暂时不可用，请稍后重试。';
  }
  if (message.includes('没有返回内容')) {
    return '问股服务没有返回内容，请稍后重试。';
  }
  return '问股服务暂时不可用，请稍后重试。';
}

export default function AskStockScreen() {
  const { theme } = useTheme();
  const route = useRoute<AskStockRoute>();
  const [selectedSkill, setSelectedSkill] = useState<string>('bull_trend');
  const [chatMode, setChatMode] = useState<ChatMode>('fast');
  const [question, setQuestion] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatting, setChatting] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [waitSeconds, setWaitSeconds] = useState(0);
  const [pendingSkill, setPendingSkill] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const stepTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const waitTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (stepTimer.current) clearInterval(stepTimer.current);
      if (waitTimer.current) clearInterval(waitTimer.current);
    };
  }, []);

  useEffect(() => {
    const params = route.params;
    if (!params?.prefillQuestion) return;
    setQuestion(params.prefillQuestion);
  }, [route.params?.prefillQuestion]);

  const clearChat = () => setMessages([]);

  const startStepAnimation = () => {
    if (stepTimer.current) clearInterval(stepTimer.current);
    if (waitTimer.current) clearInterval(waitTimer.current);
    setCurrentStep(0);
    setWaitSeconds(0);
    let i = 0;
    stepTimer.current = setInterval(() => {
      i += 1;
      if (i >= STEPS.length) {
        if (stepTimer.current) clearInterval(stepTimer.current);
        return;
      }
      setCurrentStep(i);
    }, 10000);
    waitTimer.current = setInterval(() => {
      setWaitSeconds(prev => prev + 1);
    }, 1000);
  };

  const handleSkillPress = (skillId: string) => {
    if (skillId === selectedSkill) return;
    if (messages.length === 0) {
      setSelectedSkill(skillId);
      return;
    }
    setPendingSkill(skillId);
  };

  const confirmSkillChange = () => {
    if (!pendingSkill) return;
    const oldName = ALL_SKILLS.find(s => s.id === selectedSkill)?.name || selectedSkill;
    const newName = ALL_SKILLS.find(s => s.id === pendingSkill)?.name || pendingSkill;
    setSelectedSkill(pendingSkill);
    setPendingSkill(null);
    setMessages(prev => [...prev, {
      role: 'assistant',
      content: `策略已从 [${oldName}] 切换为 [${newName}]，后续回复将使用新策略分析。`,
      skillChanged: true,
    }]);
  };

  const fetchJsonWithTimeout = async (url: string, body: unknown, timeoutMs: number) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || data.message || `请求失败 HTTP ${res.status}`);
      return data;
    } finally {
      clearTimeout(timer);
    }
  };

  const doChatRequest = async (baseUrl: string, text: string, skill: string, mode: ChatMode) => {
    const data = await fetchJsonWithTimeout(`${baseUrl}/api/v1/agent/chat`, {
      message: text,
      session_id: `app_${Date.now()}`,
      skills: skill ? [skill] : undefined,
      mode,
    }, mode === 'fast' ? 90000 : 180000);
    if (!data.success) throw new Error(data.error || '问股服务暂时不可用');
    const content = data.content;
    if (!content) throw new Error('问股服务没有返回内容');
    setMessages(prev => updateLastAssistant(prev, content, skill));
  };

  const doChat = async () => {
    const text = question.trim();
    if (!text || chatting) return;

    const skill = selectedSkill;
    const mode = chatMode;
    setMessages(prev => [...prev, { role: 'user', content: text }, { role: 'assistant', content: '', skill }]);
    setQuestion('');
    setChatting(true);
    startStepAnimation();

    const baseUrl = await getMobileBackendUrl();
    try {
      await doChatRequest(baseUrl, text, skill, mode);
    } catch (error) {
      setMessages(prev => updateLastAssistant(
        prev,
        getFriendlyAskError(error),
        skill,
      ));
    } finally {
      setChatting(false);
      if (stepTimer.current) clearInterval(stepTimer.current);
      if (waitTimer.current) clearInterval(waitTimer.current);
    }
  };

  const handleLongPress = (msg: ChatMessage) => {
    if (!msg.content) return;
    Alert.alert('操作', undefined, [
      { text: '复制/分享', onPress: () => Share.share({ message: msg.content }) },
      { text: '取消', style: 'cancel' },
    ]);
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: theme.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.topBar, { backgroundColor: theme.headerBackground, borderBottomColor: theme.border }]}>
        <Text style={[styles.topBarTitle, { color: theme.text }]}>AI策略问股</Text>
        {messages.length > 0 && (
          <TouchableOpacity onPress={clearChat} style={styles.clearBtn}>
            <Text style={[styles.clearBtnText, { color: colors.primary }]}>清除对话</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={[styles.skillBar, { backgroundColor: theme.background }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {ALL_SKILLS.map(s => (
            <TouchableOpacity
              key={s.id}
              style={[
                styles.skillChip,
                { backgroundColor: selectedSkill === s.id ? colors.primary : theme.inputBackground },
                pendingSkill === s.id && { backgroundColor: colors.warning },
              ]}
              onPress={() => handleSkillPress(s.id)}
            >
              <Text style={[styles.skillChipText, { color: selectedSkill === s.id ? '#FFF' : theme.textSecondary }]}>
                {s.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>


      <View style={styles.activeSkillRow}>
        <Text style={[styles.activeSkillText, { color: colors.primary }]}>当前策略: {ALL_SKILLS.find(s => s.id === selectedSkill)?.name || selectedSkill}</Text>
        {route.params?.stockCode && (
          <Text style={[styles.stockContextText, { color: theme.textMuted }]}>来自个股详情：{route.params.stockName || route.params.stockCode} {route.params.stockCode}</Text>
        )}
      </View>

      <View style={styles.modeSection}>
        <View style={[styles.modeSwitch, { backgroundColor: theme.inputBackground }]}>
          {CHAT_MODES.map(mode => (
            <TouchableOpacity
              key={mode.id}
              style={[styles.modeOption, chatMode === mode.id && { backgroundColor: colors.primary }]}
              onPress={() => setChatMode(mode.id)}
              disabled={chatting}
            >
              <Text style={[styles.modeName, { color: chatMode === mode.id ? '#FFF' : theme.textSecondary }]}>{mode.name}</Text>
              <Text style={[styles.modeDesc, { color: chatMode === mode.id ? '#FFF' : theme.textMuted }]}>{mode.description}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <ScrollView
        ref={scrollRef}
        style={[styles.chatScroll, { backgroundColor: theme.background }]}
        contentContainerStyle={styles.chatContent}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
      >
        {messages.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={[styles.emptyTitle, { color: theme.textMuted }]}>选择策略，输入股票和问题开始分析。</Text>
            <View style={styles.exampleSection}>
              <Text style={[styles.exampleLabel, { color: theme.textMuted }]}>示例问题:</Text>
              {[
                ['分析茅台买点', 'chan_theory', '缠论看茅台'],
                ['宁德时代走势', 'bull_trend', '趋势看宁德'],
                ['大盘趋势分析', 'bull_trend', '大盘趋势'],
                ['半导体板块热度', 'hot_theme', '半导体热点'],
              ].map(([nextQuestion, skill, label]) => (
                <TouchableOpacity
                  key={label}
                  style={[styles.exampleChip, { backgroundColor: theme.card, borderColor: theme.border }]}
                  onPress={() => {
                    setQuestion(nextQuestion);
                    setSelectedSkill(skill);
                  }}
                >
                  <Text style={[styles.exampleChipText, { color: theme.text }]}>{label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {messages.map((msg, i) => (
          <TouchableOpacity key={i} onLongPress={() => handleLongPress(msg)} activeOpacity={0.8}>
            <View style={[
              styles.bubble,
              msg.role === 'user'
                ? [styles.bubbleUser, { backgroundColor: colors.primary }]
                : msg.skillChanged
                  ? [styles.bubbleSystem, { backgroundColor: theme.card, borderColor: colors.warning }]
                  : [styles.bubbleAssistant, { backgroundColor: theme.card, borderColor: theme.border }],
            ]}>
              {msg.skillChanged ? (
                <Text style={[styles.systemText, { color: colors.warning }]}>{msg.content}</Text>
              ) : msg.role === 'user' ? (
                <Text style={styles.bubbleTextUser}>{msg.content}</Text>
              ) : msg.content ? (
                <>
                  <Text style={[styles.skillTag, { color: colors.primary }]}>[{ALL_SKILLS.find(s => s.id === msg.skill)?.name || msg.skill}]</Text>
                  <Text style={[styles.bubbleTextAssistant, { color: theme.text }]}>{msg.content}</Text>
                </>
              ) : (
                <View>
                  <Text style={[styles.skillTag, { color: colors.primary }]}>[{ALL_SKILLS.find(s => s.id === selectedSkill)?.name || selectedSkill}] 分析中</Text>
                  <Text style={[styles.waitText, { color: theme.textMuted }]}>已等待 {waitSeconds} 秒</Text>
                  {STEPS.map((step, si) => (
                    <View key={step.key} style={styles.stepRow}>
                      <Text style={[styles.stepIcon, { color: si <= currentStep ? colors.down : theme.textMuted }]}>
                        {si < currentStep ? '✓' : si === currentStep ? '•' : '○'}
                      </Text>
                      <Text style={[styles.stepLabel, { color: si <= currentStep ? theme.text : theme.textMuted }]}>{step.label}</Text>
                    </View>
                  ))}
                  {waitSeconds >= 30 && (
                    <Text style={[styles.slowHint, { color: waitSeconds >= 60 ? colors.warning : theme.textMuted }]}>模型响应较慢，可以继续等待，或稍后重试。</Text>
                  )}
                  <ActivityIndicator size="small" color={colors.primary} style={{ marginTop: 8 }} />
                </View>
              )}
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {pendingSkill && (
        <View style={[styles.skillChangeBar, { backgroundColor: theme.card, borderTopColor: colors.warning }]}>
          <Text style={[styles.skillChangeText, { color: theme.text }]}>切换为 {ALL_SKILLS.find(s => s.id === pendingSkill)?.name || pendingSkill}?</Text>
          <View style={styles.skillChangeActions}>
            <TouchableOpacity onPress={() => setPendingSkill(null)} style={[styles.skillChangeCancelBtn, { backgroundColor: theme.inputBackground }]}>
              <Text style={[styles.skillChangeCancelText, { color: theme.textSecondary }]}>取消</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={confirmSkillChange} style={[styles.skillChangeConfirmBtn, { backgroundColor: colors.primary }]}>
              <Text style={styles.skillChangeConfirmText}>确认</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <View style={[styles.inputBar, { backgroundColor: theme.headerBackground, borderTopColor: theme.border }]}>
        <TextInput
          style={[styles.input, { backgroundColor: theme.inputBackground, color: theme.text, borderColor: theme.border }]}
          value={question}
          onChangeText={setQuestion}
          placeholder="输入股票和问题..."
          placeholderTextColor={theme.textMuted}
        />
        <TouchableOpacity
          style={[styles.sendBtn, { backgroundColor: colors.primary }, (chatting || !question.trim()) && styles.sendBtnDisabled]}
          onPress={doChat}
          disabled={chatting || !question.trim()}
        >
          <Text style={styles.sendBtnText}>发送</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topBar: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  topBarTitle: { fontSize: 17, fontWeight: 'bold' },
  clearBtn: { paddingHorizontal: 10, paddingVertical: 4 },
  clearBtnText: { fontSize: 13, fontWeight: '500' },
  skillBar: { paddingVertical: 8, paddingLeft: 12 },
  skillChip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16, marginRight: 8 },
  skillChipText: { fontSize: 13, fontWeight: '500' },
  activeSkillRow: { paddingHorizontal: 12, paddingBottom: 4 },
  activeSkillText: { fontSize: 12, fontWeight: '500' },
  stockContextText: { fontSize: 11, marginTop: 3 },
  modeSection: { paddingHorizontal: 12, paddingBottom: 8 },
  modeSwitch: { flexDirection: 'row', borderRadius: 12, padding: 3, gap: 3 },
  modeOption: { flex: 1, borderRadius: 10, paddingVertical: 7, paddingHorizontal: 8, alignItems: 'center' },
  modeName: { fontSize: 13, fontWeight: '700' },
  modeDesc: { fontSize: 10, marginTop: 2 },
  bubbleSystem: { alignSelf: 'center', maxWidth: '85%', padding: 10, borderRadius: 8, marginBottom: 8, borderWidth: 1 },
  systemText: { fontSize: 12, textAlign: 'center', lineHeight: 18 },
  chatScroll: { flex: 1 },
  chatContent: { padding: 16, paddingBottom: 8 },
  emptyState: { alignItems: 'flex-start', marginTop: 20 },
  emptyTitle: { fontSize: 14, lineHeight: 22, marginBottom: 20 },
  exampleSection: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  exampleLabel: { fontSize: 13, width: '100%', marginBottom: 4 },
  exampleChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderWidth: 1 },
  exampleChipText: { fontSize: 13 },
  bubble: { maxWidth: '90%', padding: 12, borderRadius: 12, marginBottom: 8 },
  bubbleUser: { alignSelf: 'flex-end', borderBottomRightRadius: 4 },
  bubbleAssistant: { alignSelf: 'flex-start', borderBottomLeftRadius: 4, borderWidth: StyleSheet.hairlineWidth },
  bubbleTextUser: { color: '#FFF', fontSize: 15, lineHeight: 22 },
  bubbleTextAssistant: { fontSize: 14, lineHeight: 22 },
  skillTag: { fontSize: 11, fontWeight: '600', marginBottom: 4 },
  waitText: { fontSize: 12, marginBottom: 4 },
  slowHint: { fontSize: 12, lineHeight: 18, marginTop: 8 },
  stepRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  stepIcon: { width: 20, fontSize: 14, textAlign: 'center' },
  stepLabel: { fontSize: 13, marginLeft: 6 },
  skillChangeBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderTopWidth: 1 },
  skillChangeText: { fontSize: 13, fontWeight: '500', flex: 1 },
  skillChangeActions: { flexDirection: 'row', gap: 8 },
  skillChangeCancelBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
  skillChangeCancelText: { fontSize: 13, fontWeight: '500' },
  skillChangeConfirmBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
  skillChangeConfirmText: { color: '#FFF', fontSize: 13, fontWeight: '500' },
  inputBar: { flexDirection: 'row', alignItems: 'center', padding: 8, borderTopWidth: 1 },
  input: { flex: 1, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, fontSize: 15, maxHeight: 100, borderWidth: StyleSheet.hairlineWidth },
  sendBtn: { borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, marginLeft: 8 },
  sendBtnDisabled: { opacity: 0.5 },
  sendBtnText: { color: '#FFF', fontSize: 14, fontWeight: '600' },
});
