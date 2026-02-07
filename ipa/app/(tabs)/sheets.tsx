import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { 
  StyleSheet, Text, View, TouchableOpacity, ScrollView, 
  Modal, TextInput, KeyboardAvoidingView, Platform, Alert, ActivityIndicator, Keyboard 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { 
  format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, 
  eachDayOfInterval, addMonths, subMonths, isSameDay, isSameMonth, 
  differenceInMinutes, parseISO, setHours, setMinutes 
} from 'date-fns';
import { useRouter } from 'expo-router';
import { useTheme } from '../context/ThemeContext';
import { LinearGradient } from 'expo-linear-gradient';
import DateTimePicker from '@react-native-community/datetimepicker'; 
// @ts-ignore
import { Solar } from 'lunar-javascript';
import { supabase } from '../supabaseConfig';

// Kiểu dữ liệu
type WorkLog = {
  id: string;
  date: string; 
  employeeName: string; 
  startTime: string;    
  endTime: string;      
  durationMinutes: number; 
  user_id?: string;
};

export default function CalendarScreen() {
  const { colors, theme } = useTheme();
  const router = useRouter();
  
  // --- STATE ---
  const [currentMonth, setCurrentMonth] = useState(new Date()); 
  const [selectedDate, setSelectedDate] = useState<Date | null>(null); 
  const [logs, setLogs] = useState<WorkLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [session, setSession] = useState<any>(null);

  // Modal Nhập Liệu & Chỉnh Sửa
  const [modalVisible, setModalVisible] = useState(false);
  const [editingLogId, setEditingLogId] = useState<string | null>(null);
  const [empName, setEmpName] = useState('');
  const [startTime, setStartTime] = useState(new Date());
  const [endTime, setEndTime] = useState(new Date());
  
  // State Input Text cho Web
  const [webStartTime, setWebStartTime] = useState('');
  const [webEndTime, setWebEndTime] = useState('');
  
  // State Picker Mobile
  const [showTimePicker, setShowTimePicker] = useState<'start' | 'end' | null>(null);

  // Modal Chi Tiết
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedEmpDetail, setSelectedEmpDetail] = useState<string | null>(null);

  // Chế độ xem tổng hợp
  const [summaryMode, setSummaryMode] = useState<'date' | 'employee'>('date');

  // --- INIT DATA ---
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
        setSession(session);
        if (session) fetchLogs();
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
        setSession(session);
        if (session) fetchLogs();
        else setLogs([]);
    });

    const subscription = supabase
      .channel('public:work_logs')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'work_logs' }, () => {
          fetchLogs();
      })
      .subscribe();

    return () => {
        authListener.subscription.unsubscribe();
        supabase.removeChannel(subscription);
    };
  }, []);

  const fetchLogs = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('work_logs').select('*');
    if (error) {
        console.log("Lỗi tải logs:", error);
    } else if (data) {
        const mappedLogs: WorkLog[] = data.map((item: any) => ({
            id: item.id,
            date: item.date,
            employeeName: item.employee_name,
            startTime: item.start_time,
            endTime: item.end_time,
            durationMinutes: item.duration_minutes,
            user_id: item.user_id
        }));
        setLogs(mappedLogs);
    }
    setLoading(false);
  };

  // --- LOGIC TÍNH TOÁN ---
  const calculateDuration = (start: Date, end: Date) => {
    let diff = differenceInMinutes(end, start);
    if (diff < 0) diff += 1440; 
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
    if (!session) {
        Alert.alert("Chưa đăng nhập", "Anh hai ơi, vào Cài đặt đăng nhập để chấm công nhé!", [
            { text: "Để sau", style: "cancel" },
            { text: "Đi ngay", onPress: () => router.push('/(tabs)/settings') }
        ]);
        return;
    }
    setSelectedDate(date);
    resetForm();
    setModalVisible(true);
  };

  const resetForm = () => {
    const now = new Date();
    setEmpName('');
    setEditingLogId(null);
    setStartTime(now);
    setEndTime(now);
    setWebStartTime(format(now, 'HH:mm'));
    setWebEndTime(format(now, 'HH:mm'));
  };

  const handleStartEdit = (log: WorkLog) => {
    setEditingLogId(log.id);
    setEmpName(log.employeeName);
    
    const s = parseISO(log.startTime);
    const e = parseISO(log.endTime);
    
    setStartTime(s);
    setEndTime(e);
    setWebStartTime(format(s, 'HH:mm'));
    setWebEndTime(format(e, 'HH:mm'));
  };

  const onChangeTime = (event: any, selectedDate?: Date) => {
    const type = showTimePicker;
    if(Platform.OS === 'android') setShowTimePicker(null);
    if (selectedDate && type) {
        if (type === 'start') setStartTime(selectedDate);
        else setEndTime(selectedDate);
    }
  };

  const parseTimeFromText = (timeStr: string, originalDate: Date) => {
    try {
        const [hours, minutes] = timeStr.split(':').map(Number);
        if (!isNaN(hours) && !isNaN(minutes)) {
            return setMinutes(setHours(originalDate, hours), minutes);
        }
    } catch (e) {}
    return originalDate;
  };

  // --- XỬ LÝ LƯU DB ---
  const handleSaveLog = async () => {
    if (!empName.trim() || !selectedDate) {
        Alert.alert("Thiếu thông tin", "Nhập tên nhân viên đi anh hai!");
        return;
    }

    if (!session) return; 
    
    // [FIX 1] Ẩn bàn phím ngay lập tức
    Keyboard.dismiss();

    let finalStart = startTime;
    let finalEnd = endTime;

    if (Platform.OS === 'web') {
        finalStart = parseTimeFromText(webStartTime, startTime);
        finalEnd = parseTimeFromText(webEndTime, endTime);
    }

    const s = new Date(finalStart); s.setSeconds(0); s.setMilliseconds(0);
    const e = new Date(finalEnd); e.setSeconds(0); e.setMilliseconds(0);
    const duration = calculateDuration(s, e);
    
    // Không đóng modal, chỉ hiển thị loading nhẹ hoặc thông báo
    setLoading(true);

    try {
        if (editingLogId) {
            // UPDATE
            const { error } = await supabase
                .from('work_logs')
                .update({
                    employee_name: empName.trim(),
                    start_time: s.toISOString(),
                    end_time: e.toISOString(),
                    duration_minutes: duration
                })
                .eq('id', editingLogId);
            
            if (error) throw error;
            // Alert.alert("Thành công", "Đã cập nhật công!");

        } else {
            // INSERT
            const { error } = await supabase
                .from('work_logs')
                .insert({
                    id: Date.now().toString(),
                    date: selectedDate.toISOString(),
                    employee_name: empName.trim(),
                    start_time: s.toISOString(),
                    end_time: e.toISOString(),
                    duration_minutes: duration,
                    user_id: session.user.id
                });

            if (error) throw error;
            // Alert.alert("Thành công", "Đã thêm công mới!");
        }
        
        // [FIX 1] Sau khi lưu xong thì reset form để nhập người tiếp theo, nhưng bàn phím đã tắt nhờ lệnh trên
        resetForm();
        fetchLogs(); 
    } catch (err: any) {
        Alert.alert("Lỗi lưu", err.message);
    } finally {
        setLoading(false);
    }
  };

  const handleDeleteLog = async (id: string) => {
    if (!session) return;
    
    const deleteAction = async () => {
        setLoading(true);
        const oldLogs = [...logs];
        setLogs(logs.filter(l => l.id !== id));
        if (editingLogId === id) resetForm();

        const { error } = await supabase.from('work_logs').delete().eq('id', id);
        if (error) {
            Alert.alert("Lỗi xóa", error.message);
            setLogs(oldLogs); 
        }
        setLoading(false);
    };

    if (Platform.OS === 'web') {
        if (confirm("Anh có chắc muốn xóa dòng này không?")) deleteAction();
    } else {
        Alert.alert("Xác nhận xóa", "Xóa dòng chấm công này nhé?", [
          { text: "Hủy", style: "cancel" },
          { text: "Xóa luôn", style: "destructive", onPress: deleteAction }
        ]);
    }
  };

  const handleViewEmployeeDetail = (name: string) => {
    setSelectedEmpDetail(name);
    setDetailModalVisible(true);
  };

  // --- VIEW HELPERS ---
  const getLogsForDay = (date: Date) => logs.filter(l => isSameDay(parseISO(l.date), date));

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
            const d = format(parseISO(log.date), 'yyyy-MM-dd'); 
            if (!grouped[d]) grouped[d] = [];
            grouped[d].push(log);
        });
        const sortedKeys = Object.keys(grouped).sort((a, b) => a.localeCompare(b));
        return sortedKeys.map(dateStr => ({
            type: 'date',
            key: dateStr,
            date: parseISO(dateStr),
            items: grouped[dateStr].sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
        }));
    } else {
        const grouped: Record<string, number> = {};
        monthlyLogs.forEach(log => {
            grouped[log.employeeName] = (grouped[log.employeeName] || 0) + log.durationMinutes;
        });
        return Object.keys(grouped).map(name => ({
            type: 'employee', key: name, name: name, totalMinutes: grouped[name]
        })).sort((a, b) => a.name.localeCompare(b.name));
    }
  }, [logs, currentMonth, summaryMode]);

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
              <View style={{alignItems:'center'}}>
                <Text style={[styles.monthTitle, {color: colors.text}]}>Tháng {format(currentMonth, 'MM yyyy')}</Text>
                {loading && <ActivityIndicator size="small" color={colors.primary} style={{marginTop: 5}}/>}
                {!session && !loading && <Text style={{fontSize: 10, color: colors.subText}}>(Chưa đăng nhập)</Text>}
              </View>
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
                        <Text key={i} numberOfLines={1} style={{fontSize: 9, color: colors.primary, marginBottom: 1, fontWeight: 'bold'}}>
                            {l.employeeName}
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
             <Text style={[styles.toolbarTitle, {color: colors.text}]}>Tổng Hợp</Text>
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
                <View style={{alignItems:'center', marginTop: 20}}>
                    {!session && <Text style={{color: colors.error, marginBottom: 5}}>Bạn chưa đăng nhập</Text>}
                    <Text style={{textAlign: 'center', color: colors.subText, fontStyle: 'italic'}}>Chưa có dữ liệu chấm công.</Text>
                </View>
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

        {/* MODAL 1: NHẬP & SỬA CHẤM CÔNG */}
        <Modal visible={modalVisible} animationType="fade" transparent>
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.modalOverlay}>
            <View style={[styles.modalContent, {backgroundColor: colors.card, borderColor: colors.border}]}>
              <View style={styles.modalHeader}>
                <Text style={{fontSize: 18, fontWeight: 'bold', color: colors.text}}>
                    {selectedDate ? format(selectedDate, 'dd/MM/yyyy') : ''} {editingLogId ? '(Đang sửa)' : ''}
                </Text>
                <TouchableOpacity onPress={() => setModalVisible(false)}><Ionicons name="close" size={24} color={colors.text} /></TouchableOpacity>
              </View>
              
              {/* [FIX 2] Tách phần nhập liệu và phần danh sách thành 2 khối riêng biệt trong Flexbox */}
              <View style={{flex: 1}}>
                  
                  {/* PHẦN 1: CỐ ĐỊNH (KHÔNG BỊ ĐẨY ĐI) */}
                  <View>
                     <Text style={{color: colors.subText, marginBottom: 5, fontSize: 12}}>Tên nhân viên:</Text>
                     <TextInput 
                          style={[styles.inputMulti, {backgroundColor: colors.iconBg, color: colors.text, borderColor: colors.border}]} 
                          placeholder="Nhập tên..." placeholderTextColor={colors.subText}
                          value={empName} onChangeText={setEmpName} 
                     />

                     <View style={{flexDirection: 'row', justifyContent: 'space-between', marginTop: 15}}>
                          {/* GIAO DIỆN CHỌN GIỜ (WEB VS MOBILE) */}
                          {Platform.OS === 'web' ? (
                              <>
                                 <View style={[styles.timeBox, {borderColor: colors.border, backgroundColor: colors.iconBg}]}>
                                    <Text style={{color: colors.subText, fontSize: 11}}>Giờ vào</Text>
                                    <TextInput 
                                       style={{color: colors.primary, fontWeight: 'bold', fontSize: 18, textAlign: 'center', width: '100%'}}
                                       value={webStartTime} onChangeText={setWebStartTime}
                                       placeholder="HH:mm" placeholderTextColor={colors.subText}
                                    />
                                 </View>
                                 <View style={{justifyContent:'center'}}><Ionicons name="arrow-forward" color={colors.subText} size={20}/></View>
                                 <View style={[styles.timeBox, {borderColor: colors.border, backgroundColor: colors.iconBg}]}>
                                    <Text style={{color: colors.subText, fontSize: 11}}>Giờ ra</Text>
                                    <TextInput 
                                       style={{color: colors.primary, fontWeight: 'bold', fontSize: 18, textAlign: 'center', width: '100%'}}
                                       value={webEndTime} onChangeText={setWebEndTime}
                                       placeholder="HH:mm" placeholderTextColor={colors.subText}
                                    />
                                 </View>
                              </>
                          ) : (
                              <>
                                 <TouchableOpacity onPress={() => setShowTimePicker('start')} style={[styles.timeBox, {borderColor: colors.border, backgroundColor: colors.iconBg}]}>
                                    <Text style={{color: colors.subText, fontSize: 11}}>Giờ vào</Text>
                                    <Text style={{color: colors.primary, fontWeight: 'bold', fontSize: 18}}>{format(startTime, 'HH:mm')}</Text>
                                 </TouchableOpacity>
                                 <View style={{justifyContent:'center'}}><Ionicons name="arrow-forward" color={colors.subText} size={20}/></View>
                                 <TouchableOpacity onPress={() => setShowTimePicker('end')} style={[styles.timeBox, {borderColor: colors.border, backgroundColor: colors.iconBg}]}>
                                    <Text style={{color: colors.subText, fontSize: 11}}>Giờ ra</Text>
                                    <Text style={{color: colors.primary, fontWeight: 'bold', fontSize: 18}}>{format(endTime, 'HH:mm')}</Text>
                                 </TouchableOpacity>
                              </>
                          )}
                     </View>

                     {showTimePicker && Platform.OS !== 'web' && (
                         <View style={{marginTop: 20, alignItems: 'center'}}>
                             <DateTimePicker 
                                value={showTimePicker === 'start' ? startTime : endTime} 
                                mode="time" is24Hour={true} 
                                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                                onChange={onChangeTime} 
                                style={{width: '100%', height: 120}}
                             />
                             {Platform.OS === 'ios' && (
                                 <TouchableOpacity onPress={() => setShowTimePicker(null)} style={{marginTop: 10, paddingVertical: 8, paddingHorizontal: 30, backgroundColor: colors.iconBg, borderRadius: 20}}>
                                    <Text style={{color: colors.primary, fontWeight: 'bold'}}>Xong</Text>
                                 </TouchableOpacity>
                             )}
                         </View>
                     )}
                     
                     <View style={{flexDirection: 'row', marginTop: 10, gap: 10}}>
                         {editingLogId && (
                             <TouchableOpacity style={[styles.saveBtn, {backgroundColor: colors.iconBg, flex: 1}]} onPress={resetForm}>
                                <Text style={{color: colors.text, fontWeight: 'bold'}}>Hủy sửa</Text>
                             </TouchableOpacity>
                         )}
                         <TouchableOpacity style={[styles.saveBtn, {backgroundColor: colors.primary, flex: 2}]} onPress={handleSaveLog}>
                            {loading ? <ActivityIndicator color="white"/> : <Text style={{color: 'white', fontWeight: 'bold'}}>{editingLogId ? 'Cập nhật' : 'Lưu / Thêm'}</Text>}
                         </TouchableOpacity>
                     </View>
                  </View>

                  {/* PHẦN 2: DANH SÁCH CUỘN (TỰ ĐỘNG GIÃN NỞ Ở DƯỚI, KHÔNG ĐẨY PHẦN TRÊN) */}
                  <View style={{flex: 1, marginTop: 15, borderTopWidth: 1, borderTopColor: colors.border}}>
                       <Text style={{color: colors.subText, fontSize: 12, marginVertical: 8}}>Danh sách (Chạm vào tên để sửa):</Text>
                       <ScrollView nestedScrollEnabled contentContainerStyle={{paddingBottom: 20}}>
                          {selectedDate && getLogsForDay(selectedDate).length > 0 ? (
                              getLogsForDay(selectedDate).map((l, i) => {
                                  const isEditing = l.id === editingLogId;
                                  return (
                                      <View key={i} style={{
                                          flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', 
                                          marginBottom: 8, padding: 8, 
                                          backgroundColor: isEditing ? colors.primary + '20' : colors.bg, 
                                          borderRadius: 8,
                                          borderWidth: isEditing ? 1 : 0, borderColor: colors.primary
                                      }}>
                                          <TouchableOpacity style={{flex: 1}} onPress={() => handleStartEdit(l)}>
                                              <View>
                                                  <Text style={{color: colors.text, fontWeight: 'bold'}}>{l.employeeName} {isEditing ? '(Đang sửa)' : ''}</Text>
                                                  <Text style={{color: colors.subText, fontSize: 11}}>
                                                      {format(parseISO(l.startTime), 'HH:mm')} - {format(parseISO(l.endTime), 'HH:mm')} ({formatDuration(l.durationMinutes)})
                                                  </Text>
                                              </View>
                                          </TouchableOpacity>
                                          <TouchableOpacity onPress={() => handleDeleteLog(l.id)} style={{padding: 8}}>
                                              <Ionicons name="trash" size={20} color={colors.error}/>
                                          </TouchableOpacity>
                                      </View>
                                  );
                              })
                          ) : (
                              <Text style={{textAlign:'center', color: colors.subText, fontStyle:'italic', marginTop: 10}}>Chưa có nhân viên nào.</Text>
                          )}
                       </ScrollView>
                  </View>

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
  modalContent: { width: '100%', height: '85%', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, borderWidth: 1 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  inputMulti: { borderWidth: 1, borderRadius: 12, padding: 12, fontSize: 16 },
  saveBtn: { padding: 16, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  timeBox: { width: '40%', padding: 10, borderRadius: 10, borderWidth: 1, alignItems: 'center' },
});