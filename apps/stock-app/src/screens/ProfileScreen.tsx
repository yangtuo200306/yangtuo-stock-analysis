import React from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App';

type NavProp = NativeStackNavigationProp<RootStackParamList>;

export default function ProfileScreen() {
  const navigation = useNavigation<NavProp>();

  return (
    <View style={styles.container}>
      {/* 顶部栏 */}
      <View style={styles.headerBar}>
        <Text style={styles.headerTitle}>👤 我的</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* 菜单项 */}
        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => navigation.navigate('History')}
        >
          <View style={styles.menuLeft}>
            <Text style={styles.menuIcon}>📋</Text>
            <View>
              <Text style={styles.menuItemText}>历史分析记录</Text>
              <Text style={styles.menuItemSub}>查看所有分析报告</Text>
            </View>
          </View>
          <Text style={styles.menuArrow}>→</Text>
        </TouchableOpacity>

        <View style={styles.divider} />

        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => navigation.navigate('Settings')}
        >
          <View style={styles.menuLeft}>
            <Text style={styles.menuIcon}>⚙️</Text>
            <View>
              <Text style={styles.menuItemText}>设置</Text>
              <Text style={styles.menuItemSub}>API Key / 主题 / 数据源</Text>
            </View>
          </View>
          <Text style={styles.menuArrow}>→</Text>
        </TouchableOpacity>

        <View style={styles.divider} />

        <TouchableOpacity style={styles.menuItem} onPress={() => {}}>
          <View style={styles.menuLeft}>
            <Text style={styles.menuIcon}>ℹ️</Text>
            <View>
              <Text style={styles.menuItemText}>关于/反馈</Text>
              <Text style={styles.menuItemSub}>版本信息与反馈渠道</Text>
            </View>
          </View>
          <Text style={styles.menuArrow}>→</Text>
        </TouchableOpacity>

        {/* 版本号 */}
        <Text style={styles.version}>版本号: v1.0.0</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F2F2F7' },
  content: { padding: 16, paddingBottom: 32 },
  
  // Header
  headerBar: {
    paddingHorizontal: 16, paddingVertical: 14,
    backgroundColor: '#F8F9FA',
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E5E5EA',
  },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#3C3C43' },

  // Menu
  menuItem: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#FFF', borderRadius: 12, padding: 16, elevation: 1,
  },
  menuLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  menuIcon: { fontSize: 22, marginRight: 14 },
  menuItemText: { fontSize: 16, fontWeight: '500' },
  menuItemSub: { fontSize: 12, color: '#8E8E93', marginTop: 2 },
  menuArrow: { color: '#C7C7CC', fontSize: 18 },

  divider: { height: 1, backgroundColor: '#E5E5EA', marginVertical: 12 },

  // Version
  version: { fontSize: 13, color: '#C7C7CC', textAlign: 'center', marginTop: 24 },
});