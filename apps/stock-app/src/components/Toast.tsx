import React, { useEffect, useRef, useState } from 'react';
import {
  Animated, Text, StyleSheet, View,
} from 'react-native';

interface ToastMessage {
  text: string;
  type?: 'error' | 'success' | 'info';
}

let showToastFn: ((msg: ToastMessage) => void) | null = null;

export function showToast(text: string, type?: 'error' | 'success' | 'info') {
  showToastFn?.({ text, type: type ?? 'error' });
}

export default function ToastProvider() {
  const [message, setMessage] = useState<ToastMessage | null>(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    showToastFn = (msg) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      setMessage(msg);
      Animated.timing(opacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
      timerRef.current = setTimeout(() => {
        Animated.timing(opacity, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }).start(() => setMessage(null));
      }, 3000);
    };
    return () => {
      showToastFn = null;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  if (!message) return null;

  const bgColor = message.type === 'error' ? '#FF3B30'
    : message.type === 'success' ? '#34C759'
    : '#007AFF';

  return (
    <Animated.View style={[styles.container, { opacity, backgroundColor: bgColor }]}>
      <Text style={styles.text}>{message.text}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 100,
    left: 20,
    right: 20,
    borderRadius: 8,
    padding: 14,
    zIndex: 9999,
    elevation: 10,
    alignItems: 'center',
  },
  text: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
});