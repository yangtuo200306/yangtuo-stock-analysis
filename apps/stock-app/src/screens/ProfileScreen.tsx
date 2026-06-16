import React from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTheme, spacing, borderRadius, fontSize } from '../theme';
import type { RootStackParamList } from '../types';

type NavProp = NativeStackNavigationProp<RootStackParamList>;

export default function ProfileScreen() {
  const navigation = useNavigation<NavProp>();
  const { theme } = useTheme();

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing['3xl'] }}>
        <TouchableOpacity
          style={[styles.menuCard, { backgroundColor: theme.card, borderColor: theme.border }]}
          onPress={() => navigation.navigate('History')}
        >
          <View style={styles.menuLeft}>
            <Text style={styles.menuIcon}>[H]</Text>
            <View style={styles.menuText}>
              <Text style={[styles.menuTitle, { color: theme.text }]}>历史分析记录</Text>
              <Text style={[styles.menuSub, { color: theme.textMuted }]}>查看所有分析报告</Text>
            </View>
          </View>
          <Text style={[styles.chevron, { color: theme.textMuted }]}>›</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.menuCard, { backgroundColor: theme.card, borderColor: theme.border, marginTop: spacing.md }]}
          onPress={() => navigation.navigate('Settings')}
        >
          <View style={styles.menuLeft}>
            <Text style={styles.menuIcon}>[S]</Text>
            <View style={styles.menuText}>
              <Text style={[styles.menuTitle, { color: theme.text }]}>设置</Text>
              <Text style={[styles.menuSub, { color: theme.textMuted }]}>服务器、手机后端与账号</Text>
            </View>
          </View>
          <Text style={[styles.chevron, { color: theme.textMuted }]}>›</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.menuCard, { backgroundColor: theme.card, borderColor: theme.border, marginTop: spacing.md }]}
          onPress={() => navigation.navigate('AboutFeedback')}
        >
          <View style={styles.menuLeft}>
            <Text style={styles.menuIcon}>[i]</Text>
            <View style={styles.menuText}>
              <Text style={[styles.menuTitle, { color: theme.text }]}>关于与反馈</Text>
              <Text style={[styles.menuSub, { color: theme.textMuted }]}>版本信息、问题反馈</Text>
            </View>
          </View>
          <Text style={[styles.chevron, { color: theme.textMuted }]}>›</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  menuCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    padding: spacing.lg,
  },
  menuLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    minWidth: 0,
  },
  menuIcon: {
    width: 28,
    marginRight: spacing.md,
    fontSize: fontSize.sm,
    fontWeight: '700',
    textAlign: 'center',
  },
  menuText: {
    flex: 1,
    minWidth: 0,
  },
  menuTitle: {
    fontSize: fontSize.lg,
    fontWeight: '500',
  },
  menuSub: {
    fontSize: fontSize.sm,
    marginTop: 2,
  },
  chevron: {
    fontSize: 22,
    marginLeft: spacing.sm,
  },
});
