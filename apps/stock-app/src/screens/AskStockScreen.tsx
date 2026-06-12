import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator,
  StyleSheet, KeyboardAvoidingView, Platform, Alert, Share,
} from 'react-native';
import { getApiBaseUrl } from '../api/client';
import { showToast } from '../components/Toast';

// 策略定义（硬编码，无需后端接口）
const ALL_SKILLS = [
  { id: 'ma', name: '均线' },
  { id: 'chan', name: '缠论' },
  { id: 'wave', name: '波浪' },
  { id: 'hot', name: '热点' },
  { id: 'event', name: '事件' },
  { id: 'trend', name: '趋势' },
  { id: 'growth', name: '成长' },
  { id: 'expect', name: '预期' },
];

// 步骤模拟
const STEPS = [
  { key: 'data', label: '获取K线数据' },
  { key: 'structure', label: '识别结构形态' },
  { key: 'analyze', label: '分析买卖信号' },
];

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  skill?: string;
  skillChanged?: boolean; // 标记策略变更
}

export default function AskStockScreen() {
  const [selectedSkill, setSelectedSkill] = useState<string>('chan');
  const [showMore, setShowMore] = useState(false);
  const [question, setQuestion] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatting, setChatting] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  const stepTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // 策略切换状态
  const [pendingSkill, setPendingSkill] = useState<string | null>(null);
  const prevSkillRef = useRef<string>('chan');

  // 清除对话
  const clearChat = () => {
    setMessages([]);
    prevSkillRef.current = selectedSkill;
  };

  // 切换策略 — 方案B：对话框中切换显示变更标记 + 底部确认条
  const handleSkillPress = (skillId: string) => {
    if (skillId === selectedSkill) return;
    if (messages.length === 0) {
      // 对话开始前：直接切换
      setSelectedSkill(skillId);
      prevSkillRef.current = skillId;
      return;
    }
    // 对话进行中：弹出确认条
    setPendingSkill(skillId);
  };

  // 确认策略切换
  const confirmSkillChange = () => {
    if (!pendingSkill) return;
    const oldSkill = selectedSkill;
    setSelectedSkill(pendingSkill);
    setPendingSkill(null);
    // 插入策略变更标记消息
    const oldName = ALL_SKILLS.find(s => s.id === oldSkill)?.name || oldSkill;
    const newName = ALL_SKILLS.find(s => s.id === pendingSkill)?.name || pendingSkill;
    setMessages(prev => [...prev, {
      role: 'assistant',
      content: `策略已从 [${oldName}] 切换为 [${newName}]，后续回复将使用新策略分析。`,
      skillChanged: true,
    }]);
    prevSkillRef.current = pendingSkill;
  };

  // 撤销策略切换
  const cancelSkillChange = () => {
    setPendingSkill(null);
  };

  // 步进动画
  const startStepAnimation = () => {
    setCurrentStep(0);
    let i = 0;
    stepTimer.current = setInterval(() => {
      i++;
      if (i >= STEPS.length) {
        if (stepTimer.current) clearInterval(stepTimer.current);
        return;
      }
      setCurrentStep(i);
    }, 6000);
  };

  useEffect(() => {
    return () => {
      if (stepTimer.current) clearInterval(stepTimer.current);
    };
  }, []);

  const doChat = async () => {
    if (!question.trim()) return;

    const userMsg: ChatMessage = { role: 'user', content: question.trim() };
    setMessages(prev => [...prev, userMsg]);
    setQuestion('');
    setChatting(true);
    startStepAnimation();

    const assistantMsg: ChatMessage = { role: 'assistant', content: '', skill: selectedSkill };
    setMessages(prev => [...prev, assistantMsg]);

    const baseUrl = getApiBaseUrl();
    let accumulated = '';

    const abortController = new AbortController();
    const STREAM_TIMEOUT_MS = 60000;

    const doStreamFetch = async () => {
      const res = await fetch(baseUrl + '/api/v1/agent/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: question.trim(),
          session_id: `app_${Date.now()}`,
          skills: selectedSkill ? [selectedSkill] : undefined,
        }),
        signal: abortController.signal,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const reader = res.body?.getReader();
      if (!reader) throw new Error('No reader');
      const decoder = new TextDecoder();
      let buffer = '';

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || !trimmed.startsWith('data: ')) continue;
            try {
              const event = JSON.parse(trimmed.slice(6));
              if (event.type === 'generating' && event.content) {
                accumulated += event.content;
                setMessages(prev => {
                  const updated = [...prev];
                  const last = updated[updated.length - 1];
                  if (last && last.role === 'assistant') {
                    updated[updated.length - 1] = { ...last, content: accumulated };
                  }
                  return updated;
                });
              } else if (event.type === 'done') {
                if (!event.success && event.error) throw new Error(event.error);
                return;
              } else if (event.type === 'error') {
                throw new Error(event.message || '分析出错');
              }
            } catch (e) {
              throw e;
            }
          }
        }
      } finally {
        clearTimeout(timeoutId);
      }
    };

    const timeoutId = setTimeout(() => {
      abortController.abort();
      showToast('分析请求超时，切换至基础分析模式');
    }, STREAM_TIMEOUT_MS);

    doStreamFetch()
      .catch(() => {
        showToast('流式分析失败，切换至基础分析模式');
        const fallbackController = new AbortController();
        const fallbackTimeout = setTimeout(() => fallbackController.abort(), 60000);
        fetch(baseUrl + '/api/v1/agent/research', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ question: question.trim() }),
          signal: fallbackController.signal,
        })
          .then(async (res) => {
            clearTimeout(fallbackTimeout);
            const data = await res.json();
            const content = data.success
              ? data.content
              : `错误: ${data.error || '未知错误'}`;
            setMessages(prev => {
              const updated = [...prev];
              updated[updated.length - 1] = { role: 'assistant', content, skill: selectedSkill };
              return updated;
            });
          })
          .catch((e2) => {
            clearTimeout(fallbackTimeout);
            setMessages(prev => {
              const updated = [...prev];
              updated[updated.length - 1] = {
                role: 'assistant',
                content: `请求失败: ${e2.message || '网络错误'}`,
                skill: selectedSkill,
              };
              return updated;
            });
          });
      })
      .finally(() => {
        clearTimeout(timeoutId);
        setChatting(false);
        if (stepTimer.current) clearInterval(stepTimer.current);
      });
  };

  // 长按消息
  const handleLongPress = (msg: ChatMessage) => {
    if (!msg.content) return;
    Alert.alert('操作', undefined, [
      {
        text: '复制',
        onPress: () => {
          Share.share({ message: msg.content });
        },
      },
      {
        text: '分享',
        onPress: () => {
          Share.share({ message: msg.content });
        },
      },
      { text: '取消', style: 'cancel' },
    ]);
  };

  // 主策略 + 更多
  const mainSkills = ALL_SKILLS.slice(0, 7);
  const moreSkills = ALL_SKILLS.slice(7);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* 顶部栏 */}
      <View style={styles.topBar}>
        <Text style={styles.topBarTitle}>💬 AI策略问股</Text>
        {messages.length > 0 && (
          <TouchableOpacity onPress={clearChat} style={styles.clearBtn}>
            <Text style={styles.clearBtnText}>清除对话</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* 策略标签栏 */}
      <View style={styles.skillBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {mainSkills.map(s => (
            <TouchableOpacity
              key={s.id}
              style={[styles.skillChip, selectedSkill === s.id && styles.skillChipActive, pendingSkill === s.id && styles.skillChipPending]}
              onPress={() => handleSkillPress(s.id)}
            >
              <Text style={[styles.skillChipText, selectedSkill === s.id && styles.skillChipTextActive]}>
                {s.name}
              </Text>
            </TouchableOpacity>
          ))}
          {moreSkills.length > 0 && (
            <TouchableOpacity
              style={[styles.skillChip, showMore && styles.skillChipActive]}
              onPress={() => setShowMore(!showMore)}
            >
              <Text style={[styles.skillChipText, showMore && styles.skillChipTextActive]}>更多▼</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </View>

      {/* 更多策略下拉 */}
      {showMore && moreSkills.length > 0 && (
        <View style={styles.morePanel}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {ALL_SKILLS.map(s => (
              <TouchableOpacity
                key={s.id}
                style={[styles.skillChip, selectedSkill === s.id && styles.skillChipActive, pendingSkill === s.id && styles.skillChipPending]}
                onPress={() => handleSkillPress(s.id)}
              >
                <Text style={[styles.skillChipText, selectedSkill === s.id && styles.skillChipTextActive]}>
                  {s.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* 当前策略标签 */}
      {selectedSkill && (
        <View style={styles.activeSkillRow}>
          <Text style={styles.activeSkillText}>
            📌 当前策略: {ALL_SKILLS.find(s => s.id === selectedSkill)?.name || selectedSkill}
          </Text>
        </View>
      )}

      {/* 对话区 */}
      <ScrollView
        ref={scrollRef}
        style={styles.chatScroll}
        contentContainerStyle={styles.chatContent}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
      >
        {messages.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>🤖 你好！选择上方策略，输入股票和问题开始分析</Text>
            <View style={styles.exampleSection}>
              <Text style={styles.exampleLabel}>示例问题：</Text>
              <TouchableOpacity style={styles.exampleChip} onPress={() => {
                setQuestion('分析茅台买点');
                setSelectedSkill('chan');
              }}>
                <Text style={styles.exampleChipText}>缠论看茅台</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.exampleChip} onPress={() => {
                setQuestion('宁德时代走势');
                setSelectedSkill('wave');
              }}>
                <Text style={styles.exampleChipText}>波浪看宁德</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.exampleChip} onPress={() => {
                setQuestion('大盘趋势分析');
                setSelectedSkill('trend');
              }}>
                <Text style={styles.exampleChipText}>大盘趋势</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.exampleChip} onPress={() => {
                setQuestion('半导体板块热度');
                setSelectedSkill('hot');
              }}>
                <Text style={styles.exampleChipText}>半导体热点</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {messages.map((msg, i) => (
          <TouchableOpacity
            key={i}
            onLongPress={() => handleLongPress(msg)}
            activeOpacity={0.8}
          >
            <View
              style={[
                styles.bubble,
                msg.role === 'user' ? styles.bubbleUser : msg.skillChanged ? styles.bubbleSystem : styles.bubbleAssistant,
              ]}
            >
              {msg.skillChanged ? (
                <Text style={styles.systemText}>{msg.content}</Text>
              ) : (
                <>
                  {msg.skill && msg.role === 'assistant' && msg.content && (
                    <Text style={styles.skillTag}>
                      [{ALL_SKILLS.find(s => s.id === msg.skill)?.name || msg.skill}]
                    </Text>
                  )}
                  {msg.role === 'user' ? (
                    <Text style={styles.bubbleTextUser}>{msg.content}</Text>
                  ) : msg.content ? (
                    <Text style={styles.bubbleTextAssistant}>{msg.content}</Text>
                  ) : (
                    <View>
                      <Text style={styles.skillTag}>
                        [{ALL_SKILLS.find(s => s.id === selectedSkill)?.name || selectedSkill}] 正在分析...
                      </Text>
                      {STEPS.map((step, si) => (
                        <View key={step.key} style={styles.stepRow}>
                          <Text style={[styles.stepIcon, { color: si <= currentStep ? '#34C759' : '#D1D1D6' }]}>
                            {si < currentStep ? '✓' : si === currentStep ? '⏳' : '○'}
                          </Text>
                          <Text style={[styles.stepLabel, { color: si <= currentStep ? '#3C3C43' : '#D1D1D6' }]}>
                            {step.label}
                          </Text>
                        </View>
                      ))}
                      <ActivityIndicator size="small" style={{ marginTop: 8 }} />
                    </View>
                  )}
                </>
              )}
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* 策略切换确认条 */}
      {pendingSkill && (
        <View style={styles.skillChangeBar}>
          <Text style={styles.skillChangeText}>
            策略已切换为：{ALL_SKILLS.find(s => s.id === pendingSkill)?.name || pendingSkill}
          </Text>
          <View style={styles.skillChangeActions}>
            <TouchableOpacity onPress={cancelSkillChange} style={styles.skillChangeCancelBtn}>
              <Text style={styles.skillChangeCancelText}>撤销</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={confirmSkillChange} style={styles.skillChangeConfirmBtn}>
              <Text style={styles.skillChangeConfirmText}>确认</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* 输入栏 */}
      <View style={styles.inputBar}>
        <TextInput
          style={styles.input}
          value={question}
          onChangeText={setQuestion}
          placeholder="输入股票和问题..."
          placeholderTextColor="#A0A0A0"
        />
        <TouchableOpacity
          style={[styles.sendBtn, (chatting || !question.trim()) && styles.sendBtnDisabled]}
          onPress={doChat}
          disabled={chatting || !question.trim()}
        >
          <Text style={styles.sendBtnText}>✈️</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F2F2F7' },

  // Top bar
  topBar: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E5E5EA',
    backgroundColor: '#F8F9FA',
  },
  topBarTitle: { fontSize: 17, fontWeight: 'bold' },
  clearBtn: { paddingHorizontal: 10, paddingVertical: 4 },
  clearBtnText: { color: '#007AFF', fontSize: 13, fontWeight: '500' },

  // Skills
  skillBar: { paddingVertical: 8, paddingLeft: 12 },
  skillChip: {
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16,
    backgroundColor: '#E5E5EA', marginRight: 8,
  },
  skillChipActive: { backgroundColor: '#007AFF' },
  skillChipPending: { backgroundColor: '#FF9500' },
  skillChipText: { fontSize: 13, color: '#3C3C43', fontWeight: '500' },
  skillChipTextActive: { color: '#FFF' },
  morePanel: {
    marginHorizontal: 12, backgroundColor: '#FFF', borderRadius: 10,
    padding: 8, elevation: 3, marginBottom: 4,
  },

  // Active skill
  activeSkillRow: { paddingHorizontal: 12, paddingBottom: 4 },
  activeSkillText: { fontSize: 12, color: '#007AFF', fontWeight: '500' },

  // System message
  bubbleSystem: {
    backgroundColor: '#FFFBE6', alignSelf: 'center', maxWidth: '85%',
    padding: 10, borderRadius: 8, marginBottom: 8, borderWidth: 1, borderColor: '#FFE58F',
  },
  systemText: { fontSize: 12, color: '#8C6E00', textAlign: 'center', lineHeight: 18 },

  // Chat scroll
  chatScroll: { flex: 1 },
  chatContent: { padding: 16, paddingBottom: 8 },

  // Empty state
  emptyState: { alignItems: 'flex-start', marginTop: 20 },
  emptyTitle: { fontSize: 14, color: '#8E8E93', lineHeight: 22, marginBottom: 20 },
  exampleSection: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  exampleLabel: { fontSize: 13, color: '#C7C7CC', width: '100%', marginBottom: 4 },
  exampleChip: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16,
    backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E5E5EA',
  },
  exampleChipText: { fontSize: 13, color: '#3C3C43' },

  // Bubble
  bubble: {
    maxWidth: '90%', padding: 12, borderRadius: 12, marginBottom: 8,
  },
  bubbleUser: {
    backgroundColor: '#007AFF', alignSelf: 'flex-end',
    borderBottomRightRadius: 4,
  },
  bubbleAssistant: {
    backgroundColor: '#FFF', alignSelf: 'flex-start',
    borderBottomLeftRadius: 4, elevation: 1,
  },
  bubbleTextUser: { color: '#FFF', fontSize: 15, lineHeight: 22 },
  bubbleTextAssistant: { color: '#3C3C43', fontSize: 14, lineHeight: 22 },

  // Skill tag in bubble
  skillTag: { color: '#007AFF', fontSize: 11, fontWeight: '600', marginBottom: 4 },

  // Steps
  stepRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  stepIcon: { width: 20, fontSize: 14, textAlign: 'center' },
  stepLabel: { fontSize: 13, marginLeft: 6 },

  // Skill change confirm bar
  skillChangeBar: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 8,
    backgroundColor: '#FFF8E1', borderTopWidth: 1, borderTopColor: '#FFE082',
  },
  skillChangeText: { fontSize: 13, color: '#8C6E00', fontWeight: '500', flex: 1 },
  skillChangeActions: { flexDirection: 'row', gap: 8 },
  skillChangeCancelBtn: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6,
    backgroundColor: '#FFF',
  },
  skillChangeCancelText: { color: '#8E8E93', fontSize: 13, fontWeight: '500' },
  skillChangeConfirmBtn: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6,
    backgroundColor: '#007AFF',
  },
  skillChangeConfirmText: { color: '#FFF', fontSize: 13, fontWeight: '500' },

  // Input bar
  inputBar: {
    flexDirection: 'row', alignItems: 'center', padding: 8,
    borderTopWidth: 1, borderTopColor: '#E5E5EA', backgroundColor: '#FFF',
  },
  input: {
    flex: 1, backgroundColor: '#F2F2F7', borderRadius: 20, paddingHorizontal: 16,
    paddingVertical: 10, fontSize: 15, maxHeight: 100,
  },
  sendBtn: {
    backgroundColor: '#007AFF', borderRadius: 20, paddingHorizontal: 16,
    paddingVertical: 10, marginLeft: 8,
  },
  sendBtnDisabled: { opacity: 0.5 },
  sendBtnText: { color: '#FFF', fontSize: 16 },
});