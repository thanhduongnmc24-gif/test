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
import { useTab } from '../context/TabContext'; // [MỚI] Import Context Tab

import { supabase } from '../supabaseConfig'; 

export default function SettingsScreen() {
  const { theme, toggleTheme, colors } = useTheme();
  const { tabState, toggleTab } = useTab(); // [MỚI] Lấy hàm quản lý Tab
  
  // --- STATE CÀI ĐẶT ---
  const [startDate, setStartDate] = useState(new Date());
  const [isNotifEnabled, setIsNotifEnabled] = useState(false);
  const [timeDay, setTimeDay] = useState(new Date(new Date().setHours(6, 0, 0, 0)));
  const [timeNight, setTimeNight] = useState(new Date(new Date().setHours(18, 0, 0, 0)));
  const [timeOff, setTimeOff] = useState(new Date(new Date().setHours(8, 0, 0, 0)));
  
  // [STATE CHU KỲ]
  const [cyclePattern, setCyclePattern] = useState<string[]>(['ngay', 'dem', 'nghi']);
  
  // [MỚI] STATE API KEY
  const [geminiKey, setGeminiKey] = useState('');

  const [pickerMode, setPickerMode] = useState<'none' | 'date' | 'timeDay' | 'timeNight' | 'timeOff'>('none');
  const [tempDate, setTempDate] = useState(new Date());

  // --- STATE AUTH & SYNC ---
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
      
      const savedPattern = await AsyncStorage.getItem('WORK_CYCLE_PATTERN');
      if (savedPattern) setCyclePattern(JSON.parse(savedPattern));

      // [MỚI] Load Key
      const savedKey = await AsyncStorage.getItem('GEMINI_API_KEY');
      if (savedKey) setGeminiKey(savedKey);

    } catch (e) { console.error('Lỗi load settings:', e); }
  };

  const saveSettingItem = async (key: string, value: string) => {
      try { await AsyncStorage.setItem(key, value); } catch (e) { console.error(e); }
  };

  // [MỚI] Lưu Key khi nhập xong
  const handleSaveKey = async () => {
      await saveSettingItem('GEMINI_API_KEY', geminiKey);
      Keyboard.dismiss();
      Alert.alert("Đã lưu", "Key Gemini đã được cập nhật!");
  };
  
  const toggleSwitch = async () => {
      const newState = !isNotifEnabled;
      setIsNotifEnabled(newState);
      await saveSettingItem('NOTIF_ENABLED', JSON.stringify(newState));
  };

  // --- HÀM XỬ LÝ CHU KỲ ---
  const addToPattern = async (type: string) => {
    const newPattern = [...cyclePattern, type];
    setCyclePattern(newPattern);
    await saveSettingItem('WORK_CYCLE_PATTERN', JSON.stringify(newPattern));
  };

  const removeFromPattern = async (index: number) => {
    if (cyclePattern.length <= 1) { Alert.alert("Chú ý", "Chu kỳ phải có ít nhất 1 bước chứ đại ca!"); return; }
    const newPattern = cyclePattern.filter((_, i) => i !== index);
    setCyclePattern(newPattern);
    await saveSettingItem('WORK_CYCLE_PATTERN', JSON.stringify(newPattern));
  };

  const resetPattern = async () => {
    Alert.alert("Xác nhận", "Về mặc định: Ngày - Đêm - Nghỉ?", [
      { text: "Hủy", style: "cancel" },
      { text: "Đồng ý", onPress: async () => {
          const defaultPattern = ['ngay', 'dem', 'nghi'];
          setCyclePattern(defaultPattern);
          await saveSettingItem('WORK_CYCLE_PATTERN', JSON.stringify(defaultPattern));
      }}
    ]);
  };

  const getCycleTypeConfig = (type: string) => {
    switch (type) {
      case 'ngay': return { icon: 'sunny', color: '#F59E0B', bg: '#FEF3C7', label: 'Ngày' };
      case 'dem': return { icon: 'moon', color: '#6366F1', bg: '#E0E7FF', label: 'Đêm' };
      case 'nghi': return { icon: 'cafe', color: '#10B981', bg: '#D1FAE5', label: 'Nghỉ' };
      default: return { icon: 'help', color: 'gray', bg: '#eee', label: '?' };
    }
  };

  // --- LOGIC AUTH & SYNC ---
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
        Alert.alert("Thành công", "Đã tạo tài khoản!");
      }
    } catch (error: any) { Alert.alert("Lỗi", error.message); }
  };
  const handleLogout = async () => { await supabase.auth.signOut(); setEmail(''); setPassword(''); };

  const handleBackup = async () => {
    if (!user) return;
    setIsSyncing(true);
    try {
      const keys = ['QUICK_NOTES', 'CALENDAR_NOTES', 'USER_REMINDERS', 'CYCLE_START_DATE', 'NOTIF_ENABLED', 'GEMINI_API_KEY', 'WORK_CYCLE_PATTERN'];
      const stores = await AsyncStorage.multiGet(keys);
      const dataToSave: any = {};
      stores.forEach((store) => { if (store[1]) try { dataToSave[store[0]] = JSON.parse(store[1]); } catch { dataToSave[store[0]] = store[1]; } });
      const { error } = await supabase.from('user_sync').upsert({ user_id: user.id, backup_data: dataToSave, updated_at: new Date() });
      if (error) throw error; Alert.alert("Đồng bộ xong!", "Đã lưu lên mây ⚡️");
    } catch (error: any) { Alert.alert("Lỗi", error.message); } finally { setIsSyncing(false); }
  };

  const handleRestore = async () => {
    if (!user) return;
    setIsSyncing(true);
    try {
      const { data, error } = await supabase.from('user_sync').select('backup_data').eq('user_id', user.id).single();
      if (error) throw error;
      if (data && data.backup_data) {
        const backup = data.backup_data;
        const pairs: [string, string][] = [];
        const keys = ['QUICK_NOTES', 'CALENDAR_NOTES', 'USER_REMINDERS', 'CYCLE_START_DATE', 'NOTIF_ENABLED', 'GEMINI_API_KEY', 'WORK_CYCLE_PATTERN'];
        keys.forEach(key => { if (backup[key] !== undefined) pairs.push([key, typeof backup[key] === 'string' ? backup[key] : JSON.stringify(backup[key])]); });
        if (pairs.length > 0) { await AsyncStorage.multiSet(pairs); loadSettings(); Alert.alert("Thành công", "Đã khôi phục dữ liệu!"); } 
        else { Alert.alert("Thông báo", "Không có dữ liệu."); }
      } else { Alert.alert("Trống", "Chưa có bản sao lưu."); }
    } catch (error: any) { Alert.alert("Lỗi", "Không tải được."); } finally { setIsSyncing(false); }
  };

  // --- LOGIC PICKER ---
  const openPicker = (mode: typeof pickerMode) => {
    setPickerMode(mode);
    if (mode === 'date') setTempDate(startDate);
    else if (mode === 'timeDay') setTempDate(timeDay);
    else if (mode === 'timeNight') setTempDate(timeNight);
    else if (mode === 'timeOff') setTempDate(timeOff);
  };
  const confirmPicker = () => {
    if (pickerMode === 'date') { setStartDate(tempDate); saveSettingItem('CYCLE_START_DATE', tempDate.toISOString()); }
    else if (pickerMode === 'timeDay') { setTimeDay(tempDate); saveSettingItem('TIME_DAY', tempDate.toISOString()); }
    else if (pickerMode === 'timeNight') { setTimeNight(tempDate); saveSettingItem('TIME_NIGHT', tempDate.toISOString()); }
    else if (pickerMode === 'timeOff') { setTimeOff(tempDate); saveSettingItem('TIME_OFF', tempDate.toISOString()); }
    setPickerMode('none');
  };
  const onPickerChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setPickerMode('none');
      if (selectedDate) {
        if (pickerMode === 'date') { setStartDate(selectedDate); saveSettingItem('CYCLE_START_DATE', selectedDate.toISOString()); }
        else if (pickerMode === 'timeDay') { setTimeDay(selectedDate); saveSettingItem('TIME_DAY', selectedDate.toISOString()); }
        else if (pickerMode === 'timeNight') { setTimeNight(selectedDate); saveSettingItem('TIME_NIGHT', selectedDate.toISOString()); }
        else if (pickerMode === 'timeOff') { setTimeOff(selectedDate); saveSettingItem('TIME_OFF', selectedDate.toISOString()); }
      }
    } else if (selectedDate) setTempDate(selectedDate);
  };

  const dynamicStyles = {
    container: { flex: 1, backgroundColor: colors.bg },
    headerTitle: { fontSize: 24, fontWeight: 'bold' as const, color: colors.text },
    sectionTitle: { fontSize: 13, fontWeight: 'bold' as const, color: colors.subText, marginBottom: 8, marginTop: 15, textTransform: 'uppercase' as const },
    card: { backgroundColor: colors.card, borderRadius: 16, padding: 2, borderWidth: 1, borderColor: colors.border },
    text: { color: colors.text },
    subText: { color: colors.subText },
    iconBox: { width: 32, height: 32, borderRadius: 8, backgroundColor: colors.iconBg, justifyContent: 'center' as const, alignItems: 'center' as const },
    separator: { height: 1, backgroundColor: colors.border, marginLeft: 60 },
    authBtn: { backgroundColor: colors.primary, padding: 12, borderRadius: 10, alignItems: 'center' as const, marginTop: 10 },
    authInput: { backgroundColor: colors.iconBg, color: colors.text, padding: 10, borderRadius: 10, marginBottom: 10, borderWidth: 1, borderColor: colors.border },
    syncBtn: { flexDirection: 'row' as const, alignItems: 'center' as const, padding: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' as const },
    pickerContainer: { backgroundColor: colors.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 30, borderWidth: 1, borderColor: colors.border },
    pickerHeader: { flexDirection: 'row' as const, justifyContent: 'space-between' as const, padding: 15, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.iconBg, borderTopLeftRadius: 20, borderTopRightRadius: 20 },
    addCycleBtn: { flex: 1, alignItems: 'center' as const, justifyContent: 'center' as const, paddingVertical: 10, borderRadius: 10, marginHorizontal: 3, borderWidth: 1, borderColor: 'transparent' },
    cycleStepBox: { width: 60, height: 70, borderRadius: 10, alignItems: 'center' as const, justifyContent: 'center' as const, marginRight: 8, borderWidth: 1, borderColor: colors.border, position: 'relative' as const },
    deleteStepBtn: { position: 'absolute' as const, top: -5, right: -5, backgroundColor: '#EF4444', borderRadius: 10, width: 18, height: 18, alignItems: 'center' as const, justifyContent: 'center' as const, zIndex: 10, borderWidth: 1, borderColor: '#fff' }
  };

  return (
    <SafeAreaView style={dynamicStyles.container} edges={['top']}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={{padding: 15, alignItems:'center'}}><Text style={dynamicStyles.headerTitle}>Cài Đặt</Text></View>
        <View style={{paddingHorizontal: 15}}>
          
          <Text style={dynamicStyles.sectionTitle}>☁️ TÀI KHOẢN & ĐỒNG BỘ</Text>
          <View style={[dynamicStyles.card, {padding: 0, overflow: 'hidden'}]}>
             {!user ? (
               <View style={{padding: 15, alignItems: 'center'}}>
                 <Text style={{color: colors.subText, marginBottom: 10, textAlign: 'center', fontSize: 13}}>Đăng nhập để sao lưu dữ liệu.</Text>
                 <TouchableOpacity style={{backgroundColor: colors.primary, paddingHorizontal: 25, paddingVertical: 10, borderRadius: 20}} onPress={() => setShowAuthModal(true)}>
                    <Text style={{color: 'white', fontWeight: 'bold'}}>Đăng nhập / Đăng ký</Text>
                 </TouchableOpacity>
               </View>
             ) : (
               <View>
                 <View style={{padding: 10, backgroundColor: colors.iconBg, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'}}>
                    <View style={{flexDirection: 'row', alignItems: 'center', flex: 1}}>
                      <Ionicons name="person-circle" size={36} color={colors.primary} />
                      <View style={{marginLeft: 10, flex: 1}}>
                        <Text numberOfLines={1} style={{color: colors.text, fontWeight: 'bold', fontSize: 14}}>{user.email}</Text>
                        <Text style={{color: colors.success, fontSize: 11}}>● Đang hoạt động</Text>
                      </View>
                    </View>
                    <TouchableOpacity onPress={handleLogout} style={{padding: 5}}><Ionicons name="log-out-outline" size={22} color="#EF4444" /></TouchableOpacity>
                 </View>
                 <TouchableOpacity style={dynamicStyles.syncBtn} onPress={handleBackup} disabled={isSyncing}>
                    <View style={[dynamicStyles.iconBox, {backgroundColor: '#DBEAFE'}]}><Ionicons name="cloud-upload" size={18} color="#2563EB" /></View>
                    <View style={{marginLeft: 12, flex: 1}}><Text style={[dynamicStyles.text, {fontWeight: 'bold', fontSize: 14}]}>Sao lưu ngay</Text><Text style={{fontSize: 11, color: colors.subText}}>Đẩy dữ liệu lên mây</Text></View>
                    {isSyncing ? <ActivityIndicator size="small" color={colors.primary}/> : <Ionicons name="chevron-forward" size={18} color={colors.subText} />}
                 </TouchableOpacity>
                 <TouchableOpacity style={[dynamicStyles.syncBtn, {borderBottomWidth: 0}]} onPress={handleRestore} disabled={isSyncing}>
                    <View style={[dynamicStyles.iconBox, {backgroundColor: '#DCFCE7'}]}><Ionicons name="cloud-download" size={18} color="#16A34A" /></View>
                    <View style={{marginLeft: 12, flex: 1}}><Text style={[dynamicStyles.text, {fontWeight: 'bold', fontSize: 14}]}>Khôi phục dữ liệu</Text><Text style={{fontSize: 11, color: colors.subText}}>Tải dữ liệu về máy</Text></View>
                    {isSyncing ? <ActivityIndicator size="small" color={colors.primary}/> : <Ionicons name="chevron-forward" size={18} color={colors.subText} />}
                 </TouchableOpacity>
               </View>
             )}
          </View>

          <Text style={dynamicStyles.sectionTitle}>🎨 GIAO DIỆN</Text>
          <View style={dynamicStyles.card}>
            <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 10}}>
              <View style={{flexDirection: 'row', alignItems: 'center'}}>
                <View style={dynamicStyles.iconBox}><Ionicons name={theme === 'dark' ? "moon" : "sunny"} size={18} color={theme === 'dark' ? "#FDB813" : "#F59E0B"} /></View>
                <Text style={[dynamicStyles.text, {marginLeft: 12, fontSize: 15, fontWeight: '500'}]}>{theme === 'dark' ? 'Chế độ Tối' : 'Chế độ Sáng'}</Text>
              </View>
              <Switch value={theme === 'dark'} onValueChange={toggleTheme} trackColor={{ false: "#E5E7EB", true: colors.primary }} thumbColor={"#fff"} style={{ transform: [{ scaleX: 0.9 }, { scaleY: 0.9 }] }} />
            </View>
          </View>

          {/* [PHẦN MỚI THÊM] QUẢN LÝ TAB */}
          <Text style={dynamicStyles.sectionTitle}>👁️ QUẢN LÝ TAB</Text>
          <View style={dynamicStyles.card}>
            {[
              { key: 'calendar', label: 'Lịch làm việc', icon: 'calendar' },
              { key: 'notes', label: 'Ghi chú', icon: 'document-text' },
              { key: 'sheets', label: 'Trang tính', icon: 'grid' },
              { key: 'media', label: 'Media AI', icon: 'images' },
              { key: 'reminders', label: 'Nhắc nhở', icon: 'alarm' },
            ].map((item, index, arr) => (
              <View key={item.key} style={{
                  flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 10,
                  borderBottomWidth: index < arr.length - 1 ? 1 : 0, borderBottomColor: colors.border
              }}>
                <View style={{flexDirection: 'row', alignItems: 'center'}}>
                   <View style={dynamicStyles.iconBox}><Ionicons name={item.icon as any} size={18} color={colors.primary} /></View>
                   <Text style={[dynamicStyles.text, {marginLeft: 12, fontSize: 15}]}>{item.label}</Text>
                </View>
                <Switch 
                  value={tabState[item.key as keyof typeof tabState]} 
                  onValueChange={() => toggleTab(item.key as any)} 
                  trackColor={{ false: "#E5E7EB", true: colors.primary }} 
                  thumbColor={"#fff"} 
                  style={{ transform: [{ scaleX: 0.9 }, { scaleY: 0.9 }] }} 
                />
              </View>
            ))}
          </View>

          {/* [PHẦN MỚI] CẤU HÌNH API KEY */}
          <Text style={dynamicStyles.sectionTitle}>🤖 CẤU HÌNH AI (GEMINI)</Text>
          <View style={dynamicStyles.card}>
             <View style={{padding: 10}}>
                <Text style={{color: colors.subText, fontSize: 12, marginBottom: 5}}>Nhập API Key để dùng tính năng Media:</Text>
                <View style={{flexDirection: 'row', alignItems: 'center'}}>
                    <TextInput 
                        style={[dynamicStyles.authInput, {flex: 1, marginBottom: 0, height: 45}]} 
                        placeholder="AIzaSy..." 
                        placeholderTextColor={colors.subText} 
                        value={geminiKey} 
                        onChangeText={setGeminiKey}
                        secureTextEntry
                    />
                    <TouchableOpacity onPress={handleSaveKey} style={{backgroundColor: colors.primary, padding: 10, borderRadius: 8, marginLeft: 10, height: 45, justifyContent: 'center'}}>
                         <Ionicons name="save" size={20} color="white" />
                    </TouchableOpacity>
                </View>
             </View>
          </View>

          <Text style={dynamicStyles.sectionTitle}>⚙️ TÙY CHỈNH CHU KỲ</Text>
          <View style={[dynamicStyles.card, {padding: 10}]}>
             <Text style={{fontSize: 12, color: colors.subText, marginBottom: 10}}>Thứ tự các ca làm việc:</Text>
             <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginBottom: 15, paddingVertical: 5}}>
                {cyclePattern.map((item, index) => {
                    const cfg = getCycleTypeConfig(item);
                    return (
                        <View key={index} style={[dynamicStyles.cycleStepBox, {backgroundColor: cfg.bg}]}>
                            <Text style={{fontSize: 10, fontWeight: 'bold', color: cfg.color, position: 'absolute', top: 3, left: 5}}>{index + 1}</Text>
                            <Ionicons name={cfg.icon as any} size={24} color={cfg.color} />
                            <Text style={{fontSize: 10, color: cfg.color, fontWeight: 'bold', marginTop: 2}}>{cfg.label}</Text>
                            <TouchableOpacity style={dynamicStyles.deleteStepBtn} onPress={() => removeFromPattern(index)}>
                                <Ionicons name="close" size={12} color="white" />
                            </TouchableOpacity>
                        </View>
                    );
                })}
             </ScrollView>
             <Text style={{fontSize: 12, color: colors.subText, marginBottom: 5}}>Thêm bước tiếp theo:</Text>
             <View style={{flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10}}>
                <TouchableOpacity style={[dynamicStyles.addCycleBtn, {backgroundColor: '#FEF3C7'}]} onPress={() => addToPattern('ngay')}>
                    <Ionicons name="sunny" size={24} color="#F59E0B" /><Text style={{fontSize: 11, fontWeight:'bold', color: '#B45309', marginTop: 2}}>+ Ngày</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[dynamicStyles.addCycleBtn, {backgroundColor: '#E0E7FF'}]} onPress={() => addToPattern('dem')}>
                    <Ionicons name="moon" size={24} color="#6366F1" /><Text style={{fontSize: 11, fontWeight:'bold', color: '#4338CA', marginTop: 2}}>+ Đêm</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[dynamicStyles.addCycleBtn, {backgroundColor: '#D1FAE5'}]} onPress={() => addToPattern('nghi')}>
                    <Ionicons name="cafe" size={24} color="#10B981" /><Text style={{fontSize: 11, fontWeight:'bold', color: '#065F46', marginTop: 2}}>+ Nghỉ</Text>
                </TouchableOpacity>
             </View>
             <TouchableOpacity onPress={resetPattern} style={{flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 8, backgroundColor: colors.iconBg, borderRadius: 8}}>
                 <Ionicons name="refresh" size={16} color={colors.text} /><Text style={{color: colors.text, fontSize: 12, fontWeight: 'bold', marginLeft: 5}}>Về mặc định (Ngày - Đêm - Nghỉ)</Text>
             </TouchableOpacity>
          </View>

          <Text style={dynamicStyles.sectionTitle}>📅 NGÀY BẮT ĐẦU</Text>
          <View style={dynamicStyles.card}>
            <Text style={{fontSize: 13, paddingHorizontal: 10, paddingTop: 10, paddingBottom: 5, color: colors.subText}}>Ngày bắt đầu <Text style={{fontWeight: 'bold', color: colors.primary}}>BƯỚC 1</Text> của chu kỳ:</Text>
            <TouchableOpacity style={{flexDirection: 'row', alignItems: 'center', padding: 10}} onPress={() => openPicker('date')}>
              <View style={dynamicStyles.iconBox}><Ionicons name="calendar" size={18} color={colors.primary} /></View>
              <Text style={{flex: 1, fontSize: 15, marginLeft: 12, color: colors.text}}>{format(startDate, 'dd/MM/yyyy')}</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.subText} />
            </TouchableOpacity>
          </View>

          <Text style={dynamicStyles.sectionTitle}>🔔 CẤU HÌNH THÔNG BÁO</Text>
          <View style={dynamicStyles.card}>
            <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 10}}>
              <Text style={{fontSize: 14, fontWeight:'bold', color: colors.subText}}>Bật thông báo nhắc nhở:</Text>
              <Switch value={isNotifEnabled} onValueChange={toggleSwitch} trackColor={{ false: "#E5E7EB", true: colors.primary }} thumbColor={"#fff"} style={{ transform: [{ scaleX: 0.9 }, { scaleY: 0.9 }] }} />
            </View>
            {isNotifEnabled && (
              <>
                <View style={dynamicStyles.separator} />
                <TouchableOpacity style={{flexDirection: 'row', alignItems: 'center', padding: 10}} onPress={() => openPicker('timeDay')}>
                  <View style={dynamicStyles.iconBox}><Ionicons name="sunny" size={18} color="#FDB813" /></View>
                  <Text style={{flex: 1, fontSize: 15, marginLeft: 12, color: colors.text}}>Giờ nhắc Ca Ngày</Text>
                  <Text style={{fontSize: 15, fontWeight: 'bold', marginRight: 5, color: colors.primary}}>{format(timeDay, 'HH:mm')}</Text>
                </TouchableOpacity>
                <View style={dynamicStyles.separator} />
                <TouchableOpacity style={{flexDirection: 'row', alignItems: 'center', padding: 10}} onPress={() => openPicker('timeNight')}>
                  <View style={dynamicStyles.iconBox}><Ionicons name="moon" size={18} color="#60A5FA" /></View>
                  <Text style={{flex: 1, fontSize: 15, marginLeft: 12, color: colors.text}}>Giờ nhắc Ca Đêm</Text>
                  <Text style={{fontSize: 15, fontWeight: 'bold', marginRight: 5, color: colors.primary}}>{format(timeNight, 'HH:mm')}</Text>
                </TouchableOpacity>
                <View style={dynamicStyles.separator} />
                 <TouchableOpacity style={{flexDirection: 'row', alignItems: 'center', padding: 10}} onPress={() => openPicker('timeOff')}>
                  <View style={dynamicStyles.iconBox}><Ionicons name="cafe" size={18} color="#10B981" /></View>
                  <Text style={{flex: 1, fontSize: 15, marginLeft: 12, color: colors.text}}>Giờ nhắc Ngày Nghỉ</Text>
                  <Text style={{fontSize: 15, fontWeight: 'bold', marginRight: 5, color: colors.primary}}>{format(timeOff, 'HH:mm')}</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </ScrollView>

      <Modal transparent={true} visible={pickerMode !== 'none'} animationType="slide">
        <View style={dynamicStyles.modalOverlay}>
          <View style={dynamicStyles.pickerContainer}>
            <View style={dynamicStyles.pickerHeader}>
              <TouchableOpacity onPress={() => setPickerMode('none')}><Text style={{color: '#EF4444', fontSize: 16}}>Hủy</Text></TouchableOpacity>
              <Text style={{fontWeight: 'bold', fontSize: 16, color: colors.text}}>{pickerMode === 'date' ? 'Chọn Ngày' : 'Chọn Giờ'}</Text>
              <TouchableOpacity onPress={confirmPicker}><Text style={{color: colors.primary, fontWeight: 'bold', fontSize: 16}}>Xong</Text></TouchableOpacity>
            </View>
            <DateTimePicker value={tempDate} mode={pickerMode === 'date' ? 'date' : 'time'} display="spinner" onChange={onPickerChange} locale="vi-VN" is24Hour={true} themeVariant={theme} textColor={colors.text} />
          </View>
        </View>
      </Modal>

      <Modal transparent={true} visible={showAuthModal} animationType="slide">
        <TouchableWithoutFeedback onPress={() => setShowAuthModal(false)}>
           <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={dynamicStyles.modalOverlay}>
              <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                <View style={[dynamicStyles.pickerContainer, {padding: 20}]}>
                  <View style={{flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20}}>
                      <Text style={{fontSize: 20, fontWeight: 'bold', color: colors.text}}>{authMode === 'login' ? 'Đăng Nhập' : 'Đăng Ký Tài Khoản'}</Text>
                      <TouchableOpacity onPress={() => setShowAuthModal(false)}><Ionicons name="close" size={24} color={colors.text}/></TouchableOpacity>
                  </View>
                  <ScrollView scrollEnabled={false}>
                    <Text style={dynamicStyles.subText}>Email:</Text>
                    <TextInput style={dynamicStyles.authInput} placeholder="email@example.com" placeholderTextColor={colors.subText} autoCapitalize="none" value={email} onChangeText={setEmail} />
                    <Text style={dynamicStyles.subText}>Mật khẩu:</Text>
                    <TextInput style={dynamicStyles.authInput} placeholder="******" placeholderTextColor={colors.subText} secureTextEntry value={password} onChangeText={setPassword} />
                    <TouchableOpacity style={dynamicStyles.authBtn} onPress={handleAuth}><Text style={{color: 'white', fontWeight: 'bold', fontSize: 16}}>{authMode === 'login' ? 'Đăng Nhập' : 'Đăng Ký Ngay'}</Text></TouchableOpacity>
                    <TouchableOpacity style={{marginTop: 15, alignItems: 'center'}} onPress={() => setAuthMode(authMode==='login'?'register':'login')}><Text style={{color: colors.primary}}>{authMode === 'login' ? 'Chưa có tài khoản? Đăng ký' : 'Đã có tài khoản? Đăng nhập'}</Text></TouchableOpacity>
                  </ScrollView>
                </View>
              </TouchableWithoutFeedback>
           </KeyboardAvoidingView>
        </TouchableWithoutFeedback>
      </Modal>
    </SafeAreaView>
    //lolo
  );
}