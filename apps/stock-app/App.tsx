import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ActivityIndicator, View, Text, StatusBar } from 'react-native';
import { ThemeProvider, useTheme, colors, spacing, fontSize } from './src/theme';
import { initApiBaseUrl } from './src/api/client';
import WatchlistScreen from './src/screens/WatchlistScreen';
import AskStockScreen from './src/screens/AskStockScreen';
import MarketReviewScreen from './src/screens/MarketReviewScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import AnalysisDetailScreen from './src/screens/AnalysisDetailScreen';
import HistoryScreen from './src/screens/HistoryScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import AboutFeedbackScreen from './src/screens/AboutFeedbackScreen';
import StockDetailScreen from './src/screens/StockDetailScreen';
import ToastProvider from './src/components/Toast';
import { StyleSheet } from 'react-native';
import type { RootStackParamList, TabParamList } from './src/types';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

function MainTabs() {
  const { theme, isDark } = useTheme();

  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: theme.textMuted,
        tabBarStyle: {
          backgroundColor: theme.tabBar,
          borderTopColor: theme.tabBarBorder,
          borderTopWidth: StyleSheet.hairlineWidth,
          paddingBottom: 4,
          paddingTop: 4,
          height: 56,
        },
        tabBarLabelStyle: {
          fontSize: fontSize.xs,
          fontWeight: '500',
        },
        headerStyle: {
          backgroundColor: theme.headerBackground,
        },
        headerTitleStyle: {
          fontWeight: '600',
          fontSize: fontSize.lg,
          color: theme.headerText,
        },
        headerTintColor: theme.headerText,
      }}
    >
      <Tab.Screen
        name="Watchlist"
        component={WatchlistScreen}
        options={{
          tabBarLabel: '自选',
          tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 20 }}>📈</Text>,
          headerShown: false,
        }}
      />
      <Tab.Screen
        name="AskStock"
        component={AskStockScreen}
        options={{
          tabBarLabel: '问股',
          tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 20 }}>💬</Text>,
          headerTitle: 'AI 问股',
        }}
      />
      <Tab.Screen
        name="Market"
        component={MarketReviewScreen}
        options={{
          tabBarLabel: '大盘',
          tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 20 }}>📊</Text>,
          headerTitle: '大盘复盘',
          headerShown: false,
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarLabel: '我的',
          tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 20 }}>👤</Text>,
          headerTitle: '我的',
        }}
      />
    </Tab.Navigator>
  );
}

function AppContent() {
  const [loading, setLoading] = useState(true);
  const { theme, isDark } = useTheme();

  useEffect(() => {
    initApiBaseUrl().finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.background }}>
        <Text style={{ fontSize: 48, marginBottom: 16 }}>📈</Text>
        <Text style={{ fontSize: 22, fontWeight: '700', color: theme.text, marginBottom: 8 }}>
          智能股票分析
        </Text>
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <ToastProvider />
      <Stack.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: theme.headerBackground },
          headerTitleStyle: { fontWeight: '600', fontSize: fontSize.lg, color: theme.headerText },
          headerTintColor: theme.headerText,
          headerBackTitle: '返回',
          contentStyle: { backgroundColor: theme.background },
        }}
      >
        <Stack.Screen name="MainTabs" component={MainTabs} options={{ headerShown: false }} />
        <Stack.Screen
          name="AnalysisDetail"
          component={AnalysisDetailScreen}
          options={({ route }) => ({
            headerTitle: route.params?.stock?.name
              ? `${route.params.stock.name} (${route.params.stock.code})`
              : '分析详情',
          })}
        />
        <Stack.Screen
          name="StockDetail"
          component={StockDetailScreen}
          options={({ route }) => ({
            headerTitle: route.params?.name || '个股详情',
          })}
        />
        <Stack.Screen
          name="History"
          component={HistoryScreen}
          options={{ headerTitle: '历史记录' }}
        />
        <Stack.Screen
          name="Settings"
          component={SettingsScreen}
          options={{ headerTitle: '设置' }}
        />
        <Stack.Screen
          name="AboutFeedback"
          component={AboutFeedbackScreen}
          options={{ headerTitle: '关于/反馈' }}
        />
      </Stack.Navigator>
    </View>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <NavigationContainer>
        <AppContent />
      </NavigationContainer>
    </ThemeProvider>
  );
}