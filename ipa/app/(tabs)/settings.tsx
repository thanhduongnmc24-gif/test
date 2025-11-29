import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, Text, View, TouchableOpacity, Alert, Platform, Switch, Modal, ScrollView, TextInput, ActivityIndicator, KeyboardAvoidingView, TouchableWithoutFeedback, Keyboard
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker from '@react-native-community/datetimepicker';
import { format } from 'date-fns';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';

// [QUAN TRỌNG] Đường dẫn import Supabase (Lùi ra 2 cấp thư mục)
import { supabase } from '../supabaseConfig'; 

export default function SettingsScreen() {
  const { theme, toggleTheme, colors } = useTheme();
  
  // --- STATE CÀI ĐẶT CŨ ---
  const [startDate, setStartDate] = useState(new Date());
  const [isNotifEnabled, setIsNotifEnabled] = useState(false);
  const [timeDay, setTimeDay] = useState(new Date(new Date().setHours(6, 0, 0, 0)));
  const [timeNight, setTimeNight] = useState(new Date(new Date().setHours(18, 0, 0, 0)));
  const [timeOff, setTimeOff] = useState(new Date(new Date().setHours(8, 0, 0, 0)));
  const [timeNormal, setTimeNormal] = useState(new Date(new Date().setHours(7, 0, 0, 0)));
  const [pickerMode, setPickerMode] = useState<'none' | 'date' | 'timeDay' | 'timeNight' | 'timeOff' | 'timeNormal'>('none');
  const [tempDate, setTempDate] = useState(new Date());

  // --- STATE AUTH & SYNC (SUPABASE) ---
  const [user, setUser] = useState<any>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');

  useEffect(() => {
    loadSettings();
    checkUser();
  }, []);

  const checkUser = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    setUser(session?.user || null);

    supabase.auth.onAuthStateChange((_event: any, session: any) => {
      setUser(session?.user || null);
      if (session?.user) setShowAuthModal(false);
    });
  };

  const loadSettings = async () => {
    try {
      const savedDate = await AsyncStorage.getItem('CYCLE_START_DATE');
      if (savedDate) setStartDate(new Date(savedDate));
      const savedEnabled = await AsyncStorage.getItem('NOTIF_ENABLED');
      if (savedEnabled) setIsNotifEnabled(JSON.parse(savedEnabled));
      const tDay = await AsyncStorage.getItem('TIME_DAY'); if (tDay) setTimeDay(new Date(tDay));
      const tNight = await AsyncStorage.getItem('TIME_NIGHT'); if (tNight) setTimeNight(new Date(tNight));
      const tOff = await AsyncStorage.getItem('TIME_OFF'); if (tOff) setTimeOff(new Date(tOff));
      const tNormal = await AsyncStorage.getItem('TIME_NORMAL'); if (tNormal) setTimeNormal(new Date(tNormal));
    } catch (e) { console.error('Lỗi load settings:', e); }
  };

  const saveSettingItem = async (key: string, value: string) => {
      try { await AsyncStorage.setItem(key, value); } catch (e) { console.error(e); }
  };
  
  const toggleSwitch = async () => {
      const newState = !isNotifEnabled;
      setIsNotifEnabled(newState);
      await saveSettingItem('NOTIF_ENABLED', JSON.stringify(newState));
  };

  // --- CÁC HÀM XỬ LÝ AUTH ---

  const handleAuth = async () => {
    if (!email || !password) { Alert.alert("Thiếu thông tin", "Nhập email và mật khẩu đi đại ca!"); return; }
    
    try {
      if (authMode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        Alert.alert("Thành công", "Đã đăng nhập!");
      } else {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        Alert.alert("Thành công", "Đã tạo tài khoản! (Nhớ tắt xác thực Email trong Supabase nếu không muốn chờ)");
      }
    } catch (error: any) {
      Alert.alert("Lỗi", error.message);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setEmail(''); setPassword('');
  };

  // --- CÁC HÀM XỬ LÝ SYNC (ĐÃ FIX CRASH) ---

  // Sao lưu lên đám mây (Upload)
  const handleBackup = async () => {
    if (!user) return;
    setIsSyncing(true);
    try {
      // 1. Gom tất cả dữ liệu local
      const keys = ['QUICK_NOTES', 'CALENDAR_NOTES', 'USER_REMINDERS', 'CYCLE_START_DATE', 'NOTIF_ENABLED', 'GEMINI_API_KEY'];
      const stores = await AsyncStorage.multiGet(keys);
      
      const dataToSave: any = {};
      stores.forEach((store) => {
         if (store[1]) {
             // Cố gắng parse ra JSON để lưu trên Supabase nhìn cho đẹp (JSONB)
             try {
                dataToSave[store[0]] = JSON.parse(store[1]);
             } catch {
                dataToSave[store[0]] = store[1];
             }
         }
      });

      console.log("Dữ liệu chuẩn bị tải lên:", dataToSave);

      // 2. Đẩy lên Supabase
      const { error } = await supabase
        .from('user_sync')
        .upsert({ 
            user_id: user.id, 
            backup_data: dataToSave,
            updated_at: new Date()
        });

      if (error) throw error;
      Alert.alert("Đồng bộ xong!", "Dữ liệu đã được lưu an toàn trên Supabase ⚡️");
    } catch (error: any) {
      Alert.alert("Lỗi sao lưu", error.message);
      console.log("Backup Error:", error);
    } finally {
      setIsSyncing(false);
    }
  };

  // Khôi phục về máy (Download) - ĐÃ GIA CỐ CHỐNG CRASH
  const handleRestore = async () => {
    if (!user) return;
    setIsSyncing(true);
    try {
      console.log("Bắt đầu tải dữ liệu...");
      
      const { data, error } = await supabase
        .from('user_sync')
        .select('backup_data')
        .eq('user_id', user.id)
        .single();

      if (error) throw error;

      if (data && data.backup_data) {
        console.log("Dữ liệu thô từ Supabase:", data.backup_data);
        
        const backup = data.backup_data;
        const pairs: [string, string][] = [];
        const keys = ['QUICK_NOTES', 'CALENDAR_NOTES', 'USER_REMINDERS', 'CYCLE_START_DATE', 'NOTIF_ENABLED', 'GEMINI_API_KEY'];
        
        keys.forEach(key => {
            if (backup[key] !== undefined && backup[key] !== null) {
                // [FIX CRASH QUAN TRỌNG] Ép kiểu cực mạnh về String
                let valStr = '';
                
                if (typeof backup[key] === 'string') {
                    // Nếu nó đã là string (ví dụ ngày tháng '2025-01-01'), giữ nguyên
                    valStr = backup[key];
                } else {
                    // Nếu là Object, Array, Number, Boolean (true/false) -> Stringify hết!
                    // AsyncStorage chỉ ăn String, đưa Boolean vào là sập App.
                    valStr = JSON.stringify(backup[key]);
                }

                // Log kiểm tra từng dòng
                // console.log(`Key: ${key} -> Value: ${valStr}`); 
                pairs.push([key, valStr]);
            }
        });

        if (pairs.length > 0) {
            await AsyncStorage.multiSet(pairs);
            loadSettings(); // Reload lại giao diện ngay lập tức
            Alert.alert("Thành công", "Đã khôi phục dữ liệu về máy! Anh hai kiểm tra lại các tab nhé.");
        } else {
            Alert.alert("Thông báo", "Trên mây không có dữ liệu nào của các mục này.");
        }
      } else {
        Alert.alert("Trống", "Tài khoản này chưa có bản sao lưu nào.");
      }
    } catch (error: any) {
      Alert.alert("Lỗi khôi phục", "Không tải được hoặc dữ liệu lỗi.");
      console.log("Restore Error:", error);
    } finally {
      setIsSyncing(false);
    }
  };

  // --- LOGIC PICKER (GIỮ NGUYÊN) ---
  const openPicker = (mode: typeof pickerMode) => {
    setPickerMode(mode);
    if (mode === 'date') setTempDate(startDate);
    if (mode === 'timeDay') setTempDate(timeDay);
    if (mode === 'timeNight') setTempDate(timeNight);
    if (mode === 'timeOff') setTempDate(timeOff);
    if (mode === 'timeNormal') setTempDate(timeNormal);
  };

  const confirmPicker = () => {
    if (pickerMode === 'date') { setStartDate(tempDate); saveSettingItem('CYCLE_START_DATE', tempDate.toISOString()); }
    if (pickerMode === 'timeDay') { setTimeDay(tempDate); saveSettingItem('TIME_DAY', tempDate.toISOString()); }
    if (pickerMode === 'timeNight') { setTimeNight(tempDate); saveSettingItem('TIME_NIGHT', tempDate.toISOString()); }
    if (pickerMode === 'timeOff') { setTimeOff(tempDate); saveSettingItem('TIME_OFF', tempDate.toISOString()); }
    if (pickerMode === 'timeNormal') { setTimeNormal(tempDate); saveSettingItem('TIME_NORMAL', tempDate.toISOString()); }
    setPickerMode('none');
  };

  const onPickerChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setPickerMode('none');
      if (selectedDate) {
        if (pickerMode === 'date') { setStartDate(selectedDate); saveSettingItem('CYCLE_START_DATE', selectedDate.toISOString()); }
        if (pickerMode === 'timeDay') { setTimeDay(selectedDate); saveSettingItem('TIME_DAY', selectedDate.toISOString()); }
        if (pickerMode === 'timeNight') { setTimeNight(selectedDate); saveSettingItem('TIME_NIGHT', selectedDate.toISOString()); }
        if (pickerMode === 'timeOff') { setTimeOff(selectedDate); saveSettingItem('TIME_OFF', selectedDate.toISOString()); }
        if (pickerMode === 'timeNormal') { setTimeNormal(selectedDate); saveSettingItem('TIME_NORMAL', selectedDate.toISOString()); }
      }
    } else {
      if (selectedDate) setTempDate(selectedDate);
    }
  };

  const dynamicStyles = {
    container: { flex: 1, backgroundColor: colors.bg },
    headerTitle: { fontSize: 24, fontWeight: 'bold' as const, color: colors.text },
    sectionTitle: { fontSize: 14, fontWeight: 'bold' as const, color: colors.subText, marginBottom: 10, marginTop: 20, textTransform: 'uppercase' as const },
    card: { backgroundColor: colors.card, borderRadius: 16, padding: 5, borderWidth: 1, borderColor: colors.border },
    text: { color: colors.text },
    subText: { color: colors.subText },
    iconBox: { width: 36, height: 36, borderRadius: 10, backgroundColor: colors.iconBg, justifyContent: 'center' as const, alignItems: 'center' as const },
    separator: { height: 1, backgroundColor: colors.border, marginLeft: 65 },
    
    // Auth Styles
    authBtn: { backgroundColor: colors.primary, padding: 12, borderRadius: 10, alignItems: 'center' as const, marginTop: 10 },
    authInput: { backgroundColor: colors.iconBg, color: colors.text, padding: 12, borderRadius: 10, marginBottom: 10, borderWidth: 1, borderColor: colors.border },
    syncBtn: { flexDirection: 'row' as const, alignItems: 'center' as const, padding: 15, borderBottomWidth: 1, borderBottomColor: colors.border },
    
    // Modal Styles
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' as const },
    pickerContainer: { backgroundColor: colors.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 30, borderWidth: 1, borderColor: colors.border },
    pickerHeader: { flexDirection: 'row' as const, justifyContent: 'space-between' as const, padding: 15, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.iconBg, borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  };

  return (
    <SafeAreaView style={dynamicStyles.container} edges={['top']}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={{padding: 20, alignItems:'center'}}>
          <Text style={dynamicStyles.headerTitle}>Cài Đặt</Text>
        </View>

        <View style={{paddingHorizontal: 20}}>
          
          <Text style={dynamicStyles.sectionTitle}>☁️ TÀI KHOẢN & ĐỒNG BỘ</Text>
          <View style={[dynamicStyles.card, {padding: 0, overflow: 'hidden'}]}>
             {!user ? (
               <View style={{padding: 20, alignItems: 'center'}}>
                 <Text style={{color: colors.subText, marginBottom: 15, textAlign: 'center'}}>
                   Đăng nhập để sao lưu dữ liệu.
                 </Text>
                 <TouchableOpacity style={{backgroundColor: colors.primary, paddingHorizontal: 30, paddingVertical: 12, borderRadius: 20}} onPress={() => setShowAuthModal(true)}>
                    <Text style={{color: 'white', fontWeight: 'bold'}}>Đăng nhập / Đăng ký</Text>
                 </TouchableOpacity>
               </View>
             ) : (
               <View>
                 <View style={{padding: 15, backgroundColor: colors.iconBg, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'}}>
                    <View style={{flexDirection: 'row', alignItems: 'center', flex: 1}}>
                      <Ionicons name="person-circle" size={40} color={colors.primary} />
                      <View style={{marginLeft: 10, flex: 1}}>
                        <Text numberOfLines={1} style={{color: colors.text, fontWeight: 'bold'}}>{user.email}</Text>
                        <Text style={{color: colors.success, fontSize: 12}}>● Đang hoạt động</Text>
                      </View>
                    </View>
                    <TouchableOpacity onPress={handleLogout}><Ionicons name="log-out-outline" size={24} color="#EF4444" /></TouchableOpacity>
                 </View>

                 <TouchableOpacity style={dynamicStyles.syncBtn} onPress={handleBackup} disabled={isSyncing}>
                    <View style={[dynamicStyles.iconBox, {backgroundColor: '#DBEAFE'}]}><Ionicons name="cloud-upload" size={20} color="#2563EB" /></View>
                    <View style={{marginLeft: 15, flex: 1}}>
                       <Text style={[dynamicStyles.text, {fontWeight: 'bold'}]}>Sao lưu ngay</Text>
                       <Text style={{fontSize: 12, color: colors.subText}}>Đẩy dữ liệu lên mây</Text>
                    </View>
                    {isSyncing ? <ActivityIndicator size="small" color={colors.primary}/> : <Ionicons name="chevron-forward" size={20} color={colors.subText} />}
                 </TouchableOpacity>

                 <TouchableOpacity style={[dynamicStyles.syncBtn, {borderBottomWidth: 0}]} onPress={handleRestore} disabled={isSyncing}>
                    <View style={[dynamicStyles.iconBox, {backgroundColor: '#DCFCE7'}]}><Ionicons name="cloud-download" size={20} color="#16A34A" /></View>
                    <View style={{marginLeft: 15, flex: 1}}>
                       <Text style={[dynamicStyles.text, {fontWeight: 'bold'}]}>Khôi phục dữ liệu</Text>
                       <Text style={{fontSize: 12, color: colors.subText}}>Tải dữ liệu về máy</Text>
                    </View>
                    {isSyncing ? <ActivityIndicator size="small" color={colors.primary}/> : <Ionicons name="chevron-forward" size={20} color={colors.subText} />}
                 </TouchableOpacity>
               </View>
             )}
          </View>

          {/* CÁC PHẦN CÀI ĐẶT KHÁC (GIỮ NGUYÊN) */}
          <Text style={dynamicStyles.sectionTitle}>🎨 GIAO DIỆN</Text>
          <View style={dynamicStyles.card}>
            <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 15}}>
              <View style={{flexDirection: 'row', alignItems: 'center'}}>
                <View style={dynamicStyles.iconBox}><Ionicons name={theme === 'dark' ? "moon" : "sunny"} size={20} color={theme === 'dark' ? "#FDB813" : "#F59E0B"} /></View>
                <Text style={[dynamicStyles.text, {marginLeft: 15, fontSize: 16, fontWeight: '500'}]}>{theme === 'dark' ? 'Chế độ Tối' : 'Chế độ Sáng'}</Text>
              </View>
              <Switch value={theme === 'dark'} onValueChange={toggleTheme} trackColor={{ false: "#E5E7EB", true: colors.primary }} thumbColor={"#fff"} />
            </View>
          </View>
        
          <Text style={dynamicStyles.sectionTitle}>📅 CHU KỲ LÀM VIỆC</Text>
          <View style={dynamicStyles.card}>
            <Text style={{fontSize: 15, padding: 15, color: colors.subText}}>Ngày bắt đầu <Text style={{fontWeight: 'bold', color: colors.primary}}>CA NGÀY</Text> đầu tiên:</Text>
            <TouchableOpacity style={{flexDirection: 'row', alignItems: 'center', padding: 15}} onPress={() => openPicker('date')}>
              <View style={dynamicStyles.iconBox}><Ionicons name="calendar" size={20} color={colors.primary} /></View>
              <Text style={{flex: 1, fontSize: 16, marginLeft: 15, color: colors.text}}>{format(startDate, 'dd/MM/yyyy')}</Text>
              <Ionicons name="chevron-forward" size={20} color={colors.subText} />
            </TouchableOpacity>
          </View>

          <Text style={dynamicStyles.sectionTitle}>🔔 CẤU HÌNH THÔNG BÁO</Text>
          <View style={dynamicStyles.card}>
            <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 15}}>
              <Text style={{fontSize: 15, padding: 0, fontWeight:'bold', color: colors.subText}}>Bật thông báo nhắc nhở:</Text>
              <Switch value={isNotifEnabled} onValueChange={toggleSwitch} trackColor={{ false: "#E5E7EB", true: colors.primary }} thumbColor={"#fff"} />
            </View>
            
            {isNotifEnabled && (
              <>
                <View style={dynamicStyles.separator} />
                <TouchableOpacity style={{flexDirection: 'row', alignItems: 'center', padding: 15}} onPress={() => openPicker('timeDay')}>
                  <View style={dynamicStyles.iconBox}><Ionicons name="sunny" size={20} color="#FDB813" /></View>
                  <Text style={{flex: 1, fontSize: 16, marginLeft: 15, color: colors.text}}>Giờ nhắc Ca Ngày</Text>
                  <Text style={{fontSize: 16, fontWeight: 'bold', marginRight: 5, color: colors.primary}}>{format(timeDay, 'HH:mm')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={{flexDirection: 'row', alignItems: 'center', padding: 15}} onPress={() => openPicker('timeNight')}>
                  <View style={dynamicStyles.iconBox}><Ionicons name="moon" size={20} color="#60A5FA" /></View>
                  <Text style={{flex: 1, fontSize: 16, marginLeft: 15, color: colors.text}}>Giờ nhắc Ca Đêm</Text>
                  <Text style={{fontSize: 16, fontWeight: 'bold', marginRight: 5, color: colors.primary}}>{format(timeNight, 'HH:mm')}</Text>
                </TouchableOpacity>
                 <TouchableOpacity style={{flexDirection: 'row', alignItems: 'center', padding: 15}} onPress={() => openPicker('timeOff')}>
                  <View style={dynamicStyles.iconBox}><Ionicons name="cafe" size={20} color="#10B981" /></View>
                  <Text style={{flex: 1, fontSize: 16, marginLeft: 15, color: colors.text}}>Giờ nhắc Ngày Nghỉ</Text>
                  <Text style={{fontSize: 16, fontWeight: 'bold', marginRight: 5, color: colors.primary}}>{format(timeOff, 'HH:mm')}</Text>
                </TouchableOpacity>
                <View style={dynamicStyles.separator} />
                <TouchableOpacity style={{flexDirection: 'row', alignItems: 'center', padding: 15}} onPress={() => openPicker('timeNormal')}>
                  <View style={dynamicStyles.iconBox}><Ionicons name="notifications" size={20} color={colors.subText} /></View>
                  <Text style={{flex: 1, fontSize: 16, marginLeft: 15, color: colors.text}}>Giờ nhắc Mặc định</Text>
                  <Text style={{fontSize: 16, fontWeight: 'bold', marginRight: 5, color: colors.primary}}>{format(timeNormal, 'HH:mm')}</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </ScrollView>

      {/* MODAL PICKER NGÀY GIỜ */}
      <Modal transparent={true} visible={pickerMode !== 'none'} animationType="slide">
        <View style={dynamicStyles.modalOverlay}>
          <View style={dynamicStyles.pickerContainer}>
            <View style={dynamicStyles.pickerHeader}>
              <TouchableOpacity onPress={() => setPickerMode('none')}><Text style={{color: '#EF4444', fontSize: 16}}>Hủy</Text></TouchableOpacity>
              <Text style={{fontWeight: 'bold', fontSize: 16, color: colors.text}}>{pickerMode === 'date' ? 'Chọn Ngày' : 'Chọn Giờ'}</Text>
              <TouchableOpacity onPress={confirmPicker}><Text style={{color: colors.primary, fontWeight: 'bold', fontSize: 16}}>Xong</Text></TouchableOpacity>
            </View>
            <DateTimePicker
              value={tempDate}
              mode={pickerMode === 'date' ? 'date' : 'time'}
              display="spinner"
              onChange={onPickerChange}
              locale="vi-VN"
              is24Hour={true}
              themeVariant={theme} 
              textColor={colors.text}
            />
          </View>
        </View>
      </Modal>

      {/* MODAL ĐĂNG NHẬP / ĐĂNG KÝ (Có KeyboardAvoidingView) */}
      <Modal transparent={true} visible={showAuthModal} animationType="slide">
        <TouchableWithoutFeedback onPress={() => setShowAuthModal(false)}>
           <KeyboardAvoidingView 
             behavior={Platform.OS === "ios" ? "padding" : "height"} 
             style={dynamicStyles.modalOverlay}
           >
              <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                <View style={[dynamicStyles.pickerContainer, {padding: 20}]}>
                  <View style={{flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20}}>
                      <Text style={{fontSize: 20, fontWeight: 'bold', color: colors.text}}>
                        {authMode === 'login' ? 'Đăng Nhập' : 'Đăng Ký Tài Khoản'}
                      </Text>
                      <TouchableOpacity onPress={() => setShowAuthModal(false)}><Ionicons name="close" size={24} color={colors.text}/></TouchableOpacity>
                  </View>

                  <ScrollView scrollEnabled={false}>
                    <Text style={dynamicStyles.subText}>Email:</Text>
                    <TextInput 
                        style={dynamicStyles.authInput} 
                        placeholder="email@example.com" 
                        placeholderTextColor={colors.subText}
                        autoCapitalize="none"
                        value={email} onChangeText={setEmail}
                    />

                    <Text style={dynamicStyles.subText}>Mật khẩu:</Text>
                    <TextInput 
                        style={dynamicStyles.authInput} 
                        placeholder="******" 
                        placeholderTextColor={colors.subText}
                        secureTextEntry
                        value={password} onChangeText={setPassword}
                    />

                    <TouchableOpacity style={dynamicStyles.authBtn} onPress={handleAuth}>
                        <Text style={{color: 'white', fontWeight: 'bold', fontSize: 16}}>
                          {authMode === 'login' ? 'Đăng Nhập' : 'Đăng Ký Ngay'}
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={{marginTop: 15, alignItems: 'center'}} onPress={() => setAuthMode(authMode==='login'?'register':'login')}>
                        <Text style={{color: colors.primary}}>
                          {authMode === 'login' ? 'Chưa có tài khoản? Đăng ký' : 'Đã có tài khoản? Đăng nhập'}
                        </Text>
                    </TouchableOpacity>
                  </ScrollView>
                </View>
              </TouchableWithoutFeedback>
           </KeyboardAvoidingView>
        </TouchableWithoutFeedback>
      </Modal>

    </SafeAreaView>
  );
}