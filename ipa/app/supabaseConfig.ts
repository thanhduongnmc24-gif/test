import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Hai cái này lát Tèo chỉ đại ca lấy trên web Supabase nhé
const SUPABASE_URL = 'https://mrgsyxgucwochzhbzbrt.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1yZ3N5eGd1Y3dvY2h6aGJ6YnJ0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQyMjk3MTUsImV4cCI6MjA3OTgwNTcxNX0.nPuAqdbjXoZ-upuU_LQrv6IVNR_2NMeioquRap-BYcE';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage, // Tự động lưu phiên đăng nhập vào máy
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});