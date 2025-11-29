import React, { useState, useCallback } from 'react';
import { 
  StyleSheet, Text, View, TouchableOpacity, ScrollView, 
  Modal, TextInput, KeyboardAvoidingView, Platform, Alert 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { 
  format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, 
  eachDayOfInterval, addMonths, subMonths, isSameDay, isSameMonth, 
  differenceInCalendarDays, setHours, setMinutes 
} from 'date-fns';
import { useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../context/ThemeContext';
import { LinearGradient } from 'expo-linear-gradient';
import * as Notifications from 'expo-notifications';
// @ts-ignore
import { Solar } from 'lunar-javascript';

type NoteData = {
  type: 'ngay' | 'dem' | 'nghi' | '';
  noteLines: string[];
};

// [Hàm mới để xin quyền] Cấu hình xin quyền mạnh mẽ cho iOS
const requestNotificationsPermissions = async () => {
  const { status } = await Notifications.requestPermissionsAsync({
    ios: {
      allowAlert: true, // Cho phép hiển thị cảnh báo (bao gồm màn hình khóa)
      allowBadge: true, // Cho phép hiện số trên icon
      allowSound: true, // Cho phép âm thanh
     // allowAnnouncements: true, // Cho phép Siri đọc thông báo
    },
    android: {} // Giữ trống để dùng default
  });

  if (status !== 'granted') {
    // Không cần Alert ở đây vì màn hình chính có thể làm phiền
    console.log('Chưa có quyền thông báo.');
  }
};


export default function CalendarScreen() {
  const { colors, theme } = useTheme();
  const [currentMonth, setCurrentMonth] = useState(new Date()); 
  const [selectedDate, setSelectedDate] = useState<Date | null>(null); 
  const [modalVisible, setModalVisible] = useState(false);
  const [notes, setNotes] = useState<Record<string, NoteData>>({});
  const [cycleStartDate, setCycleStartDate] = useState<Date | null>(null);
  const [summaryMode, setSummaryMode] = useState<'date' | 'content'>('date');
  const [tempNotesList, setTempNotesList] = useState<string[]>([]);
  const [tempType, setTempType] = useState<'ngay' | 'dem' | 'nghi' | ''>('');
  
  const [isNotifEnabled, setIsNotifEnabled] = useState(false);
  const [times, setTimes] = useState({
    ngay: new Date(new Date().setHours(6,0,0,0)),
    dem: new Date(new Date().setHours(18,0,0,0)),
    nghi: new Date(new Date().setHours(8,0,0,0)),
    normal: new Date(new Date().setHours(7,0,0,0)),
  });

  useFocusEffect(
    useCallback(() => {
      const loadAllData = async () => {
        try {
          // [SỬA] Gọi hàm xin quyền mạnh mẽ hơn
          await requestNotificationsPermissions();
          
          const savedDate = await AsyncStorage.getItem('CYCLE_START_DATE');
          if (savedDate) setCycleStartDate(new Date(savedDate));

          const savedNotes = await AsyncStorage.getItem('CALENDAR_NOTES');
          if (savedNotes) setNotes(JSON.parse(savedNotes));

          const savedEnabled = await AsyncStorage.getItem('NOTIF_ENABLED');
          if (savedEnabled) setIsNotifEnabled(JSON.parse(savedEnabled));

          const tDay = await AsyncStorage.getItem('TIME_DAY');
          const tNight = await AsyncStorage.getItem('TIME_NIGHT');
          const tOff = await AsyncStorage.getItem('TIME_OFF');
          const tNormal = await AsyncStorage.getItem('TIME_NORMAL');

          setTimes({
            ngay: tDay ? new Date(tDay) : new Date(new Date().setHours(6,0,0,0)),
            dem: tNight ? new Date(tNight) : new Date(new Date().setHours(18,0,0,0)),
            nghi: tOff ? new Date(tOff) : new Date(new Date().setHours(8,0,0,0)),
            normal: tNormal ? new Date(tNormal) : new Date(new Date().setHours(7,0,0,0)),
          });

        } catch (e) { console.log('Lỗi load:', e); }
      };
      loadAllData();
    }, [])
  );

  const scheduleAutoNotification = async (date: Date, lines: string[], type: string) => {
    if (!isNotifEnabled) return;

    let selectedTime = times.normal;
    let prefixTitle = "Ghi chú";

    if (type === 'ngay') { selectedTime = times.ngay; prefixTitle = "Ca Ngày"; }
    else if (type === 'dem') { selectedTime = times.dem; prefixTitle = "Ca Đêm"; }
    else if (type === 'nghi') { selectedTime = times.nghi; prefixTitle = "Ngày Nghỉ"; }

    const triggerDate = setMinutes(setHours(date, selectedTime.getHours()), selectedTime.getMinutes());

    if (triggerDate.getTime() > new Date().getTime()) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: `🔔 Lịch: ${prefixTitle}`,
          body: lines.join('\n'),
          sound: true,
        },
        // @ts-ignore
        trigger: triggerDate,
      });
    }
  };

  const calculateAutoShift = (targetDate: Date) => {
    if (!cycleStartDate) return null;
    const diff = differenceInCalendarDays(targetDate, cycleStartDate);
    const remainder = (diff % 3 + 3) % 3;
    if (remainder === 0) return 'ngay';
    if (remainder === 1) return 'dem';
    if (remainder === 2) return 'nghi';
    return null;
  };

  const getLunarInfo = (date: Date) => {
    try {
      const solar = Solar.fromYmd(date.getFullYear(), date.getMonth() + 1, date.getDate());
      const lunar = solar.getLunar();
      if (lunar.getDay() === 1) return { text: `${lunar.getDay()}/${lunar.getMonth()}`, isFirstDay: true };
      return { text: `${lunar.getDay()}`, isFirstDay: false };
    } catch (e) { return { text: '', isFirstDay: false }; }
  };

  const renderIcon = (type: string, size: number = 12) => {
    switch (type) {
      case 'ngay': return <Ionicons name="sunny" size={size} color={theme === 'dark' ? "#FDB813" : "#F59E0B"} />;
      case 'dem': return <Ionicons name="moon" size={size} color={theme === 'dark' ? "#2DD4BF" : "#6366F1"} />;
      case 'nghi': return <Ionicons name="cafe" size={size} color={theme === 'dark' ? "#FDA4AF" : "#78350F"} />;
      default: return null;
    }
  };

  const handlePressDay = (date: Date) => {
    setSelectedDate(date);
    const dateKey = format(date, 'yyyy-MM-dd');
    const manualData = notes[dateKey];
    const autoType = calculateAutoShift(date);
    setTempType(manualData?.type || autoType || '');
    setTempNotesList(manualData?.noteLines?.length ? [...manualData.noteLines] : ['']);
    setModalVisible(true);
  };

  const handleAddNoteLine = () => setTempNotesList([...tempNotesList, '']);
  const handleChangeNoteLine = (text: string, index: number) => {
    const newList = [...tempNotesList];
    newList[index] = text;
    setTempNotesList(newList);
  };

  const handleDeleteNoteLine = (index: number) => {
    const newList = [...tempNotesList];
    newList.splice(index, 1);
    setTempNotesList(newList);
  };

  const handleSave = async () => {
    if (selectedDate) {
      const dateKey = format(selectedDate, 'yyyy-MM-dd');
      let newNotes = { ...notes };
      const cleanLines = tempNotesList.filter(line => line.trim() !== '');

      if (tempType === '' && cleanLines.length === 0) {
        delete newNotes[dateKey];
      } else {
        newNotes[dateKey] = { type: tempType, noteLines: cleanLines };
        if (cleanLines.length > 0) {
           await scheduleAutoNotification(selectedDate, cleanLines, tempType);
        }
      }

      setNotes(newNotes);
      setModalVisible(false);
      try { await AsyncStorage.setItem('CALENDAR_NOTES', JSON.stringify(newNotes)); } catch (e) {}
    }
  };

  const getNotesByDate = () => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    return eachDayOfInterval({ start, end }).map(day => {
      const dateKey = format(day, 'yyyy-MM-dd');
      const data = notes[dateKey];
      if (data?.noteLines?.length > 0) return { date: day, noteLines: data.noteLines };
      return null;
    }).filter(item => item !== null) as { date: Date, noteLines: string[] }[];
  };

  const getNotesByContent = () => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    const byDateList = eachDayOfInterval({ start, end }).map(day => {
      const dateKey = format(day, 'yyyy-MM-dd');
      const data = notes[dateKey];
      if (data?.noteLines?.length > 0) return { date: day, noteLines: data.noteLines };
      return null;
    }).filter(item => item !== null) as { date: Date, noteLines: string[] }[];

    const aggregator: Record<string, string[]> = {};
    byDateList.forEach(item => {
      const dayStr = format(item.date, 'd'); 
      item.noteLines.forEach(line => {
        const parts = line.split(/[,;]+/); 
        parts.forEach(part => {
          const key = part.trim(); 
          if (key) {
            if (!aggregator[key]) aggregator[key] = [];
            if (!aggregator[key].includes(dayStr)) aggregator[key].push(dayStr);
          }
        });
      });
    });
    return Object.keys(aggregator).map(key => ({ name: key, days: aggregator[key].join(', ') }));
  };

  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 1 }),
    end: endOfWeek(endOfMonth(currentMonth), { weekStartsOn: 1 })
  });
  const weekDays = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
  const summaryListDate = getNotesByDate();
  const summaryListContent = getNotesByContent();

  const gridBorderColor = theme === 'dark' ? 'rgba(255,255,255,0.15)' : '#E5E7EB';

  return (
    <LinearGradient colors={theme === 'dark' ? ['#2e1065', '#0f172a'] : ['#F8FAFC', '#F8FAFC']} style={{flex: 1}}>
      <SafeAreaView style={{flex: 1}} edges={['top']}>
        <ScrollView contentContainerStyle={{ paddingBottom: 80, paddingTop: 10 }}>
          
          {/* LỊCH */}
          <View style={[styles.calendarContainer, { borderColor: gridBorderColor }]}>
            <View style={styles.monthNav}>
              <TouchableOpacity onPress={() => setCurrentMonth(subMonths(currentMonth, 1))}><Ionicons name="chevron-back" size={24} color={colors.text} /></TouchableOpacity>
              <Text style={[styles.monthTitle, {color: colors.text}]}>Tháng {format(currentMonth, 'MM yyyy')}</Text>
              <TouchableOpacity onPress={() => setCurrentMonth(addMonths(currentMonth, 1))}><Ionicons name="chevron-forward" size={24} color={colors.text} /></TouchableOpacity>
            </View>
            
           {/* [SỬA] HÀNG TIÊU ĐỀ THỨ - CÓ VIỀN VÀ NỀN */}
            <View style={styles.weekHeaderRow}>
              {weekDays.map((day, index) => {
                const isSunday = index === 6;
                
                // --- CẤU HÌNH MÀU CHO T2 - T7 ---
                // Bạn có thể đổi mã màu hex ở đây theo ý thích
                const normalDayBg = theme === 'dark' ? 'rgba(56, 189, 248, 0.15)' : '#E0F2FE'; // Xanh dương nhạt
                const normalDayBorder = theme === 'dark' ? 'rgba(56, 189, 248, 0.5)' : '#BAE6FD'; // Viền xanh
                const normalDayText = theme === 'dark' ? '#BAE6FD' : '#0369A1'; // Chữ xanh đậm

                return (
                  <View 
                    key={index} 
                    style={[
                      styles.headerCell,
                      {
                        // Logic chọn màu nền: Nếu là CN thì màu đỏ, nếu không thì màu Xanh (normalDayBg)
                        backgroundColor: isSunday 
                          ? (theme === 'dark' ? 'rgba(239, 68, 68, 0.2)' : '#FEE2E2') 
                          : normalDayBg, 

                        // Logic chọn màu viền
                        borderColor: isSunday ? '#EF4444' : normalDayBorder,
                        
                        borderWidth: 1,
                        borderRadius: 8,
                        marginHorizontal: 2, 
                      }
                    ]}
                  >
                    <Text style={[
                      styles.weekText, 
                      { 
                        // Logic chọn màu chữ
                        color: isSunday ? '#EF4444' : normalDayText 
                      }
                    ]}>
                      {day}
                    </Text>
                  </View>
                );
              })}
            </View>
            
            {/* LƯỚI LỊCH */}
            <View style={[styles.gridContainer, { borderTopWidth: 0 }]}>
              {days.map((day, index) => {
                const dateKey = format(day, 'yyyy-MM-dd');
                const isCurrentMonth = isSameMonth(day, currentMonth);
                const lunarInfo = getLunarInfo(day);
                const manualData = notes[dateKey];
                const autoType = calculateAutoShift(day);
                const displayType = manualData?.type || autoType;
                const displayLines = manualData?.noteLines || [];
                const isToday = isSameDay(day, new Date());
                const isSelected = selectedDate && isSameDay(day, selectedDate);
                
                // Logic màu nền ô ngày
                let cellBg = 'transparent';
                let currentBorderColor = gridBorderColor;
                let currentBorderWidth = 0.5;

                if (isSelected) {
                    cellBg = colors.primary + '20'; 
                    currentBorderColor = colors.primary;
                    currentBorderWidth = 2;
                } else if (isToday) {
                    cellBg = theme === 'dark' ? 'rgba(253, 224, 71, 0.15)' : '#FEF9C3'; 
                    currentBorderColor = '#F59E0B';
                    currentBorderWidth = 1;
                } else if (displayType === 'nghi') {
                    cellBg = theme === 'dark' ? 'rgba(255,255,255,0.05)' : '#F8FAFC';
                }

                return (
                  <TouchableOpacity 
                    key={index} 
                    style={[
                      styles.cell, 
                      { 
                        backgroundColor: cellBg, 
                        borderColor: currentBorderColor,
                        borderWidth: currentBorderWidth,
                      }
                    ]} 
                    onPress={() => handlePressDay(day)}
                  >
                    <View style={styles.cellHeader}>
                      <Text style={[
                        styles.solarText, 
                        { 
                          color: isCurrentMonth ? colors.text : colors.subText,
                          fontWeight: isToday ? 'bold' : 'normal'
                        }
                      ]}>
                        {format(day, 'd')}
                      </Text>
                      <Text style={[styles.lunarText, {color: colors.subText}, lunarInfo.isFirstDay && {color: '#EF4444', fontWeight: 'bold'}]}>{lunarInfo.text}</Text>
                    </View>
                    
                    <View style={{marginTop: 4, flex: 1}}> 
                      {displayLines.slice(0, 3).map((line, i) => (
                          <Text key={i} numberOfLines={1} style={{fontSize: 8.5, color: colors.text, marginBottom: 1, fontWeight: '500'}}>
                              {line}
                          </Text>
                      ))}
                      {displayLines.length > 3 && <Text style={{fontSize: 8, color: colors.subText}}>...</Text>}
                    </View>

                    {displayType && <View style={styles.bottomRightIcon}>{renderIcon(displayType, 12)}</View>}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* BẢNG TỔNG HỢP */}
          <View style={styles.separator} />
          <View style={styles.toolbar}>
             <Text style={[styles.toolbarTitle, {color: colors.text}]}>Tổng Hợp Ghi Chú</Text>
             <View style={[styles.switchContainer, {backgroundColor: colors.iconBg}]}>
                <TouchableOpacity style={[styles.switchBtn, summaryMode === 'date' && {backgroundColor: colors.card}]} onPress={() => setSummaryMode('date')}>
                  <Text style={{color: summaryMode === 'date' ? colors.primary : colors.subText, fontWeight:'bold'}}>Theo Ngày</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.switchBtn, summaryMode === 'content' && {backgroundColor: colors.card}]} onPress={() => setSummaryMode('content')}>
                  <Text style={{color: summaryMode === 'content' ? colors.primary : colors.subText, fontWeight:'bold'}}>Theo Tên</Text>
                </TouchableOpacity>
             </View>
          </View>

          <View style={styles.summaryTable}>
            {summaryMode === 'date' ? (
              summaryListDate.length === 0 ? <Text style={{textAlign: 'center', color: colors.subText, fontStyle: 'italic', marginTop: 20}}>Tháng này trống.</Text> :
              summaryListDate.map((item, idx) => (
                <View key={idx} style={[styles.glassRow, {backgroundColor: colors.card, borderColor: colors.border}]}>
                   <View style={[styles.dateBadge, {backgroundColor: colors.iconBg}]}>
                      <Text style={{fontSize: 16, fontWeight: 'bold', color: colors.primary}}>{format(item.date, 'dd')}</Text>
                      <Text style={{fontSize: 10, color: colors.subText}}>{format(item.date, 'EEE')}</Text>
                   </View>
                   <View style={{flex: 1}}>{item.noteLines.map((l,i) => <Text key={i} style={{color: colors.text}}>• {l}</Text>)}</View>
                </View>
              ))
            ) : (
              summaryListContent.map((item, idx) => (
                <View key={idx} style={[styles.glassRow, {backgroundColor: colors.card, borderColor: colors.border}]}>
                   <View style={[styles.dateBadge, {backgroundColor: colors.iconBg}]}><Text style={{color: colors.primary, fontWeight:'bold'}}>{item.name.charAt(0).toUpperCase()}</Text></View>
                   <View style={{flex: 1}}><Text style={{color: colors.primary, fontWeight:'bold'}}>{item.name}</Text><Text style={{color: colors.subText}}>Ngày: {item.days}</Text></View>
                </View>
              ))
            )}
          </View>
        </ScrollView>

        <Modal visible={modalVisible} animationType="fade" transparent>
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.modalOverlay}>
            <View style={[styles.modalContent, {backgroundColor: colors.card, borderColor: colors.border}]}>
              <View style={styles.modalHeader}>
                <Text style={{fontSize: 18, fontWeight: 'bold', color: colors.text}}>{selectedDate ? format(selectedDate, 'dd/MM/yyyy') : ''}</Text>
                <TouchableOpacity onPress={() => setModalVisible(false)}><Ionicons name="close" size={24} color={colors.text} /></TouchableOpacity>
              </View>
              
              <View style={styles.optionRow}>
                <TouchableOpacity style={[styles.optionBtn, {borderColor: colors.border, backgroundColor: colors.iconBg}]} onPress={() => setTempType('ngay')}><Ionicons name="sunny" size={24} color={theme==='dark'?"#FDB813":"#F59E0B"} /><Text style={{color: colors.text, marginTop: 5}}>Ngày</Text></TouchableOpacity>
                <TouchableOpacity style={[styles.optionBtn, {borderColor: colors.border, backgroundColor: colors.iconBg}]} onPress={() => setTempType('dem')}><Ionicons name="moon" size={24} color={theme==='dark'?"#2DD4BF":"#6366F1"} /><Text style={{color: colors.text, marginTop: 5}}>Đêm</Text></TouchableOpacity>
                <TouchableOpacity style={[styles.optionBtn, {borderColor: colors.border, backgroundColor: colors.iconBg}]} onPress={() => setTempType('nghi')}><Ionicons name="cafe" size={24} color={theme==='dark'?"#FDA4AF":"#78350F"} /><Text style={{color: colors.text, marginTop: 5}}>Nghỉ</Text></TouchableOpacity>
              </View>

              <ScrollView style={{maxHeight: 200}}>
                {tempNotesList.map((note, index) => (
                  <View key={index} style={[styles.inputRow, { flexDirection: 'row', alignItems: 'center' }]}>
                    <TextInput 
                      style={[styles.inputMulti, {backgroundColor: colors.iconBg, color: colors.text, borderColor: colors.border, flex: 1}]} 
                      placeholder={`Ghi chú ${index + 1}...`} placeholderTextColor={colors.subText}
                      value={note} onChangeText={(text) => handleChangeNoteLine(text, index)} 
                    />
                    <TouchableOpacity onPress={() => handleDeleteNoteLine(index)} style={{marginLeft: 10, padding: 5}}>
                        <Ionicons name="trash-outline" size={20} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
              <TouchableOpacity style={styles.addMoreBtn} onPress={handleAddNoteLine}><Ionicons name="add-circle-outline" size={20} color={colors.primary} /><Text style={{color: colors.primary, marginLeft: 5}}>Thêm dòng</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.saveBtn, {backgroundColor: colors.primary}]} onPress={handleSave}><Text style={{color: 'white', fontWeight: 'bold'}}>Lưu</Text></TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </Modal>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  calendarContainer: { 
    marginHorizontal: 10, borderRadius: 16, 
    backgroundColor: 'rgba(255,255,255,0.02)', // Nền mờ
    borderWidth: 0, // Bỏ viền ngoài để viền ô tự lo
    paddingBottom: 5 
  },
  monthNav: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 15 },
  monthTitle: { fontSize: 20, fontWeight: 'bold' },
  
  // [SỬA] Style hàng tiêu đề thứ
  weekHeaderRow: { flexDirection: 'row', marginBottom: 10, paddingHorizontal: 5 },
  headerCell: { 
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingVertical: 8
  },
  weekText: { fontWeight: 'bold', fontSize: 13 },
  
  gridContainer: { flexDirection: 'row', flexWrap: 'wrap', padding: 2 },
  
  // [SỬA] Style ô lịch
  cell: { 
    width: '13.5%', // Cân chỉnh
    height: 95, 
    margin: '0.3%', // Tách rời
    borderRadius: 14, // Bo tròn
    padding: 4, 
    position: 'relative' 
  },
  
  cellHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  solarText: { fontSize: 15, fontWeight: 'bold' },
  lunarText: { fontSize: 9, marginTop: 2 },
  bottomRightIcon: { position: 'absolute', bottom: 4, right: 4 },
  separator: { height: 20 },
  toolbar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginBottom: 15 },
  toolbarTitle: { fontSize: 18, fontWeight: 'bold' },
  switchContainer: { flexDirection: 'row', borderRadius: 12, padding: 3 },
  switchBtn: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 10 },
  summaryTable: { paddingHorizontal: 15 },
  glassRow: { flexDirection: 'row', padding: 12, marginBottom: 10, borderRadius: 16, alignItems: 'center', borderWidth: 1 },
  dateBadge: { width: 45, height: 45, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalContent: { width: '100%', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, borderWidth: 1 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  optionRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15 },
  optionBtn: { paddingVertical: 15, borderWidth: 1, borderRadius: 16, width: '30%', alignItems: 'center' },
  inputRow: { marginBottom: 10 },
  inputMulti: { borderWidth: 1, borderRadius: 12, padding: 12, fontSize: 14 },
  addMoreBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 10, borderStyle: 'dashed', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', borderRadius: 12, marginTop: 5 },
  saveBtn: { padding: 16, borderRadius: 16, alignItems: 'center', marginTop: 20 },
});