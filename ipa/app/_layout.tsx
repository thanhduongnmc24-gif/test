import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, AppState } from 'react-native';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from './context/ThemeContext'; 
import * as LocalAuthentication from 'expo-local-authentication';

// Component Màn hình khóa
const LockScreen = ({ onUnlock }: { onUnlock: () => void }) => {
  const [status, setStatus] = useState('Bấm để mở khóa');

  const authenticate = async () => {
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      if (!hasHardware) {
        onUnlock(); // Không có phần cứng thì cho qua luôn
        return;
      }

      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      if (!isEnrolled) {
        onUnlock(); // Chưa cài FaceID/TouchID thì cho qua
        return;
      }

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Xác thực để vào Ghi chú',
        fallbackLabel: 'Dùng mật khẩu điện thoại',
        disableDeviceFallback: false,
      });

      if (result.success) {
        onUnlock();
      } else {
        setStatus('Thử lại');
      }
    } catch (e) {
      setStatus('Lỗi xác thực');
    }
  };

  useEffect(() => {
    authenticate(); // Tự động quét khi hiện màn hình
  }, []);

  return (
    <View style={styles.lockContainer}>
      <Ionicons name="lock-closed" size={64} color="#6366F1" />
      <Text style={styles.lockText}>Ứng dụng đã khóa</Text>
      <TouchableOpacity onPress={authenticate} style={styles.unlockBtn}>
        <Text style={styles.unlockText}>{status}</Text>
      </TouchableOpacity>
    </View>
  );
};

export default function TabLayout() {
  const { colors } = useTheme();
  const [isLocked, setIsLocked] = useState(true); // Mặc định là KHÓA

  // Tự động khóa khi thoát app
  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (nextAppState === 'background') {
        setIsLocked(true); // Ra ngoài là khóa ngay
      }
    });
    return () => subscription.remove();
  }, []);

  if (isLocked) {
    return <LockScreen onUnlock={() => setIsLocked(false)} />;
  }

  return (
    <Tabs screenOptions={{ 
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.tabInactive,
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          elevation: 0,
          height: Platform.OS === 'ios' ? 85 : 65,
          paddingBottom: Platform.OS === 'ios' ? 25 : 10,
          paddingTop: 10,
        },
        tabBarLabelStyle: { fontWeight: '600', fontSize: 10 }
      }}>
      <Tabs.Screen name="index" options={{ title: 'Lịch', tabBarIcon: ({ color }) => <Ionicons name="calendar" size={24} color={color} /> }} />
      <Tabs.Screen name="notes" options={{ title: 'Ghi chú', tabBarIcon: ({ color }) => <Ionicons name="document-text" size={24} color={color} /> }} />
      <Tabs.Screen name="media" options={{ title: 'Media', tabBarIcon: ({ color }) => <Ionicons name="images" size={24} color={color} /> }} />
      <Tabs.Screen name="reminders" options={{ title: 'Nhắc nhở', tabBarIcon: ({ color }) => <Ionicons name="alarm" size={24} color={color} /> }} />
      <Tabs.Screen name="settings" options={{ title: 'Cài đặt', tabBarIcon: ({ color }) => <Ionicons name="settings" size={24} color={color} /> }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  lockContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0f172a' },
  lockText: { color: 'white', fontSize: 20, fontWeight: 'bold', marginTop: 20 },
  unlockBtn: { marginTop: 30, paddingVertical: 12, paddingHorizontal: 30, backgroundColor: '#6366F1', borderRadius: 25 },
  unlockText: { color: 'white', fontWeight: 'bold', fontSize: 16 }
});