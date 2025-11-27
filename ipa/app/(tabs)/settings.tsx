import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, Text, View, TouchableOpacity, Alert, Platform, Switch, Modal, ScrollView 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker from '@react-native-community/datetimepicker';
import { format } from 'date-fns';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';

export default function SettingsScreen() {
  const { theme, toggleTheme, colors } = useTheme();
  
  const [startDate, setStartDate] = useState(new Date());
  const [isNotifEnabled, setIsNotifEnabled] = useState(false);
  
  // 4 mốc giờ cho các ca
  const [timeDay, setTimeDay] = useState(new Date(new Date().setHours(6, 0, 0, 0)));
  const [timeNight, setTimeNight] = useState(new Date(new Date().setHours(18, 0, 0, 0)));
  const [timeOff, setTimeOff] = useState(new Date(new Date().setHours(8, 0, 0, 0)));
  const [timeNormal, setTimeNormal] = useState(new Date(new Date().setHours(7, 0, 0, 0)));

  const [pickerMode, setPickerMode] = useState<'none' | 'date' | 'timeDay' | 'timeNight' | 'timeOff' | 'timeNormal'>('none');
  const [tempDate, setTempDate] = useState(new Date());

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const savedDate = await AsyncStorage.getItem('CYCLE_START_DATE');
      if (savedDate) setStartDate(new Date(savedDate));

      const savedEnabled = await AsyncStorage.getItem('NOTIF_ENABLED');
      if (savedEnabled) setIsNotifEnabled(JSON.parse(savedEnabled));

      const tDay = await AsyncStorage.getItem('TIME_DAY');
      if (tDay) setTimeDay(new Date(tDay));
      
      const tNight = await AsyncStorage.getItem('TIME_NIGHT');
      if (tNight) setTimeNight(new Date(tNight));

      const tOff = await AsyncStorage.getItem('TIME_OFF');
      if (tOff) setTimeOff(new Date(tOff));

      const tNormal = await AsyncStorage.getItem('TIME_NORMAL');
      if (tNormal) setTimeNormal(new Date(tNormal));

    } catch (e) { console.error('Lỗi load settings:', e); }
  };

  // Hàm này sẽ được gọi mỗi khi thay đổi giá trị picker (sau khi bấm Xong)
  const saveSettingItem = async (key: string, value: string) => {
      try {
          await AsyncStorage.setItem(key, value);
      } catch (e) { console.error('Lỗi lưu setting:', e); }
  };
  
  // Lưu trạng thái bật tắt thông báo ngay khi gạt nút
  const toggleSwitch = async () => {
      const newState = !isNotifEnabled;
      setIsNotifEnabled(newState);
      await saveSettingItem('NOTIF_ENABLED', JSON.stringify(newState));
  };

  const openPicker = (mode: typeof pickerMode) => {
    setPickerMode(mode);
    if (mode === 'date') setTempDate(startDate);
    if (mode === 'timeDay') setTempDate(timeDay);
    if (mode === 'timeNight') setTempDate(timeNight);
    if (mode === 'timeOff') setTempDate(timeOff);
    if (mode === 'timeNormal') setTempDate(timeNormal);
  };

  const confirmPicker = () => {
    // Lưu state và lưu vào AsyncStorage ngay lập tức
    if (pickerMode === 'date') {
        setStartDate(tempDate);
        saveSettingItem('CYCLE_START_DATE', tempDate.toISOString());
    }
    if (pickerMode === 'timeDay') {
        setTimeDay(tempDate);
        saveSettingItem('TIME_DAY', tempDate.toISOString());
    }
    if (pickerMode === 'timeNight') {
        setTimeNight(tempDate);
        saveSettingItem('TIME_NIGHT', tempDate.toISOString());
    }
    if (pickerMode === 'timeOff') {
        setTimeOff(tempDate);
        saveSettingItem('TIME_OFF', tempDate.toISOString());
    }
    if (pickerMode === 'timeNormal') {
        setTimeNormal(tempDate);
        saveSettingItem('TIME_NORMAL', tempDate.toISOString());
    }
    setPickerMode('none');
  };

  const onPickerChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setPickerMode('none');
      if (selectedDate) {
        // Android chọn xong là lưu luôn
        if (pickerMode === 'date') {
            setStartDate(selectedDate);
            saveSettingItem('CYCLE_START_DATE', selectedDate.toISOString());
        }
        if (pickerMode === 'timeDay') {
            setTimeDay(selectedDate);
            saveSettingItem('TIME_DAY', selectedDate.toISOString());
        }
        if (pickerMode === 'timeNight') {
            setTimeNight(selectedDate);
            saveSettingItem('TIME_NIGHT', selectedDate.toISOString());
        }
        if (pickerMode === 'timeOff') {
            setTimeOff(selectedDate);
            saveSettingItem('TIME_OFF', selectedDate.toISOString());
        }
        if (pickerMode === 'timeNormal') {
            setTimeNormal(selectedDate);
            saveSettingItem('TIME_NORMAL', selectedDate.toISOString());
        }
      }
    } else {
      if (selectedDate) setTempDate(selectedDate);
    }
  };

  // Style động theo theme
  const dynamicStyles = {
    container: { flex: 1, backgroundColor: colors.bg },
    headerTitle: { fontSize: 24, fontWeight: 'bold' as const, color: colors.text },
    sectionTitle: { fontSize: 14, fontWeight: 'bold' as const, color: colors.subText, marginBottom: 10, textTransform: 'uppercase' as const },
    card: { backgroundColor: colors.card, borderRadius: 16, padding: 5, borderWidth: 1, borderColor: colors.border },
    text: { color: colors.text },
    subText: { color: colors.subText },
    iconBox: { width: 36, height: 36, borderRadius: 10, backgroundColor: colors.iconBg, justifyContent: 'center' as const, alignItems: 'center' as const },
    separator: { height: 1, backgroundColor: colors.border, marginLeft: 65 },
    
    // Modal
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' as const },
    pickerContainer: { backgroundColor: colors.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 20, borderWidth: 1, borderColor: colors.border },
    pickerHeader: { flexDirection: 'row' as const, justifyContent: 'space-between' as const, padding: 15, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.iconBg, borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  };

  return (
    <SafeAreaView style={dynamicStyles.container} edges={['top']}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={styles.header}>
          <Text style={dynamicStyles.headerTitle}>Cài Đặt</Text>
          {/* Đã xóa nút Lưu ở đây */}
        </View>

        {/* GIAO DIỆN */}
        <View style={styles.section}>
          <Text style={dynamicStyles.sectionTitle}>🎨 GIAO DIỆN</Text>
          <View style={dynamicStyles.card}>
            <View style={styles.switchRow}>
              <View style={{flexDirection: 'row', alignItems: 'center'}}>
                <View style={dynamicStyles.iconBox}>
                  <Ionicons name={theme === 'dark' ? "moon" : "sunny"} size={20} color={theme === 'dark' ? "#FDB813" : "#F59E0B"} />
                </View>
                <Text style={[dynamicStyles.text, {marginLeft: 15, fontSize: 16, fontWeight: '500'}]}>
                  {theme === 'dark' ? 'Chế độ Tối (Dark Mode)' : 'Chế độ Sáng (Light Mode)'}
                </Text>
              </View>
              <Switch 
                value={theme === 'dark'} 
                onValueChange={toggleTheme}
                trackColor={{ false: "#E5E7EB", true: colors.primary }}
                thumbColor={"#fff"}
              />
            </View>
          </View>
        </View>
        
        {/* CHU KỲ */}
        <View style={styles.section}>
          <Text style={dynamicStyles.sectionTitle}>📅 CHU KỲ LÀM VIỆC</Text>
          <View style={dynamicStyles.card}>
            <Text style={[styles.instruction, dynamicStyles.subText]}>Ngày bắt đầu <Text style={{fontWeight: 'bold', color: colors.primary}}>CA NGÀY</Text> đầu tiên:</Text>
            <TouchableOpacity style={styles.rowBtn} onPress={() => openPicker('date')}>
              <View style={dynamicStyles.iconBox}><Ionicons name="calendar" size={20} color={colors.primary} /></View>
              <Text style={[styles.btnText, dynamicStyles.text]}>{format(startDate, 'dd/MM/yyyy')}</Text>
              <Ionicons name="chevron-forward" size={20} color={colors.subText} />
            </TouchableOpacity>
          </View>
        </View>

        {/* CẤU HÌNH THÔNG BÁO */}
        <View style={styles.section}>
          <Text style={dynamicStyles.sectionTitle}>🔔 CẤU HÌNH THÔNG BÁO</Text>
          <View style={dynamicStyles.card}>
            
            {/* Nút gạt Bật/Tắt */}
            <View style={styles.switchRow}>
              <Text style={[styles.instruction, dynamicStyles.subText, {padding: 0, fontWeight:'bold'}]}>Bật thông báo nhắc nhở:</Text>
              <Switch 
                value={isNotifEnabled} 
                onValueChange={toggleSwitch} // Tự động lưu khi gạt
                trackColor={{ false: "#E5E7EB", true: colors.primary }}
                thumbColor={"#fff"}
              />
            </View>
            
            {/* Chỉ hiện giờ khi bật thông báo */}
            {isNotifEnabled && (
              <>
                <View style={dynamicStyles.separator} />
                
                <TouchableOpacity style={styles.rowBtn} onPress={() => openPicker('timeDay')}>
                  <View style={dynamicStyles.iconBox}><Ionicons name="sunny" size={20} color="#FDB813" /></View>
                  <Text style={[styles.btnText, dynamicStyles.text]}>Giờ nhắc Ca Ngày</Text>
                  <Text style={[styles.timeValue, {color: colors.primary}]}>{format(timeDay, 'HH:mm')}</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.rowBtn} onPress={() => openPicker('timeNight')}>
                  <View style={dynamicStyles.iconBox}><Ionicons name="moon" size={20} color="#60A5FA" /></View>
                  <Text style={[styles.btnText, dynamicStyles.text]}>Giờ nhắc Ca Đêm</Text>
                  <Text style={[styles.timeValue, {color: colors.primary}]}>{format(timeNight, 'HH:mm')}</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.rowBtn} onPress={() => openPicker('timeOff')}>
                  <View style={dynamicStyles.iconBox}><Ionicons name="cafe" size={20} color="#10B981" /></View>
                  <Text style={[styles.btnText, dynamicStyles.text]}>Giờ nhắc Ngày Nghỉ</Text>
                  <Text style={[styles.timeValue, {color: colors.primary}]}>{format(timeOff, 'HH:mm')}</Text>
                </TouchableOpacity>

                <View style={dynamicStyles.separator} />

                <TouchableOpacity style={styles.rowBtn} onPress={() => openPicker('timeNormal')}>
                  <View style={dynamicStyles.iconBox}><Ionicons name="notifications" size={20} color={colors.subText} /></View>
                  <Text style={[styles.btnText, dynamicStyles.text]}>Giờ nhắc Mặc định</Text>
                  <Text style={[styles.timeValue, {color: colors.primary}]}>{format(timeNormal, 'HH:mm')}</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </ScrollView>

      {/* MODAL PICKER */}
      <Modal transparent={true} visible={pickerMode !== 'none'} animationType="slide">
        <View style={dynamicStyles.modalOverlay}>
          <View style={dynamicStyles.pickerContainer}>
            <View style={dynamicStyles.pickerHeader}>
              <TouchableOpacity onPress={() => setPickerMode('none')}>
                <Text style={{color: '#EF4444', fontSize: 16}}>Hủy</Text>
              </TouchableOpacity>
              <Text style={{fontWeight: 'bold', fontSize: 16, color: colors.text}}>
                {pickerMode === 'date' ? 'Chọn Ngày' : 'Chọn Giờ'}
              </Text>
              <TouchableOpacity onPress={confirmPicker}>
                <Text style={{color: colors.primary, fontWeight: 'bold', fontSize: 16}}>Xong</Text>
              </TouchableOpacity>
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

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { padding: 20, flexDirection: 'row', justifyContent: 'center', alignItems: 'center' }, // Header căn giữa vì không còn nút
  section: { marginTop: 20, paddingHorizontal: 20 },
  instruction: { fontSize: 15, padding: 15 },
  rowBtn: { flexDirection: 'row', alignItems: 'center', padding: 15 },
  btnText: { flex: 1, fontSize: 16, marginLeft: 15 },
  timeValue: { fontSize: 16, fontWeight: 'bold', marginRight: 5 },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 15 },
});