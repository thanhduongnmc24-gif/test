import React, { useEffect, useRef, useState } from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Platform, AppState, View, Animated, Easing, Text } from 'react-native'; 
import * as Notifications from 'expo-notifications';
import * as Speech from 'expo-speech';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Import đúng đường dẫn
import { useTheme } from '../context/ThemeContext';
import { supabase } from '../supabaseConfig';

export default function TabLayout() {
  const { colors } = useTheme();
  const appState = useRef(AppState.currentState);

  // --- STATE ---
  // Chỉ giữ lại state đồng bộ, bỏ state khóa
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'success' | 'error' | 'downloading'>('idle');
  const spinValue = useRef(new Animated.Value(0)).current;

  // --- HIỆU ỨNG XOAY ---
  useEffect(() => {
    if (syncStatus === 'syncing' || syncStatus === 'downloading') {
      Animated.loop(Animated.timing(spinValue, { toValue: 1, duration: 1000, easing: Easing.linear, useNativeDriver: true })).start();
    } else {
      spinValue.setValue(0);
    }
  }, [syncStatus]);
  const spin = spinValue.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  // --- LOGIC SAO LƯU THÔNG MINH (Giữ nguyên) ---
  const performSmartSync = async (triggerType: 'background' | 'foreground') => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return; 

      // 1. Kiểm tra xem máy này đã từng Sync thành công lần nào chưa?
      const localLastSync = await AsyncStorage.getItem('LAST_SUCCESS_SYNC');
      console.log(`SmartSync (${triggerType}): Đang kiểm tra... LastSync: ${localLastSync}`);

      const { data: serverData } = await supabase
        .from('user_sync')
        .select('*')
        .eq('user_id', session.user.id)
        .single();

      // NẾU MÁY MỚI (Chưa sync bao giờ) VÀ SERVER CÓ DỮ LIỆU -> KHÔI PHỤC
      if (!localLastSync && serverData && serverData.backup_data) {
          console.log("⚠️ Máy mới & Server có dữ liệu -> TỰ ĐỘNG KHÔI PHỤC");
          setSyncStatus('downloading');

          const backup = serverData.backup_data;
          const pairs: [string, string][] = [];
          const keys = ['QUICK_NOTES', 'CALENDAR_NOTES', 'USER_REMINDERS', 'CYCLE_START_DATE', 'NOTIF_ENABLED', 'GEMINI_API_KEY'];
          keys.forEach(key => {
              if (backup[key] !== undefined && backup[key] !== null) {
                  const valStr = typeof backup[key] === 'string' ? backup[key] : JSON.stringify(backup[key]);
                  pairs.push([key, valStr]);
              }
          });

          if (pairs.length > 0) await AsyncStorage.multiSet(pairs);
          await AsyncStorage.setItem('LAST_SUCCESS_SYNC', new Date().toISOString());
          
          setSyncStatus('success');
          setTimeout(() => setSyncStatus('idle'), 3000);
          return;
      }

      // 3. SAO LƯU BÌNH THƯỜNG
      setSyncStatus('syncing');
      const keys = ['QUICK_NOTES', 'CALENDAR_NOTES', 'USER_REMINDERS', 'CYCLE_START_DATE', 'NOTIF_ENABLED', 'GEMINI_API_KEY'];
      const stores = await AsyncStorage.multiGet(keys);
      const dataToSave: any = {};
      stores.forEach((store) => {
         if (store[1]) {
             try { dataToSave[store[0]] = JSON.parse(store[1]); } catch { dataToSave[store[0]] = store[1]; }
         }
      });

      const { error: upsertError } = await supabase.from('user_sync').upsert({ 
          user_id: session.user.id, backup_data: dataToSave, updated_at: new Date() 
      });

      if (upsertError) throw upsertError;
      await AsyncStorage.setItem('LAST_SUCCESS_SYNC', new Date().toISOString());
      setSyncStatus('success');
      setTimeout(() => setSyncStatus('idle'), 3000);

    } catch (error) {
      console.log("SmartSync Error:", error);
      setSyncStatus('error');
      setTimeout(() => setSyncStatus('idle'), 5000);
    }
  };

  // --- INIT EFFECT ---
  useEffect(() => {
    // Chạy Sync ngay khi mở app
    performSmartSync('foreground'); 

    const subscription = AppState.addEventListener('change', nextAppState => {
      // Khi thoát app (xuống background) -> Chạy Sync
      if (appState.current.match(/active/) && nextAppState.match(/inactive|background/)) {
        performSmartSync('background'); 
      }
      appState.current = nextAppState;
    });

    const notifSub = Notifications.addNotificationResponseReceivedListener(response => {
      const content = response.notification.request.content;
      if (content.body) {
        Speech.stop(); 
        const cleanTitle = (content.title || '').replace(/🔔/g, '').trim();
        Speech.speak(`Nhắc nhở: ${cleanTitle}. ${content.body}`, { language: 'vi-VN', rate: 1.1 });
      }
    });

    return () => { subscription.remove(); notifSub.remove(); };
  }, []);

  return (
    <View style={{flex: 1, backgroundColor: colors.bg}}>
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

      {/* SYNC INDICATOR (Giữ lại để biết trạng thái sao lưu) */}
      {syncStatus !== 'idle' && (
        <View style={{
            position: 'absolute', top: Platform.OS === 'ios' ? 50 : 40, right: 15, flexDirection: 'row', alignItems: 'center',
            backgroundColor: colors.card, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 20, borderWidth: 1, borderColor: colors.border,
            shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 3.84, elevation: 5, zIndex: 10000 
        }}>
           {(syncStatus === 'syncing' || syncStatus === 'downloading') && (
             <Animated.View style={{ transform: [{ rotate: spin }] }}>
                <Ionicons name={syncStatus === 'downloading' ? "cloud-download" : "sync"} size={16} color={colors.primary} />
             </Animated.View>
           )}
           {syncStatus === 'success' && <Ionicons name="cloud-done" size={18} color="#22C55E" />}
           {syncStatus === 'error' && <Ionicons name="cloud-offline" size={18} color="#EF4444" />}
           
           <Text style={{ marginLeft: 8, fontSize: 11, fontWeight: 'bold', color: syncStatus === 'error' ? '#EF4444' : (syncStatus === 'success' ? '#22C55E' : colors.subText) }}>
             {syncStatus === 'syncing' ? 'Đang lưu...' : 
              syncStatus === 'downloading' ? 'Đang tải về...' :
              syncStatus === 'success' ? 'Đồng bộ xong' : 'Lỗi mạng'}
           </Text>
        </View>
      )}
    </View>
  );
}