import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, Text, View, TouchableOpacity, Switch, ScrollView, Alert, ActivityIndicator, TextInput 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useTab } from '../context/TabContext'; // [ĐÃ SỬA] Import đúng hook useTab
import { supabase } from '../supabaseConfig';
import { useRouter } from 'expo-router';

export default function SettingsScreen() {
  const { colors, toggleTheme, theme } = useTheme();
  const { tabState, toggleTab } = useTab(); // [ĐÃ SỬA] Dùng tabState thay vì visibleTabs
  const router = useRouter();

  // --- STATE ---
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  
  // State cho Login/Register
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoginMode, setIsLoginMode] = useState(true);

  // --- EFFECT ---
  useEffect(() => {
    // Kiểm tra đăng nhập
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  // --- AUTH HANDLERS ---
  const handleAuth = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Lỗi', 'Vui lòng nhập đầy đủ Email và Mật khẩu');
      return;
    }

    setLoading(true);
    try {
      if (isLoginMode) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        // Alert.alert('Thành công', 'Đăng nhập ngon lành!');
      } else {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        Alert.alert('Thành công', 'Đã tạo tài khoản! Hãy kiểm tra email để xác nhận.');
        setIsLoginMode(true);
      }
    } catch (error: any) {
      Alert.alert('Lỗi', error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) Alert.alert('Lỗi', error.message);
  };

  // --- RENDER ---
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: 20 }}>
        
        <Text style={[styles.headerTitle, { color: colors.text }]}>Cài Đặt ⚙️</Text>

        {/* 1. TÀI KHOẢN */}
        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.primary }]}>
             {session ? '👤 Tài khoản' : '🔐 Đăng nhập / Đăng ký'}
          </Text>
          
          {session ? (
            <View>
              <View style={{flexDirection:'row', alignItems:'center', marginBottom: 15}}>
                 <View style={{width: 50, height: 50, borderRadius: 25, backgroundColor: colors.iconBg, justifyContent:'center', alignItems:'center', marginRight: 15}}>
                    <Text style={{fontSize: 24}}>😎</Text>
                 </View>
                 <View>
                    <Text style={{color: colors.text, fontWeight:'bold', fontSize: 16}}>{session.user.email}</Text>
                    <Text style={{color: colors.success, fontSize: 12}}>● Đang hoạt động</Text>
                 </View>
              </View>
              
              <TouchableOpacity style={[styles.button, { backgroundColor: colors.error }]} onPress={handleLogout}>
                <Ionicons name="log-out-outline" size={20} color="white" style={{marginRight: 8}}/>
                <Text style={styles.buttonText}>Đăng xuất</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View>
              <TextInput 
                style={[styles.input, { color: colors.text, backgroundColor: colors.inputBg, borderColor: colors.border }]}
                placeholder="Email..." placeholderTextColor={colors.subText}
                value={email} onChangeText={setEmail} autoCapitalize="none"
              />
              <TextInput 
                style={[styles.input, { color: colors.text, backgroundColor: colors.inputBg, borderColor: colors.border }]}
                placeholder="Mật khẩu..." placeholderTextColor={colors.subText}
                value={password} onChangeText={setPassword} secureTextEntry
              />
              
              <TouchableOpacity style={[styles.button, { backgroundColor: colors.primary }]} onPress={handleAuth} disabled={loading}>
                 {loading ? <ActivityIndicator color="white"/> : <Text style={styles.buttonText}>{isLoginMode ? 'Đăng Nhập' : 'Đăng Ký'}</Text>}
              </TouchableOpacity>

              <TouchableOpacity onPress={() => setIsLoginMode(!isLoginMode)} style={{marginTop: 15, alignItems:'center'}}>
                 <Text style={{color: colors.subText}}>
                    {isLoginMode ? 'Chưa có tài khoản? ' : 'Đã có tài khoản? '}
                    <Text style={{color: colors.primary, fontWeight:'bold'}}>{isLoginMode ? 'Đăng ký ngay' : 'Đăng nhập'}</Text>
                 </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* 2. QUẢN LÝ TAB */}
        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.primary }]}>📱 Quản lý Tab</Text>
          <Text style={{color: colors.subText, fontSize: 12, marginBottom: 10}}>Bật/Tắt các tab bạn muốn hiển thị:</Text>
          
          <View style={styles.row}>
            <Text style={{ color: colors.text }}>📅 Lịch chấm công</Text>
            {/* [ĐÃ SỬA] Key 'calendar' tương ứng với tab Index */}
            <Switch value={tabState?.calendar} onValueChange={() => toggleTab('calendar')} trackColor={{false: "#767577", true: colors.primary}} thumbColor={"#f4f3f4"} />
          </View>
          <View style={[styles.divider, {backgroundColor: colors.border}]} />

          <View style={styles.row}>
            <Text style={{ color: colors.text }}>📝 Ghi chú</Text>
            <Switch value={tabState?.notes} onValueChange={() => toggleTab('notes')} trackColor={{false: "#767577", true: colors.primary}} thumbColor={"#f4f3f4"} />
          </View>
          <View style={[styles.divider, {backgroundColor: colors.border}]} />

          <View style={styles.row}>
            <Text style={{ color: colors.text }}>📊 Google Sheets</Text>
            <Switch value={tabState?.sheets} onValueChange={() => toggleTab('sheets')} trackColor={{false: "#767577", true: colors.primary}} thumbColor={"#f4f3f4"} />
          </View>
          <View style={[styles.divider, {backgroundColor: colors.border}]} />
          
          <View style={styles.row}>
            <Text style={{ color: colors.text }}>🎬 Media AI</Text>
            <Switch value={tabState?.media} onValueChange={() => toggleTab('media')} trackColor={{false: "#767577", true: colors.primary}} thumbColor={"#f4f3f4"} />
          </View>
          <View style={[styles.divider, {backgroundColor: colors.border}]} />
          
          <View style={styles.row}>
            <Text style={{ color: colors.text }}>⏰ Nhắc nhở</Text>
            <Switch value={tabState?.reminders} onValueChange={() => toggleTab('reminders')} trackColor={{false: "#767577", true: colors.primary}} thumbColor={"#f4f3f4"} />
          </View>
        </View>

        {/* 3. GIAO DIỆN */}
        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.primary }]}>🎨 Giao diện</Text>
          <View style={styles.row}>
            <View style={{flexDirection:'row', alignItems:'center'}}>
                <Ionicons name={theme === 'dark' ? "moon" : "sunny"} size={20} color={colors.text} style={{marginRight: 10}}/>
                <Text style={{ color: colors.text }}>Chế độ tối (Dark Mode)</Text>
            </View>
            <Switch value={theme === 'dark'} onValueChange={toggleTheme} trackColor={{false: "#767577", true: colors.primary}} thumbColor={"#f4f3f4"} />
          </View>
        </View>

        <Text style={{textAlign:'center', color: colors.subText, marginTop: 20, fontSize: 12}}>
            Phiên bản 2.1 - Tèo AI Dev 🚀
        </Text>
        <View style={{height: 50}} />

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerTitle: { fontSize: 28, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
  section: { borderRadius: 16, padding: 15, marginBottom: 20, borderWidth: 1 },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 15, textTransform: 'uppercase' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 },
  divider: { height: 1, width: '100%', opacity: 0.5 },
  input: { borderWidth: 1, borderRadius: 10, padding: 12, marginBottom: 12, fontSize: 16 },
  button: { padding: 15, borderRadius: 12, alignItems: 'center', justifyContent:'center', flexDirection:'row' },
  buttonText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
});