import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, Alert, StyleSheet, ScrollView, ActivityIndicator,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App';
import { api, getApiBaseUrl, setApiBaseUrl } from '../api/client';

type NavProp = NativeStackNavigationProp<RootStackParamList>;

export default function SettingsScreen() {
  const navigation = useNavigation<NavProp>();
  const [url, setUrl] = useState('');
  const [saved, setSaved] = useState(false);

  // Login form
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const [loggedIn, setLoggedIn] = useState(false);
  const [authing, setAuthing] = useState(false);

  useEffect(() => {
    setUrl(getApiBaseUrl());
    // Check if already logged in
    (async () => {
      try {
        const token = await AsyncStorage.getItem('@auth_token');
        if (token) setLoggedIn(true);
      } catch {}
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
      try {
        await AsyncStorage.setItem('@auth_token', data.token || data.access_token || '');
      } catch {}
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
    try {
      await AsyncStorage.removeItem('@auth_token');
    } catch {}
    setLoggedIn(false);
    Alert.alert('已退出登录');
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Server URL */}
      <Text style={styles.sectionTitle}>服务器地址</Text>
      <TextInput
        style={styles.input}
        value={url}
        onChangeText={setUrl}
        placeholder="http://localhost:8000"
        autoCapitalize="none"
        autoCorrect={false}
      />
      <Text style={styles.hint}>
        Android 模拟器: http://10.0.2.2:8000{'\n'}
        真机测试: 使用电脑局域网 IP
      </Text>
      <TouchableOpacity style={styles.btn} onPress={saveUrl}>
        <Text style={styles.btnText}>保存</Text>
      </TouchableOpacity>
      {saved && <Text style={styles.savedText}>✅ 已保存</Text>}

      <View style={styles.divider} />

      {/* History Entry */}
      <Text style={styles.sectionTitle}>数据</Text>
      <TouchableOpacity
        style={styles.menuItem}
        onPress={() => navigation.navigate('History')}
      >
        <Text style={styles.menuItemText}>📋 分析历史</Text>
        <Text style={styles.menuArrow}>→</Text>
      </TouchableOpacity>

      <View style={styles.divider} />

      {/* Auth */}
      <Text style={styles.sectionTitle}>{loggedIn ? '账号' : '登录 / 注册'}</Text>
      {loggedIn ? (
        <View style={styles.loggedInCard}>
          <Text style={styles.loggedInText}>✅ 已登录</Text>
          <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
            <Text style={styles.logoutBtnText}>退出登录</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.authCard}>
          <View style={styles.authSwitch}>
            <TouchableOpacity
              style={[styles.authTab, isLogin && styles.authTabActive]}
              onPress={() => setIsLogin(true)}
            >
              <Text style={[styles.authTabText, isLogin && styles.authTabTextActive]}>登录</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.authTab, !isLogin && styles.authTabActive]}
              onPress={() => setIsLogin(false)}
            >
              <Text style={[styles.authTabText, !isLogin && styles.authTabTextActive]}>注册</Text>
            </TouchableOpacity>
          </View>
          <TextInput
            style={styles.input}
            value={username}
            onChangeText={setUsername}
            placeholder="用户名"
            autoCapitalize="none"
          />
          <TextInput
            style={[styles.input, { marginTop: 8 }]}
            value={password}
            onChangeText={setPassword}
            placeholder="密码"
            secureTextEntry
          />
          <TouchableOpacity
            style={[styles.btn, authing && styles.btnDisabled]}
            onPress={handleAuth}
            disabled={authing}
          >
            {authing ? (
              <ActivityIndicator color="#FFF" size="small" />
            ) : (
              <Text style={styles.btnText}>{isLogin ? '登录' : '注册'}</Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.divider} />

      {/* About */}
      <Text style={styles.sectionTitle}>关于</Text>
      <View style={styles.aboutCard}>
        <Text style={styles.appName}>智能股票分析</Text>
        <Text style={styles.version}>版本 1.0.0</Text>
        <Text style={styles.version}>Expo + React Native</Text>
        <Text style={styles.version}>后端: FastAPI</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F2F2F7' },
  content: { padding: 16 },
  sectionTitle: { fontSize: 16, fontWeight: '600', marginBottom: 8, color: '#3C3C43' },
  input: {
    backgroundColor: '#FFF', borderRadius: 8, borderWidth: 1, borderColor: '#E5E5EA',
    padding: 12, fontSize: 14,
  },
  hint: { fontSize: 12, color: '#8E8E93', marginTop: 8, lineHeight: 18 },
  btn: {
    backgroundColor: '#007AFF', borderRadius: 8, padding: 14,
    alignItems: 'center', marginTop: 12,
  },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: '#FFF', fontSize: 16, fontWeight: '600' },
  savedText: { color: '#34C759', fontSize: 14, textAlign: 'center', marginTop: 8, fontWeight: '600' },
  divider: { height: 1, backgroundColor: '#E5E5EA', marginVertical: 20 },

  // Menu
  menuItem: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#FFF', borderRadius: 12, padding: 16, elevation: 1,
  },
  menuItemText: { fontSize: 16, fontWeight: '500' },
  menuArrow: { color: '#C7C7CC', fontSize: 18 },

  // Auth
  authCard: {
    backgroundColor: '#FFF', borderRadius: 12, padding: 16, elevation: 1,
  },
  authSwitch: { flexDirection: 'row', marginBottom: 12, backgroundColor: '#F2F2F7', borderRadius: 8, padding: 2 },
  authTab: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 6 },
  authTabActive: { backgroundColor: '#FFF' },
  authTabText: { fontSize: 14, fontWeight: '500', color: '#8E8E93' },
  authTabTextActive: { color: '#007AFF' },

  // Logged in
  loggedInCard: {
    backgroundColor: '#FFF', borderRadius: 12, padding: 16, alignItems: 'center', elevation: 1,
  },
  loggedInText: { fontSize: 16, fontWeight: '600', color: '#34C759', marginBottom: 12 },
  logoutBtn: {
    backgroundColor: '#FF3B30', borderRadius: 8, paddingVertical: 10, paddingHorizontal: 32,
  },
  logoutBtnText: { color: '#FFF', fontSize: 15, fontWeight: '600' },

  // About
  aboutCard: {
    backgroundColor: '#FFF', borderRadius: 12, padding: 16, elevation: 1,
  },
  appName: { fontSize: 18, fontWeight: 'bold', marginBottom: 8 },
  version: { fontSize: 14, color: '#8E8E93', marginTop: 2 },
});