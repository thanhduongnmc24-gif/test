import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const SUPABASE_URL = 'https://ykwdxgjzmiduayedykhv.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlrd2R4Z2p6bWlkdWF5ZWR5a2h2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAzMTY4NTUsImV4cCI6MjA4NTg5Mjg1NX0.aw2F-uW4Ei6r68tMcXBD2S46DnTxAo7j07SYYNjJGPM';

// Tèo đã sửa lại kiểu trả về cho đúng chuẩn TypeScript
const ExpoSecureStoreAdapter = {
  getItem: (key: string) => {
    if (Platform.OS === 'web' && typeof window === 'undefined') {
        return Promise.resolve(null); // getItem trả về null là đúng
    }
    return AsyncStorage.getItem(key);
  },
  setItem: (key: string, value: string) => {
    if (Platform.OS === 'web' && typeof window === 'undefined') {
        return Promise.resolve(); // [SỬA LỖI] Trả về void (không có null)
    }
    return AsyncStorage.setItem(key, value);
  },
  removeItem: (key: string) => {
    if (Platform.OS === 'web' && typeof window === 'undefined') {
        return Promise.resolve(); // [SỬA LỖI] Trả về void (không có null)
    }
    return AsyncStorage.removeItem(key);
  },
};

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: ExpoSecureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});