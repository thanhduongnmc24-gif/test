import React, { useState, useCallback, useMemo } from 'react';
import { 
  StyleSheet, Text, View, TouchableOpacity, ScrollView, 
  Modal, TextInput, KeyboardAvoidingView, Platform, Alert, FlatList 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { 
  format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, 
  eachDayOfInterval, addMonths, subMonths, isSameDay, isSameMonth, 
  differenceInMinutes, parseISO 
} from 'date-fns';
import { useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../context/ThemeContext';
import { LinearGradient } from 'expo-linear-gradient';
import DateTimePicker from '@react-native-community/datetimepicker'; 
// @ts-ignore
import { Solar } from 'lunar-javascript';

// Kiểu dữ liệu
type WorkLog = {
  id: string;
  date: string; 
  employeeName: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
};

export default function CalendarScreen() {
  const { colors, theme } = useTheme();
  
  // --- STATE ---
  const [currentMonth, setCurrentMonth] = useState(new Date()); 
  const [selectedDate, setSelectedDate] = useState<Date | null>(null); 
  const [logs, setLogs] = useState<WorkLog[]>([]);

  // Modal Nhập Liệu
  const [modalVisible, setModalVisible] = useState(false);
  const [empName, setEmpName] = useState('');
  const [startTime, setStartTime] = useState(new Date());
  const [endTime, setEndTime] = useState(new Date());
  const [showTimePicker, setShowTimePicker] = useState<'start' | 'end' | null>(null);

  // Modal Chi Tiết Nhân Viên (Mới)
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedEmpDetail, setSelectedEmpDetail] = useState<string | null>(null);

  // Chế độ xem tổng hợp
  const [summaryMode, setSummaryMode] = useState<'date' | 'employee'>('date');

  // Load Data
  useFocusEffect(
    useCallback(() => {
      const loadData = async () => {
        try {
          const savedLogs = await AsyncStorage.getItem('TIMEKEEPING_LOGS');
          if (savedLogs) setLogs(JSON.parse(savedLogs));
        } catch (e) { console.log('Lỗi load:', e); }
      };
      loadData();
    }, [])
  );

  const saveLogs = async (newLogs: WorkLog[]) => {
    setLogs(newLogs);
    await AsyncStorage.setItem('TIMEKEEPING_LOGS', JSON.stringify(newLogs));
  };

  // --- LOGIC TÍNH TOÁN ---
  const calculateDuration = (start: Date, end: Date) => {
    let diff = differenceInMinutes(end, start);
    if (diff < 0) diff += 1440; // Qua đêm
    return diff;
  };

  const formatDuration = (minutes: number) => {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${h}h${m > 0 ? m : ''}`; 
  };
  
  const formatDurationFull = (minutes: number) => {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    const decimal = (minutes / 60).toFixed(1).replace('.', ',');
    return `${h} giờ ${m} phút (${decimal} giờ)`;
  };

  const getLunarInfo = (date: Date) => {
    try {
      const solar = Solar.fromYmd(date.getFullYear(), date.getMonth() + 1, date.getDate());
      const lunar = solar.getLunar();
      if (lunar.getDay() === 1) return { text: `${lunar.getDay()}/${lunar.getMonth()}`, isFirstDay: true };
      return { text: `${lunar.getDay()}`, isFirstDay: false };
    } catch (e) { return { text: '', isFirstDay: false }; }
  };

  // --- HANDLERS ---
  const handlePressDay = (date: Date) => {
    setSelectedDate(date);
    // Reset form
    const now = new Date();
    setStartTime(now);
    setEndTime(now);
    setEmpName('');
    setModalVisible(true);
  };

  // Xử lý chọn giờ (Fix lỗi không nhập được)
  const onChangeTime = (event: any, selectedDate?: Date) => {
    const type = showTimePicker;
    if (Platform.OS === 'android') {
        setShowTimePicker(null); // Tắt picker ngay trên Android sau khi chọn
    }
    
    if (selectedDate && type) {
        if (type === 'start') setStartTime(selectedDate);
        else setEndTime(selectedDate);
    }
  };

  const handleAddLog = () => {
    if (!empName.trim() || !selectedDate) return Alert.alert("Thiếu tên", "Nhập tên nhân viên đi anh hai!");
    
    // Làm tròn giây về 0
    const s = new Date(startTime); s.setSeconds(0); s.setMilliseconds(0);
    const e = new Date(endTime); e.setSeconds(0); e.setMilliseconds(0);
    
    const duration = calculateDuration(s, e);
    
    const newLog: WorkLog = {
      id: Date.now().toString(),
      date: selectedDate.toISOString(),
      employeeName: empName.trim(),
      startTime: s.toISOString(),
      endTime: e.toISOString(),
      durationMinutes: duration
    };

    saveLogs([...logs, newLog]);
    // Không đóng Modal ngay để còn nhập người khác, chỉ reset tên
    setEmpName('');
    Alert.alert("Đã lưu", "Thêm thành công! Nhập tiếp người khác hoặc đóng.");
  };

  const handleDeleteLog = (id: string) => {
    Alert.alert("Xác nhận xóa", "Anh có chắc muốn xóa dòng chấm công này không?", [
      { text: "Hủy", style: "cancel" },
      { text: "Xóa luôn", style: "destructive", onPress: () => {
          saveLogs(logs.filter(l => l.id !== id));
      }}
    ]);
  };

  // Xem chi tiết nhân viên
  const handleViewEmployeeDetail = (name: string) => {
    setSelectedEmpDetail(name);
    setDetailModalVisible(true);
  };

  // --- DATA PROCESSING ---
  const getLogsForDay = (date: Date) => logs.filter(l => isSameDay(parseISO(l.date), date));

  // Lọc log cho Modal Chi tiết (Chỉ lấy tháng hiện tại + Tên đã chọn)
  const getDetailLogs = () => {
    if (!selectedEmpDetail) return [];
    return logs.filter(l => 
        l.employeeName === selectedEmpDetail && 
        isSameMonth(parseISO(l.date), currentMonth)
    ).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  };

  const summaryData = useMemo(() => {
    const monthlyLogs = logs.filter(l => isSameMonth(parseISO(l.date), currentMonth));

    if (summaryMode === 'date') {
        const grouped: Record<string, WorkLog[]> = {};
        monthlyLogs.forEach(log => {
            const d = log.date.split('T')[0];
            if (!grouped[d]) grouped[d] = [];
            grouped[d].push(log);
        });
        return Object.keys(grouped).sort().reverse().map(dateStr => ({
            type: 'date', key: dateStr, date: parseISO(dateStr), items: grouped[dateStr]
        }));
    } else {
        const grouped: Record<string, number> = {};
        monthlyLogs.forEach(log => {
            grouped[log.employeeName] = (grouped[log.employeeName] || 0) + log.durationMinutes;
        });
        return Object.keys(grouped).map(name => ({
            type: 'employee', key: name, name: name, totalMinutes: grouped[name]
        })).sort((a, b) => b.totalMinutes - a.totalMinutes);
    }
  }, [logs, currentMonth, summaryMode]);

  // Calendar Setup
  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 1 }),
    end: endOfWeek(endOfMonth(currentMonth), { weekStartsOn: 1 })
  });
  const weekDays = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
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
            
            <View style={styles.weekHeaderRow}>
              {weekDays.map((day, index) => {
                const isSunday = index === 6;
                const normalDayBg = theme === 'dark' ? 'rgba(56, 189, 248, 0.15)' : '#E0F2FE'; 
                const normalDayBorder = theme === 'dark' ? 'rgba(56, 189, 248, 0.5)' : '#BAE6FD'; 
                return (
                  <View key={index} style={[styles.headerCell, {
                        backgroundColor: isSunday ? (theme === 'dark' ? 'rgba(239, 68, 68, 0.2)' : '#FEE2E2') : normalDayBg, 
                        borderColor: isSunday ? '#EF4444' : normalDayBorder, borderWidth: 1, borderRadius: 8, marginHorizontal: 2 
                  }]}>
                    <Text style={[styles.weekText, { color: isSunday ? '#EF4444' : (theme === 'dark' ? '#BAE6FD' : '#0369A1') }]}>{day}</Text>
                  </View>
                );
              })}
            </View>
            
            <View style={[styles.gridContainer, { borderTopWidth: 0 }]}>
              {days.map((day, index) => {
                const isCurrentMonth = isSameMonth(day, currentMonth);
                const lunarInfo = getLunarInfo(day);
                const dayLogs = getLogsForDay(day);
                const isToday = isSameDay(day, new Date());
                const isSelected = selectedDate && isSameDay(day, selectedDate);
                
                let cellBg = 'transparent';
                let currentBorderColor = gridBorderColor;
                let currentBorderWidth = 0.5;

                if (isSelected) {
                    cellBg = colors.primary + '20'; currentBorderColor = colors.primary; currentBorderWidth = 2;
                } else if (isToday) {
                    cellBg = theme === 'dark' ? 'rgba(253, 224, 71, 0.15)' : '#FEF9C3'; currentBorderColor = '#F59E0B'; currentBorderWidth = 1;
                }

                return (
                  <TouchableOpacity key={index} style={[styles.cell, { backgroundColor: cellBg, borderColor: currentBorderColor, borderWidth: currentBorderWidth }]} onPress={() => handlePressDay(day)}>
                    <View style={styles.cellHeader}>
                      <Text style={[styles.solarText, { color: isCurrentMonth ? colors.text : colors.subText, fontWeight: isToday ? 'bold' : 'normal' }]}>{format(day, 'd')}</Text>
                      <Text style={[styles.lunarText, {color: colors.subText}, lunarInfo.isFirstDay && {color: '#EF4444', fontWeight: 'bold'}]}>{lunarInfo.text}</Text>
                    </View>
                    <View style={{marginTop: 4, flex: 1}}> 
                      {dayLogs.slice(0, 3).map((l, i) => (
                        <Text key={i} numberOfLines={1} style={{fontSize: 8.5, color: colors.primary, marginBottom: 1, fontWeight: 'bold'}}>
                            {l.employeeName}: {formatDuration(l.durationMinutes)}
                        </Text>
                      ))}
                      {dayLogs.length > 3 && <Text style={{fontSize: 8, color: colors.subText}}>...</Text>}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* BẢNG TỔNG HỢP */}
          <View style={styles.separator} />
          <View style={styles.toolbar}>
             <Text style={[styles.toolbarTitle, {color: colors.text}]}>Tổng Hợp Tháng</Text>
             <View style={[styles.switchContainer, {backgroundColor: colors.iconBg}]}>
                <TouchableOpacity style={[styles.switchBtn, summaryMode === 'date' && {backgroundColor: colors.card}]} onPress={() => setSummaryMode('date')}>
                  <Text style={{color: summaryMode === 'date' ? colors.primary : colors.subText, fontWeight:'bold'}}>Ngày</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.switchBtn, summaryMode === 'employee' && {backgroundColor: colors.card}]} onPress={() => setSummaryMode('employee')}>
                  <Text style={{color: summaryMode === 'employee' ? colors.primary : colors.subText, fontWeight:'bold'}}>Tên</Text>
                </TouchableOpacity>
             </View>
          </View>

          <View style={styles.summaryTable}>
            {summaryData.length === 0 ? (
                <Text style={{textAlign: 'center', color: colors.subText, fontStyle: 'italic', marginTop: 20}}>Chưa có dữ liệu chấm công.</Text>
            ) : (
                summaryData.map((item: any, idx) => {
                    if (summaryMode === 'date') {
                        return (
                            <View key={idx} style={[styles.glassRow, {backgroundColor: colors.card, borderColor: colors.border}]}>
                                <View style={[styles.dateBadge, {backgroundColor: colors.iconBg}]}>
                                    <Text style={{fontSize: 16, fontWeight: 'bold', color: colors.primary}}>{format(item.date, 'dd')}</Text>
                                    <Text style={{fontSize: 10, color: colors.subText}}>{format(item.date, 'EEE')}</Text>
                                </View>
                                <View style={{flex: 1}}>
                                    {item.items.map((log: WorkLog, i: number) => (
                                        <View key={i} style={{flexDirection: 'row', justifyContent:'space-between', marginBottom: 2}}>
                                            <Text style={{color: colors.text, fontWeight:'500'}}>{log.employeeName}</Text>
                                            <Text style={{color: colors.success}}>
                                                {format(parseISO(log.startTime), 'HH:mm')}-{format(parseISO(log.endTime), 'HH:mm')} ({formatDuration(log.durationMinutes)})
                                            </Text>
                                        </View>
                                    ))}
                                </View>
                            </View>
                        );
                    } else {
                        // CHẾ ĐỘ XEM THEO TÊN (Bấm vào để xem chi tiết)
                        return (
                            <TouchableOpacity key={idx} onPress={() => handleViewEmployeeDetail(item.name)}>
                                <View style={[styles.compactRow, {backgroundColor: colors.card, borderColor: colors.border}]}>
                                    <View style={{flexDirection:'row', justifyContent:'space-between', alignItems:'center'}}>
                                    <View style={{flexDirection:'row', alignItems:'center'}}>
                                        <View style={{width: 30, height: 30, borderRadius: 15, backgroundColor: colors.iconBg, justifyContent:'center', alignItems:'center', marginRight: 10}}>
                                            <Text style={{fontWeight:'bold', color: colors.primary}}>{item.name.charAt(0).toUpperCase()}</Text>
                                        </View>
                                        <Text style={{fontSize: 16, fontWeight:'bold', color: colors.text}}>{item.name}</Text>
                                    </View>
                                    <View style={{flexDirection: 'row', alignItems: 'center'}}>
                                        <Text style={{fontSize: 16, fontWeight:'bold', color: colors.success, marginRight: 5}}>
                                            {formatDurationFull(item.totalMinutes)}
                                        </Text>
                                        <Ionicons name="chevron-forward" size={16} color={colors.subText} />
                                    </View>
                                    </View>
                                </View>
                            </TouchableOpacity>
                        );
                    }
                })
            )}
          </View>
        </ScrollView>

        {/* MODAL 1: NHẬP CHẤM CÔNG */}
        <Modal visible={modalVisible} animationType="fade" transparent>
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.modalOverlay}>
            <View style={[styles.modalContent, {backgroundColor: colors.card, borderColor: colors.border}]}>
              <View style={styles.modalHeader}>
                <Text style={{fontSize: 18, fontWeight: 'bold', color: colors.text}}>
                    {selectedDate ? format(selectedDate, 'dd/MM/yyyy') : ''}
                </Text>
                <TouchableOpacity onPress={() => setModalVisible(false)}><Ionicons name="close" size={24} color={colors.text} /></TouchableOpacity>
              </View>
              
              <View style={{marginBottom: 10}}>
                 <Text style={{color: colors.subText, marginBottom: 5, fontSize: 12}}>Tên nhân viên:</Text>
                 <TextInput 
                      style={[styles.inputMulti, {backgroundColor: colors.iconBg, color: colors.text, borderColor: colors.border}]} 
                      placeholder="Nhập tên..." placeholderTextColor={colors.subText}
                      value={empName} onChangeText={setEmpName} 
                  />

                 <View style={{flexDirection: 'row', justifyContent: 'space-between', marginTop: 15}}>
                      <TouchableOpacity onPress={() => setShowTimePicker('start')} style={[styles.timeBox, {borderColor: colors.border, backgroundColor: colors.iconBg}]}>
                         <Text style={{color: colors.subText, fontSize: 11}}>Giờ vào</Text>
                         <Text style={{color: colors.primary, fontWeight: 'bold', fontSize: 18}}>{format(startTime, 'HH:mm')}</Text>
                      </TouchableOpacity>
                      <View style={{justifyContent:'center'}}><Ionicons name="arrow-forward" color={colors.subText} size={20}/></View>
                      <TouchableOpacity onPress={() => setShowTimePicker('end')} style={[styles.timeBox, {borderColor: colors.border, backgroundColor: colors.iconBg}]}>
                         <Text style={{color: colors.subText, fontSize: 11}}>Giờ ra</Text>
                         <Text style={{color: colors.primary, fontWeight: 'bold', fontSize: 18}}>{format(endTime, 'HH:mm')}</Text>
                      </TouchableOpacity>
                 </View>
                 
                 <TouchableOpacity style={[styles.saveBtn, {backgroundColor: colors.primary}]} onPress={handleAddLog}>
                    <Text style={{color: 'white', fontWeight: 'bold'}}>Lưu / Thêm</Text>
                 </TouchableOpacity>

                 {/* DANH SÁCH ĐÃ CHẤM TRONG NGÀY (CÓ NÚT XÓA) */}
                 {selectedDate && getLogsForDay(selectedDate).length > 0 && (
                     <View style={{marginTop: 20, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.border, maxHeight: 150}}>
                         <Text style={{color: colors.subText, fontSize: 12, marginBottom: 5}}>Danh sách đã chấm ngày này:</Text>
                         <ScrollView nestedScrollEnabled>
                            {getLogsForDay(selectedDate).map((l, i) => (
                                <View key={i} style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, padding: 8, backgroundColor: colors.bg, borderRadius: 8}}>
                                    <View>
                                        <Text style={{color: colors.text, fontWeight: 'bold'}}>{l.employeeName}</Text>
                                        <Text style={{color: colors.subText, fontSize: 11}}>
                                            {format(parseISO(l.startTime), 'HH:mm')} - {format(parseISO(l.endTime), 'HH:mm')} ({formatDuration(l.durationMinutes)})
                                        </Text>
                                    </View>
                                    <TouchableOpacity onPress={() => handleDeleteLog(l.id)} style={{padding: 8}}>
                                        <Ionicons name="trash" size={20} color={colors.error}/>
                                    </TouchableOpacity>
                                </View>
                            ))}
                         </ScrollView>
                     </View>
                 )}
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>

        {/* MODAL 2: CHI TIẾT NHÂN VIÊN */}
        <Modal visible={detailModalVisible} animationType="slide" transparent>
          <View style={styles.modalOverlay}>
             <View style={[styles.modalContent, {backgroundColor: colors.card, borderColor: colors.border, height: '70%'}]}>
                 <View style={styles.modalHeader}>
                    <Text style={{fontSize: 20, fontWeight: 'bold', color: colors.primary}}>{selectedEmpDetail}</Text>
                    <TouchableOpacity onPress={() => setDetailModalVisible(false)}>
                        <Ionicons name="close-circle" size={30} color={colors.subText} />
                    </TouchableOpacity>
                 </View>
                 <Text style={{color: colors.text, marginBottom: 10, textAlign: 'center'}}>Chi tiết tháng {format(currentMonth, 'MM/yyyy')}</Text>
                 
                 <ScrollView>
                     {getDetailLogs().length === 0 ? (
                         <Text style={{textAlign: 'center', color: colors.subText, marginTop: 20}}>Không có dữ liệu trong tháng này.</Text>
                     ) : (
                         getDetailLogs().map((log, index) => (
                             <View key={index} style={{flexDirection: 'row', justifyContent: 'space-between', padding: 12, borderBottomWidth: 1, borderBottomColor: colors.border}}>
                                 <View style={{flexDirection: 'row', alignItems: 'center'}}>
                                     <View style={{width: 30, alignItems: 'center', marginRight: 10}}>
                                         <Text style={{fontWeight: 'bold', color: colors.text, fontSize: 16}}>{format(parseISO(log.date), 'dd')}</Text>
                                         <Text style={{fontSize: 10, color: colors.subText}}>{format(parseISO(log.date), 'EEE')}</Text>
                                     </View>
                                     <View>
                                         <Text style={{color: colors.text}}>
                                            {format(parseISO(log.startTime), 'HH:mm')} - {format(parseISO(log.endTime), 'HH:mm')}
                                         </Text>
                                     </View>
                                 </View>
                                 <Text style={{fontWeight: 'bold', color: colors.success}}>{formatDurationFull(log.durationMinutes)}</Text>
                             </View>
                         ))
                     )}
                 </ScrollView>
             </View>
          </View>
        </Modal>

        {/* TIME PICKER COMPONENT */}
        {showTimePicker && (
             <DateTimePicker 
                value={showTimePicker === 'start' ? startTime : endTime} 
                mode="time" 
                is24Hour={true} 
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={onChangeTime} 
             />
        )}

      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  calendarContainer: { marginHorizontal: 10, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.02)', borderWidth: 0, paddingBottom: 5 },
  monthNav: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 15 },
  monthTitle: { fontSize: 20, fontWeight: 'bold' },
  weekHeaderRow: { flexDirection: 'row', marginBottom: 10, paddingHorizontal: 5 },
  headerCell: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 8 },
  weekText: { fontWeight: 'bold', fontSize: 13 },
  gridContainer: { flexDirection: 'row', flexWrap: 'wrap', padding: 2 },
  cell: { width: '13.5%', height: 95, margin: '0.3%', borderRadius: 14, padding: 4, position: 'relative' },
  cellHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  solarText: { fontSize: 15, fontWeight: 'bold' },
  lunarText: { fontSize: 9, marginTop: 2 },
  separator: { height: 20 },
  toolbar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginBottom: 15 },
  toolbarTitle: { fontSize: 18, fontWeight: 'bold' },
  switchContainer: { flexDirection: 'row', borderRadius: 12, padding: 3 },
  switchBtn: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 10 },
  summaryTable: { paddingHorizontal: 15 },
  glassRow: { flexDirection: 'row', padding: 12, marginBottom: 10, borderRadius: 16, alignItems: 'center', borderWidth: 1 },
  compactRow: { padding: 15, marginBottom: 5, borderRadius: 12, borderWidth: 1 },
  dateBadge: { width: 45, height: 45, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalContent: { width: '100%', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, borderWidth: 1 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  inputMulti: { borderWidth: 1, borderRadius: 12, padding: 12, fontSize: 16 },
  saveBtn: { padding: 16, borderRadius: 16, alignItems: 'center', marginTop: 10 },
  timeBox: { width: '40%', padding: 10, borderRadius: 10, borderWidth: 1, alignItems: 'center' },
});