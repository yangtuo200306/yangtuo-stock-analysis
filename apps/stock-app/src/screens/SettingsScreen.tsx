import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { api, getApiBaseUrl, getBffApiKey, getMobileBackendUrl, setApiBaseUrl, setBffApiKey, setMobileBackendUrl } from '../api/client';
import { removeSecure, getSecure, setSecure } from '../utils/storage';
import { useTheme, colors, spacing, borderRadius, fontSize } from '../theme';
import type { RootStackParamList } from '../types';

type NavProp = NativeStackNavigationProp<RootStackParamList>;

export default function SettingsScreen() {
  const navigation = useNavigation<NavProp>();
  const { theme } = useTheme();
  const [url, setUrl] = useState('');
  const [saved, setSaved] = useState(false);

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const [loggedIn, setLoggedIn] = useState(false);
  const [authing, setAuthing] = useState(false);

  const [bffUrl, setBffUrl] = useState('');
  const [bffApiKey, setBffApiKeyState] = useState('');
  const [bffSaved, setBffSaved] = useState(false);

  useEffect(() => {
    setUrl(getApiBaseUrl());

    (async () => {
      try {
        const token = await getSecure('@auth_token');
        setLoggedIn(Boolean(token));
      } catch {
        setLoggedIn(false);
      }
    })();

    (async () => {
      try {
        const nextBffUrl = await getMobileBackendUrl();
        const nextBffApiKey = await getBffApiKey();
        setBffUrl(nextBffUrl);
        setBffApiKeyState(nextBffApiKey);
      } catch {
        setBffUrl('http://localhost:8001');
      }
    })();
  }, []);

  const saveUrl = async () => {
    const trimmed = url.trim();
    if (!trimmed) {
      Alert.alert('提示', '请输入服务器地址');
      return;
    }

    await setApiBaseUrl(trimmed);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    Alert.alert('成功', '服务器地址已更新');
  };

  const saveBffConfig = async () => {
    await setMobileBackendUrl(bffUrl.trim() || 'http://localhost:8001');
    await setBffApiKey(bffApiKey.trim());
    setBffSaved(true);
    setTimeout(() => setBffSaved(false), 2000);
    Alert.alert('成功', '手机后端配置已保存');
  };

  const handleAuth = async () => {
    if (!username.trim() || !password.trim()) {
      Alert.alert('提示', '请输入用户名和密码');
      return;
    }

    setAuthing(true);
    try {
      const endpoint = isLogin ? '/api/v1/auth/login' : '/api/v1/auth/register';
      const res = await api.post(endpoint, {
        username: username.trim(),
        password: password.trim(),
      });
      const data = res.data;

      await setSecure('@auth_token', data.token || data.access_token || '');
      setLoggedIn(true);
      Alert.alert('成功', isLogin ? '登录成功' : '注册成功');
      setUsername('');
      setPassword('');
    } catch (e: any) {
      Alert.alert('错误', e.response?.data?.detail?.message || e.message || '网络错误');
    } finally {
      setAuthing(false);
    }
  };

  const handleLogout = async () => {
    await removeSecure('@auth_token');
    setLoggedIn(false);
    Alert.alert('已退出登录');
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.background }} contentContainerStyle={{ padding: spacing.lg }}>
      <View style={[styles.sectionCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>共享后端地址</Text>
        <TextInput
          style={[styles.input, { backgroundColor: theme.inputBackground, borderColor: theme.border, color: theme.text }]}
          value={url}
          onChangeText={setUrl}
          placeholder="http://192.168.1.14:8000"
          placeholderTextColor={theme.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <Text style={[styles.hint, { color: theme.textMuted }]}>真机测试请填写电脑局域网 IP；Android 模拟器通常使用 http://10.0.2.2:8000。</Text>
        <TouchableOpacity style={[styles.btn, { backgroundColor: colors.primary }]} onPress={saveUrl}>
          <Text style={styles.btnText}>保存</Text>
        </TouchableOpacity>
        {saved && <Text style={[styles.savedText, { color: colors.primary }]}>已保存</Text>}
      </View>

      <View style={[styles.sectionCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>手机后端 BFF</Text>
        <TextInput
          style={[styles.input, { backgroundColor: theme.inputBackground, borderColor: theme.border, color: theme.text }]}
          value={bffUrl}
          onChangeText={setBffUrl}
          placeholder="http://192.168.1.14:8001"
          placeholderTextColor={theme.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <TextInput
          style={[styles.input, { backgroundColor: theme.inputBackground, borderColor: theme.border, color: theme.text, marginTop: spacing.sm }]}
          value={bffApiKey}
          onChangeText={setBffApiKeyState}
          placeholder="API Key，可选"
          placeholderTextColor={theme.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
          secureTextEntry
        />
        <Text style={[styles.hint, { color: theme.textMuted }]}>BFF 用于手机端聚合行情、缓存和限流；未启动时核心分析功能仍走共享后端。</Text>
        <TouchableOpacity style={[styles.btn, { backgroundColor: colors.primary }]} onPress={saveBffConfig}>
          <Text style={styles.btnText}>保存 BFF 配置</Text>
        </TouchableOpacity>
        {bffSaved && <Text style={[styles.savedText, { color: colors.primary }]}>已保存</Text>}
      </View>

      <View style={[styles.sectionCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <TouchableOpacity
          style={[styles.menuItem, { borderBottomColor: theme.borderLight }]}
          onPress={() => navigation.navigate('History')}
        >
          <Text style={[styles.menuItemText, { color: theme.text }]}>分析历史</Text>
          <Text style={[styles.chevron, { color: theme.textMuted }]}>›</Text>
        </TouchableOpacity>
      </View>

      <View style={[styles.sectionCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>{loggedIn ? '账号' : '登录 / 注册'}</Text>
        {loggedIn ? (
          <View style={{ alignItems: 'center' }}>
            <Text style={[styles.loggedInText, { color: colors.success }]}>已登录</Text>
            <TouchableOpacity
              style={[styles.logoutBtn, { backgroundColor: colors.error }]}
              onPress={handleLogout}
            >
              <Text style={styles.logoutBtnText}>退出登录</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View>
            <View style={[styles.authSwitch, { backgroundColor: theme.inputBackground }]}>
              <TouchableOpacity
                style={[styles.authTab, isLogin && { backgroundColor: theme.elevated }]}
                onPress={() => setIsLogin(true)}
              >
                <Text style={[styles.authTabText, { color: isLogin ? colors.primary : theme.textMuted }]}>登录</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.authTab, !isLogin && { backgroundColor: theme.elevated }]}
                onPress={() => setIsLogin(false)}
              >
                <Text style={[styles.authTabText, { color: !isLogin ? colors.primary : theme.textMuted }]}>注册</Text>
              </TouchableOpacity>
            </View>
            <TextInput
              style={[styles.input, { backgroundColor: theme.inputBackground, borderColor: theme.border, color: theme.text }]}
              value={username}
              onChangeText={setUsername}
              placeholder="用户名"
              placeholderTextColor={theme.textMuted}
              autoCapitalize="none"
            />
            <TextInput
              style={[styles.input, { backgroundColor: theme.inputBackground, borderColor: theme.border, color: theme.text, marginTop: spacing.sm }]}
              value={password}
              onChangeText={setPassword}
              placeholder="密码"
              placeholderTextColor={theme.textMuted}
              secureTextEntry
            />
            <TouchableOpacity
              style={[styles.btn, { backgroundColor: colors.primary }, authing && { opacity: 0.5 }]}
              onPress={handleAuth}
              disabled={authing}
            >
              {authing ? <ActivityIndicator color="#FFF" size="small" /> : <Text style={styles.btnText}>{isLogin ? '登录' : '注册'}</Text>}
            </TouchableOpacity>
          </View>
        )}
      </View>

      <View style={[styles.sectionCard, { backgroundColor: theme.card, borderColor: theme.border, alignItems: 'center' }]}>
        <Text style={[styles.appName, { color: theme.text }]}>智能股票分析</Text>
        <Text style={[styles.version, { color: theme.textMuted }]}>版本 1.0.0</Text>
        <Text style={[styles.version, { color: theme.textMuted }]}>Expo + React Native</Text>
        <Text style={[styles.version, { color: theme.textMuted }]}>后端: FastAPI</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  sectionCard: {
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    marginBottom: spacing.md,
  },
  input: {
    borderRadius: borderRadius.md,
    borderWidth: 1,
    padding: spacing.md,
    fontSize: fontSize.md,
  },
  hint: {
    fontSize: fontSize.xs,
    marginTop: spacing.sm,
    lineHeight: 18,
  },
  btn: {
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  btnText: {
    color: '#FFF',
    fontSize: fontSize.md,
    fontWeight: '600',
  },
  savedText: {
    fontSize: fontSize.sm,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  menuItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  menuItemText: {
    fontSize: fontSize.md,
    fontWeight: '500',
  },
  chevron: {
    fontSize: 22,
  },
  authSwitch: {
    flexDirection: 'row',
    marginBottom: spacing.md,
    borderRadius: borderRadius.md,
    padding: 2,
  },
  authTab: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderRadius: borderRadius.md - 2,
  },
  authTabText: {
    fontSize: fontSize.md,
    fontWeight: '500',
  },
  loggedInText: {
    fontSize: fontSize.lg,
    fontWeight: '600',
    marginBottom: spacing.md,
  },
  logoutBtn: {
    borderRadius: borderRadius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing['2xl'],
  },
  logoutBtnText: {
    color: '#FFF',
    fontSize: fontSize.md,
    fontWeight: '600',
  },
  appName: {
    fontSize: fontSize.xl,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  version: {
    fontSize: fontSize.sm,
    marginTop: 2,
  },
});
