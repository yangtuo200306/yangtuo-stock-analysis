import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ActivityIndicator, View, Text, StatusBar, Image } from 'react-native';
import { initApiBaseUrl } from './src/api/client';
import WatchlistScreen from './src/screens/WatchlistScreen';
import AskStockScreen from './src/screens/AskStockScreen';
import MarketReviewScreen from './src/screens/MarketReviewScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import AnalysisDetailScreen from './src/screens/AnalysisDetailScreen';
import HistoryScreen from './src/screens/HistoryScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import ToastProvider from './src/components/Toast';

export type RootStackParamList = {
  MainTabs: undefined;
  AnalysisDetail: {
    recordId: number;
    stockCode?: string;
    stockName?: string;
    price?: number;
    changePct?: number;
  };
  History: undefined;
  Settings: undefined;
};

export type TabParamList = {
  Watchlist: undefined;
  AskStock: undefined;
  Market: undefined;
  Profile: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: '#007AFF',
        tabBarInactiveTintColor: '#8E8E93',
        headerStyle: { backgroundColor: '#F8F9FA' },
        headerTitleStyle: { fontWeight: 'bold' },
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

export default function App() {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    initApiBaseUrl().finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8F9FA' }}>
        <Text style={{ fontSize: 36, marginBottom: 16 }}>📈</Text>
        <Text style={{ fontSize: 20, fontWeight: 'bold', color: '#3C3C43' }}>智能股票分析</Text>
        <Text style={{ fontSize: 13, color: '#8E8E93', marginTop: 8 }}>加载中...</Text>
      </View>
    );
  }

  return (
    <NavigationContainer>
      <StatusBar barStyle="dark-content" />
      <ToastProvider />
      <Stack.Navigator>
        <Stack.Screen name="MainTabs" component={MainTabs} options={{ headerShown: false }} />
        <Stack.Screen
          name="AnalysisDetail"
          component={AnalysisDetailScreen}
          options={({ route }) => ({
            headerTitle: route.params.stockName
              ? `${route.params.stockName} (${route.params.stockCode})`
              : '分析详情',
            headerBackTitle: '返回',
          })}
        />
        <Stack.Screen
          name="History"
          component={HistoryScreen}
          options={{
            headerTitle: '历史记录',
            headerBackTitle: '返回',
          }}
        />
        <Stack.Screen
          name="Settings"
          component={SettingsScreen}
          options={{
            headerTitle: '设置',
            headerBackTitle: '返回',
          }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

