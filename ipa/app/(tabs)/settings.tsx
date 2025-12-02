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

// Import Supabase
import { supabase } from '../supabaseConfig'; 

export default function SettingsScreen() {
  const { theme, toggleTheme, colors } = useTheme();
  
  // --- STATE CÀI ĐẶT ---
  const [startDate, setStartDate] = useState(new Date());
  const [isNotifEnabled, setIsNotifEnabled] = useState(false);
  const [timeDay, setTimeDay] = useState(new Date(new Date().setHours(6, 0, 0, 0)));
  const [timeNight, setTimeNight] = useState(new Date(new Date().setHours(18, 0, 0, 0)));
  const [timeOff, setTimeOff] = useState(new Date(new Date().setHours(8, 0, 0, 0)));
  
  // [ĐÃ XÓA] timeNormal ở đây

  const [pickerMode, setPickerMode] = useState<'none' | 'date' | 'timeDay' | 'timeNight' | 'timeOff'>('none');
  const [tempDate, setTempDate] = useState(new Date());

  // STATE CHU KỲ TÙY CHỈNH
  const [cyclePattern, setCyclePattern] = useState<string[]>(['ngay', 'dem', 'nghi']);

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
      
      const savedPattern = await AsyncStorage.getItem('CYCLE_PATTERN');
      if (savedPattern) setCyclePattern(JSON.parse(savedPattern));

      const tDay = await AsyncStorage.getItem('TIME_DAY'); if (tDay) setTimeDay(new Date(tDay));
      const tNight = await AsyncStorage.getItem('TIME_NIGHT'); if (tNight) setTimeNight(new Date(tNight));
      const tOff = await AsyncStorage.getItem('TIME_OFF'); if (tOff) setTimeOff(new Date(tOff));
      
      // [ĐÃ XÓA] Load timeNormal
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

  // --- HÀM XỬ LÝ CHU KỲ ---
  const addToCycle = async (type: string) => {
    const newPattern = [...cyclePattern, type];
    setCyclePattern(newPattern);
    await saveSettingItem('CYCLE_PATTERN', JSON.stringify(newPattern));
  };

  const removeLastStep = async () => {
    if (cyclePattern.length === 0) return;
    const newPattern = [...cyclePattern];
    newPattern.pop();
    setCyclePattern(newPattern);
    await saveSettingItem('CYCLE_PATTERN', JSON.stringify(newPattern));
  };

  const resetCycle = async () => {
    const defaultPattern = ['ngay', 'dem', 'nghi'];
    setCyclePattern(defaultPattern);
    await saveSettingItem('CYCLE_PATTERN', JSON.stringify(defaultPattern));
    Alert.alert("Đã đặt lại", "Chu kỳ đã về mặc định: Ngày - Đêm - Nghỉ");
  };

  // --- AUTH ---
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

  // --- SYNC ---
  const handleBackup = async () => {
    if (!user) return;
    setIsSyncing(true);
    try {
      // [ĐÃ XÓA] timeNormal khỏi danh sách keys nếu cần, nhưng để nguyên cũng không sao vì nó sẽ null
      const keys = ['QUICK_NOTES', 'CALENDAR_NOTES', 'USER_REMINDERS', 'CYCLE_START_DATE', 'NOTIF_ENABLED', 'GEMINI_API_KEY', 'CYCLE_PATTERN', 'TIME_DAY', 'TIME_NIGHT', 'TIME_OFF'];
      const stores = await AsyncStorage.multiGet(keys);
      
      const dataToSave: any = {};
      stores.forEach((store) => {
         if (store[1]) {
             try {
                dataToSave[store[0]] = JSON.parse(store[1]);
             } catch {
                dataToSave[store[0]] = store[1];
             }
         }
      });

      const { error } = await supabase.from('user_sync').upsert({ 
            user_id: user.id, backup_data: dataToSave, updated_at: new Date()
      });
      if (error) throw error;
      Alert.alert("Đồng bộ xong!", "Dữ liệu đã được lưu an toàn ⚡️");
    } catch (error: any) {
      Alert.alert("Lỗi sao lưu", error.message);
    } finally {
      setIsSyncing(false);
    }
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
        const keys = ['QUICK_NOTES', 'CALENDAR_NOTES', 'USER_REMINDERS', 'CYCLE_START_DATE', 'NOTIF_ENABLED', 'GEMINI_API_KEY', 'CYCLE_PATTERN', 'TIME_DAY', 'TIME_NIGHT', 'TIME_OFF'];
        
        keys.forEach(key => {
            if (backup[key] !== undefined && backup[key] !== null) {
                let valStr = typeof backup[key] === 'string' ? backup[key] : JSON.stringify(backup[key]);
                pairs.push([key, valStr]);
            }
        });

        if (pairs.length > 0) {
            await AsyncStorage.multiSet(pairs);
            loadSettings(); 
            Alert.alert("Thành công", "Đã khôi phục dữ liệu về máy!");
        } else {
            Alert.alert("Thông báo", "Không có dữ liệu.");
        }
      }
    } catch (error: any) {
      Alert.alert("Lỗi khôi phục", "Không tải được dữ liệu.");
    } finally {
      setIsSyncing(false);
    }
  };

  // --- PICKER ---
  const openPicker = (mode: typeof pickerMode) => {
    setPickerMode(mode);
    if (mode === 'date') setTempDate(startDate);
    if (mode === 'timeDay') setTempDate(timeDay);
    if (mode === 'timeNight') setTempDate(timeNight);
    if (mode === 'timeOff') setTempDate(timeOff);
  };

  const confirmPicker = () => {
    if (pickerMode === 'date') { setStartDate(tempDate); saveSettingItem('CYCLE_START_DATE', tempDate.toISOString()); }
    if (pickerMode === 'timeDay') { setTimeDay(tempDate); saveSettingItem('TIME_DAY', tempDate.toISOString()); }
    if (pickerMode === 'timeNight') { setTimeNight(tempDate); saveSettingItem('TIME_NIGHT', tempDate.toISOString()); }
    if (pickerMode === 'timeOff') { setTimeOff(tempDate); saveSettingItem('TIME_OFF', tempDate.toISOString()); }
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
      }
    } else {
      if (selectedDate) setTempDate(selectedDate);
    }
  };

  const ROW_PADDING = 12; // Padding thấp

  const dynamicStyles = {
    container: { flex: 1, backgroundColor: colors.bg },
    headerTitle: { fontSize: 24, fontWeight: 'bold' as const, color: colors.text },
    sectionTitle: { fontSize: 13, fontWeight: 'bold' as const, color: colors.subText, marginBottom: 8, marginTop: 20, textTransform: 'uppercase' as const },
    card: { backgroundColor: colors.card, borderRadius: 12, padding: 2, borderWidth: 1, borderColor: colors.border },
    text: { color: colors.text },
    subText: { color: colors.subText },
    iconBox: { width: 32, height: 32, borderRadius: 8, backgroundColor: colors.iconBg, justifyContent: 'center' as const, alignItems: 'center' as const },
    separator: { height: 1, backgroundColor: colors.border, marginLeft: 60 },
    authBtn: { backgroundColor: colors.primary, padding: 12, borderRadius: 10, alignItems: 'center' as const, marginTop: 10 },
    authInput: { backgroundColor: colors.iconBg, color: colors.text, padding: 12, borderRadius: 10, marginBottom: 10, borderWidth: 1, borderColor: colors.border },
    syncBtn: { flexDirection: 'row' as const, alignItems: 'center' as const, padding: ROW_PADDING, borderBottomWidth: 1, borderBottomColor: colors.border },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' as const },
    pickerContainer: { backgroundColor: colors.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 30, borderWidth: 1, borderColor: colors.border },
    pickerHeader: { flexDirection: 'row' as const, justifyContent: 'space-between' as const, padding: 15, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.iconBg, borderTopLeftRadius: 20, borderTopRightRadius: 20 },
    
    cycleStep: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center' as const, alignItems: 'center' as const, margin: 2 },
    cycleBuilder: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, padding: 10, alignItems: 'center' as const, justifyContent: 'center' as const },
    cycleControl: { flexDirection: 'row' as const, justifyContent: 'space-around' as const, padding: 8, borderTopWidth: 1, borderTopColor: colors.border }
  };

  const getStepColor = (type: string) => {
    if (type === 'ngay') return theme === 'dark' ? '#FDB813' : '#F59E0B';
    if (type === 'dem') return theme === 'dark' ? '#2DD4BF' : '#6366F1';
    return theme === 'dark' ? '#FDA4AF' : '#78350F';
  };
  
  const getStepIcon = (type: string) => {
    if (type === 'ngay') return "sunny";
    if (type === 'dem') return "moon";
    return "cafe";
  };

  return (
    <SafeAreaView style={dynamicStyles.container} edges={['top']}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={{padding: 15, alignItems:'center'}}>
          <Text style={dynamicStyles.headerTitle}>Cài Đặt</Text>
        </View>

        <View style={{paddingHorizontal: 15}}>
          
          <Text style={dynamicStyles.sectionTitle}>📅 CẤU HÌNH LỊCH</Text>
          <View style={dynamicStyles.card}>
            {/* CHỌN NGÀY BẮT ĐẦU */}
            <Text style={{fontSize: 14, padding: ROW_PADDING, color: colors.subText}}>Chọn ngày bắt đầu bước 1:</Text>
            <TouchableOpacity style={{flexDirection: 'row', alignItems: 'center', padding: ROW_PADDING, paddingTop: 0}} onPress={() => openPicker('date')}>
              <View style={dynamicStyles.iconBox}><Ionicons name="calendar" size={18} color={colors.primary} /></View>
              <Text style={{flex: 1, fontSize: 16, marginLeft: 15, color: colors.text}}>{format(startDate, 'dd/MM/yyyy')}</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.subText} />
            </TouchableOpacity>
            
            <View style={dynamicStyles.separator} />

            {/* KHU VỰC TẠO CHU KỲ */}
            <Text style={{fontSize: 14, padding: ROW_PADDING, paddingBottom: 5, color: colors.subText}}>
                Mô hình chu kỳ (<Text style={{fontWeight:'bold', color: colors.primary}}>{cyclePattern.length}</Text> ngày):
            </Text>
            
            <View style={dynamicStyles.cycleBuilder}>
                {cyclePattern.map((type, index) => (
                    <View key={index} style={[dynamicStyles.cycleStep, {backgroundColor: getStepColor(type) + '30', borderWidth: 1, borderColor: getStepColor(type)}]}>
                        <Ionicons name={getStepIcon(type)} size={18} color={getStepColor(type)} />
                        <Text style={{fontSize: 8, position: 'absolute', bottom: -12, color: colors.text, fontWeight: 'bold'}}>{index+1}</Text>
                    </View>
                ))}
                {cyclePattern.length === 0 && <Text style={{color: colors.subText, fontStyle: 'italic'}}>Chưa có bước nào</Text>}
            </View>
            <View style={{height: 10}}/>

            <View style={dynamicStyles.cycleControl}>
                <TouchableOpacity style={{alignItems: 'center'}} onPress={() => addToCycle('ngay')}>
                    <View style={[dynamicStyles.iconBox, {backgroundColor: theme === 'dark' ? '#FDB813' : '#F59E0B'}]}><Ionicons name="sunny" size={18} color="white"/></View>
                    <Text style={{fontSize: 10, marginTop: 4, color: colors.text, fontWeight: 'bold'}}>+ Ngày</Text>
                </TouchableOpacity>
                <TouchableOpacity style={{alignItems: 'center'}} onPress={() => addToCycle('dem')}>
                     <View style={[dynamicStyles.iconBox, {backgroundColor: theme === 'dark' ? '#2DD4BF' : '#6366F1'}]}><Ionicons name="moon" size={18} color="white"/></View>
                     <Text style={{fontSize: 10, marginTop: 4, color: colors.text, fontWeight: 'bold'}}>+ Đêm</Text>
                </TouchableOpacity>
                <TouchableOpacity style={{alignItems: 'center'}} onPress={() => addToCycle('nghi')}>
                     <View style={[dynamicStyles.iconBox, {backgroundColor: theme === 'dark' ? '#FDA4AF' : '#78350F'}]}><Ionicons name="cafe" size={18} color="white"/></View>
                     <Text style={{fontSize: 10, marginTop: 4, color: colors.text, fontWeight: 'bold'}}>+ Nghỉ</Text>
                </TouchableOpacity>
                 <View style={{width: 1, backgroundColor: colors.border}}/>
                <TouchableOpacity style={{alignItems: 'center'}} onPress={removeLastStep}>
                     <View style={[dynamicStyles.iconBox, {backgroundColor: '#EF4444'}]}><Ionicons name="backspace" size={18} color="white"/></View>
                     <Text style={{fontSize: 10, marginTop: 4, color: colors.text}}>Xóa bước</Text>
                </TouchableOpacity>
                <TouchableOpacity style={{alignItems: 'center'}} onPress={resetCycle}>
                     <View style={[dynamicStyles.iconBox, {backgroundColor: colors.subText}]}><Ionicons name="refresh" size={18} color="white"/></View>
                     <Text style={{fontSize: 10, marginTop: 4, color: colors.text}}>Mặc định</Text>
                </TouchableOpacity>
            </View>
          </View>

          <Text style={dynamicStyles.sectionTitle}>🔔 CẤU HÌNH THÔNG BÁO</Text>
          <View style={dynamicStyles.card}>
            <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: ROW_PADDING}}>
              <Text style={{fontSize: 15, padding: 0, fontWeight:'bold', color: colors.subText}}>Bật thông báo nhắc nhở:</Text>
              <Switch value={isNotifEnabled} onValueChange={toggleSwitch} trackColor={{ false: "#E5E7EB", true: colors.primary }} thumbColor={"#fff"} />
            </View>
            
            {isNotifEnabled && (
              <>
                <View style={dynamicStyles.separator} />
                <TouchableOpacity style={{flexDirection: 'row', alignItems: 'center', padding: ROW_PADDING}} onPress={() => openPicker('timeDay')}>
                  <View style={dynamicStyles.iconBox}><Ionicons name="sunny" size={18} color="#FDB813" /></View>
                  <Text style={{flex: 1, fontSize: 16, marginLeft: 15, color: colors.text}}>Giờ nhắc Ca Ngày</Text>
                  <Text style={{fontSize: 16, fontWeight: 'bold', marginRight: 5, color: colors.primary}}>{format(timeDay, 'HH:mm')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={{flexDirection: 'row', alignItems: 'center', padding: ROW_PADDING}} onPress={() => openPicker('timeNight')}>
                  <View style={dynamicStyles.iconBox}><Ionicons name="moon" size={18} color="#60A5FA" /></View>
                  <Text style={{flex: 1, fontSize: 16, marginLeft: 15, color: colors.text}}>Giờ nhắc Ca Đêm</Text>
                  <Text style={{fontSize: 16, fontWeight: 'bold', marginRight: 5, color: colors.primary}}>{format(timeNight, 'HH:mm')}</Text>
                </TouchableOpacity>
                 <TouchableOpacity style={{flexDirection: 'row', alignItems: 'center', padding: ROW_PADDING}} onPress={() => openPicker('timeOff')}>
                  <View style={dynamicStyles.iconBox}><Ionicons name="cafe" size={18} color="#10B981" /></View>
                  <Text style={{flex: 1, fontSize: 16, marginLeft: 15, color: colors.text}}>Giờ nhắc Ngày Nghỉ</Text>
                  <Text style={{fontSize: 16, fontWeight: 'bold', marginRight: 5, color: colors.primary}}>{format(timeOff, 'HH:mm')}</Text>
                </TouchableOpacity>
                {/* [ĐÃ XÓA HOÀN TOÀN DÒNG 'NHẮC MẶC ĐỊNH'] */}
              </>
            )}
          </View>
          
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
                 <View style={{padding: ROW_PADDING, backgroundColor: colors.iconBg, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'}}>
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
                    <View style={[dynamicStyles.iconBox, {backgroundColor: '#DBEAFE'}]}><Ionicons name="cloud-upload" size={18} color="#2563EB" /></View>
                    <View style={{marginLeft: 15, flex: 1}}>
                       <Text style={[dynamicStyles.text, {fontWeight: 'bold'}]}>Sao lưu ngay</Text>
                       <Text style={{fontSize: 12, color: colors.subText}}>Đẩy dữ liệu lên mây</Text>
                    </View>
                    {isSyncing ? <ActivityIndicator size="small" color={colors.primary}/> : <Ionicons name="chevron-forward" size={18} color={colors.subText} />}
                 </TouchableOpacity>

                 <TouchableOpacity style={[dynamicStyles.syncBtn, {borderBottomWidth: 0}]} onPress={handleRestore} disabled={isSyncing}>
                    <View style={[dynamicStyles.iconBox, {backgroundColor: '#DCFCE7'}]}><Ionicons name="cloud-download" size={18} color="#16A34A" /></View>
                    <View style={{marginLeft: 15, flex: 1}}>
                       <Text style={[dynamicStyles.text, {fontWeight: 'bold'}]}>Khôi phục dữ liệu</Text>
                       <Text style={{fontSize: 12, color: colors.subText}}>Tải dữ liệu về máy</Text>
                    </View>
                    {isSyncing ? <ActivityIndicator size="small" color={colors.primary}/> : <Ionicons name="chevron-forward" size={18} color={colors.subText} />}
                 </TouchableOpacity>
               </View>
             )}
          </View>

          {/* GIAO DIỆN */}
          <Text style={dynamicStyles.sectionTitle}>🎨 GIAO DIỆN</Text>
          <View style={dynamicStyles.card}>
            <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: ROW_PADDING}}>
              <View style={{flexDirection: 'row', alignItems: 'center'}}>
                <View style={dynamicStyles.iconBox}><Ionicons name={theme === 'dark' ? "moon" : "sunny"} size={18} color={theme === 'dark' ? "#FDB813" : "#F59E0B"} /></View>
                <Text style={[dynamicStyles.text, {marginLeft: 15, fontSize: 16, fontWeight: '500'}]}>{theme === 'dark' ? 'Chế độ Tối' : 'Chế độ Sáng'}</Text>
              </View>
              <Switch value={theme === 'dark'} onValueChange={toggleTheme} trackColor={{ false: "#E5E7EB", true: colors.primary }} thumbColor={"#fff"} />
            </View>
          </View>
        
        </View>
      </ScrollView>

      {/* MODAL CÁC THỨ */}
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

      <Modal transparent={true} visible={showAuthModal} animationType="slide">
        <TouchableWithoutFeedback onPress={() => setShowAuthModal(false)}>
           <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={dynamicStyles.modalOverlay}>
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
                    <TextInput style={dynamicStyles.authInput} placeholder="email@example.com" placeholderTextColor={colors.subText} autoCapitalize="none" value={email} onChangeText={setEmail} />
                    <Text style={dynamicStyles.subText}>Mật khẩu:</Text>
                    <TextInput style={dynamicStyles.authInput} placeholder="******" placeholderTextColor={colors.subText} secureTextEntry value={password} onChangeText={setPassword} />
                    <TouchableOpacity style={dynamicStyles.authBtn} onPress={handleAuth}><Text style={{color: 'white', fontWeight: 'bold', fontSize: 16}}>{authMode === 'login' ? 'Đăng Nhập' : 'Đăng Ký Ngay'}</Text></TouchableOpacity>
                    <TouchableOpacity style={{marginTop: 15, alignItems: 'center'}} onPress={() => setAuthMode(authMode==='login'?'register':'login')}>
                        <Text style={{color: colors.primary}}>{authMode === 'login' ? 'Chưa có tài khoản? Đăng ký' : 'Đã có tài khoản? Đăng nhập'}</Text>
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