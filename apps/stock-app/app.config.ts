import { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * Expo 配置文件 - 支持环境变量
 * 
 * 环境变量说明：
 * - EXPO_PUBLIC_API_URL: 主后端地址 (默认 http://localhost:8000)
 * - EXPO_PUBLIC_BFF_URL: BFF 后端地址 (默认 http://localhost:8001)
 * 
 * 使用方式：
 * 1. 创建 .env 文件设置环境变量
 * 2. 或在打包时通过 EAS Build 设置
 */

export default function config({ config }: ConfigContext): ExpoConfig {
  return {
    ...config,
    name: '智能股票分析',
    slug: 'stock-analysis-app',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'automatic',
    splash: {
      backgroundColor: '#ffffff',
    },
    assetBundlePatterns: ['**/*'],
    ios: {
      supportsTablet: true,
      bundleIdentifier: 'com.dailystock.analysis',
    },
    android: {
      adaptiveIcon: {
        backgroundColor: '#ffffff',
      },
      package: 'com.dailystock.analysis',
    },
    plugins: ['expo-asset', 'expo-font'],
    extra: {
      // API 地址配置 - 通过环境变量设置
      // 开发环境默认 localhost，生产环境通过 .env 或 EAS 设置
      apiUrl: process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8000',
      bffUrl: process.env.EXPO_PUBLIC_BFF_URL || 'http://localhost:8001',
      // 环境标识
      env: process.env.EXPO_PUBLIC_ENV || 'development',
    },
  };
}