import React, { useState, useEffect, useRef } from 'react';
import { 
  StyleSheet, Text, View, TouchableOpacity, FlatList, Modal, TextInput, 
  Alert, Platform, KeyboardAvoidingView, ScrollView, LayoutAnimation, UIManager 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker from '@react-native-community/datetimepicker';
import { format } from 'date-fns';
import { useTheme } from '../context/ThemeContext';
import { GestureHandlerRootView, Swipeable, RectButton } from 'react-native-gesture-handler';
import * as Notifications from 'expo-notifications';

// Kích hoạt LayoutAnimation cho Android
if (Platform.OS === 'android') {
  if (UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
  }
}

// Cấu hình thông báo
Notifications.setNotificationHandler({
  // @ts-ignore
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

type ReminderEvent = {
  id: string;
  title: string;
  content: string;
  dateTime: string;
};

export default function RemindersScreen() {
  const { colors, theme } = useTheme();
  const [reminders, setReminders] = useState<ReminderEvent[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [date, setDate] = useState(new Date());
  
  // Biến điều khiển hiển thị Picker (iOS)
  const [showPicker, setShowPicker] = useState(false);
  const [pickerMode, setPickerMode] = useState<'date' | 'time'>('date');

  const rowRefs = useRef<Map<string, Swipeable>>(new Map());

  useEffect(() => { 
    loadReminders(); 
    requestPermissions(); 
  }, []);

  const requestPermissions = async () => {
    // [SỬA] Yêu cầu quyền thông báo chi tiết cho iOS
    const { status } = await Notifications.requestPermissionsAsync({
      ios: {
        allowAlert: true, // Cho phép hiển thị cảnh báo (bao gồm màn hình khóa)
        allowBadge: true, // Cho phép hiện số trên icon
        allowSound: true, // Cho phép âm thanh
        //allowAnnouncements: true, // Cho phép Siri đọc thông báo
      },
      android: {
        // Có thể thêm cấu hình Android nếu cần, nhưng để trống thì nó sẽ dùng default
      }
    });

    if (status !== 'granted') {
        Alert.alert(
            'Cần quyền', 
            'Đại ca ơi, Tèo cần quyền thông báo. Anh mở Cài đặt để bật lên cho Tèo nhé!'
        );
    }
  };

  const loadReminders = async () => {
    try {
      const data = await AsyncStorage.getItem('USER_REMINDERS');
      if (data) setReminders(JSON.parse(data));
    } catch (e) {}
  };

  const saveReminders = async (newReminders: ReminderEvent[]) => {
    try {
      await AsyncStorage.setItem('USER_REMINDERS', JSON.stringify(newReminders));
      setReminders(newReminders);
    } catch (e) {}
  };

  const scheduleLocalNotification = async (remTitle: string, remContent: string, remDate: Date) => {
    if (remDate.getTime() > new Date().getTime()) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: `🔔 ${remTitle}`,
          body: remContent || 'Đến giờ hẹn rồi đại ca ơi!',
          sound: true,
        },
        // @ts-ignore
        trigger: remDate, 
      });
    }
  };

  const handleSaveReminder = async () => {
    if (!title.trim()) {
      Alert.alert("Thiếu thông tin", "Nhập tiêu đề đi đại ca!");
      return;
    }

    let updatedList = [...reminders];

    if (editingId) {
      updatedList = updatedList.map(item => 
        item.id === editingId 
        ? { ...item, title, content, dateTime: date.toISOString() }
        : item
      );
      await scheduleLocalNotification(title, content, date);
    } else {
      const newReminder: ReminderEvent = {
        id: Date.now().toString(),
        title,
        content,
        dateTime: date.toISOString()
      };
      updatedList = [newReminder, ...updatedList];
      await scheduleLocalNotification(title, content, date);
    }

    await saveReminders(updatedList);
    setModalVisible(false);
  };

  const handleDelete = (id: string) => {
    const newList = reminders.filter(r => r.id !== id);
    saveReminders(newList);
    if (rowRefs.current.has(id)) {
        rowRefs.current.get(id)?.close();
        rowRefs.current.delete(id);
    }
  };

  const handleOpenModal = (item?: ReminderEvent) => {
    // Reset trạng thái picker
    setShowPicker(false);
    
    if (item) {
      setEditingId(item.id);
      setTitle(item.title);
      setContent(item.content);
      setDate(new Date(item.dateTime));
    } else {
      setEditingId(null);
      setTitle('');
      setContent('');
      setDate(new Date());
    }
    setModalVisible(true);
  };

  // --- XỬ LÝ CHỌN NGÀY GIỜ (ỔN ĐỊNH) ---
  const togglePicker = (mode: 'date' | 'time') => {
    // Nếu đang mở đúng mode đó thì đóng, chưa mở thì mở
    if (showPicker && pickerMode === mode) {
        // Đang mở -> Đóng
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setShowPicker(false);
    } else {
        // Mở mới hoặc chuyển mode
        setPickerMode(mode);
        if (Platform.OS === 'android') {
            setShowPicker(true); // Android trigger render để gọi hàm bên dưới
        } else {
            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
            setShowPicker(true); // iOS xổ xuống
        }
    }
  };

  const onDateChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowPicker(false); // Android chọn xong tự đóng
      if (selectedDate) setDate(selectedDate);
    } else {
      // iOS chọn real-time
      if (selectedDate) setDate(selectedDate);
    }
  };

  // --- RENDER ITEM ---
  const renderItem = ({ item }: { item: ReminderEvent }) => {
    const renderRightActions = () => (
      <RectButton style={styles.deleteAction} onPress={() => handleDelete(item.id)}>
        <Ionicons name="trash-bin" size={24} color="white" />
        <Text style={{color: 'white', fontWeight: 'bold', marginTop: 5}}>Xóa</Text>
      </RectButton>
    );

    return (
      <Swipeable
        ref={ref => { if (ref && !rowRefs.current.has(item.id)) rowRefs.current.set(item.id, ref); }}
        renderRightActions={renderRightActions}
        overshootRight={false}
      >
        <RectButton 
          style={[styles.card, {backgroundColor: colors.card, borderColor: colors.border}]} 
          onPress={() => handleOpenModal(item)} 
        >
          <View style={styles.cardHeader}>
            <Text style={[styles.cardTitle, {color: colors.text}]}>{item.title}</Text>
            <View style={[styles.timeBadge, {backgroundColor: colors.iconBg}]}>
                <Text style={[styles.cardTime, {color: colors.primary}]}>
                    {format(new Date(item.dateTime), 'HH:mm - dd/MM')}
                </Text>
            </View>
          </View>
          {item.content ? <Text numberOfLines={2} style={[styles.cardContent, {color: colors.subText}]}>{item.content}</Text> : null}
        </RectButton>
      </Swipeable>
    );
  };

  const dynamicStyles = {
    container: { flex: 1, backgroundColor: colors.bg },
    headerTitle: { fontSize: 28, fontWeight: 'bold' as const, color: colors.text, paddingHorizontal: 20, paddingVertical: 15 },
    modalContent: { backgroundColor: colors.card, borderColor: colors.border },
    input: { backgroundColor: colors.iconBg, color: colors.text, borderRadius: 10, padding: 12, marginBottom: 15 },
    label: { color: colors.subText, marginBottom: 5, fontWeight: '600' as const },
    btn: { backgroundColor: colors.primary },
    activeBtn: { borderColor: colors.primary, backgroundColor: colors.iconBg },
    inactiveBtn: { borderColor: colors.border },
  };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView style={dynamicStyles.container} edges={['top']}>
        <View style={styles.headerContainer}>
           <Text style={dynamicStyles.headerTitle}>Nhắc Nhở 🔔</Text>
           <TouchableOpacity style={[styles.addBtnSmall, {backgroundColor: colors.primary}]} onPress={() => handleOpenModal()}>
              <Ionicons name="add" size={28} color="white" />
           </TouchableOpacity>
        </View>

        <FlatList
          data={reminders}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          contentContainerStyle={{ paddingBottom: 100, paddingHorizontal: 15 }}
          ListEmptyComponent={<Text style={{textAlign:'center', color: colors.subText, marginTop: 50}}>Chưa có nhắc nhở nào.</Text>}
        />

        {/* MODAL NHẬP LIỆU (CHỨA LUÔN PICKER) */}
        <Modal visible={modalVisible} animationType="slide" transparent>
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.modalOverlay}>
            <View style={[styles.modalContent, dynamicStyles.modalContent]}>
              <View style={styles.modalHeader}>
                <Text style={{fontSize: 18, fontWeight: 'bold', color: colors.text}}>
                    {editingId ? 'Sửa nhắc nhở' : 'Tạo nhắc nhở'}
                </Text>
                <TouchableOpacity onPress={() => setModalVisible(false)}><Ionicons name="close" size={24} color={colors.text}/></TouchableOpacity>
              </View>

              <ScrollView style={{flex: 1}}>
                <Text style={dynamicStyles.label}>Tiêu đề:</Text>
                <TextInput style={dynamicStyles.input} placeholder="VD: Đi họp..." placeholderTextColor={colors.subText} value={title} onChangeText={setTitle} />

                <Text style={dynamicStyles.label}>Nội dung:</Text>
                <TextInput style={[dynamicStyles.input, {height: 80, textAlignVertical: 'top'}]} placeholder="Chi tiết..." placeholderTextColor={colors.subText} multiline value={content} onChangeText={setContent} />

                <Text style={dynamicStyles.label}>Thời gian:</Text>
                
                {/* Hàng nút chọn Ngày/Giờ */}
                <View style={styles.dateTimeRow}>
                  <TouchableOpacity 
                    onPress={() => togglePicker('date')} 
                    style={[
                        styles.dateBtn, 
                        (showPicker && pickerMode === 'date') ? dynamicStyles.activeBtn : dynamicStyles.inactiveBtn
                    ]}
                  >
                      <Text style={{color: colors.text, fontWeight:'bold'}}>{format(date, 'dd/MM/yyyy')}</Text>
                      <Ionicons name="calendar-outline" size={18} color={colors.subText} style={{marginTop:4}}/>
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    onPress={() => togglePicker('time')} 
                    style={[
                        styles.dateBtn, 
                        (showPicker && pickerMode === 'time') ? dynamicStyles.activeBtn : dynamicStyles.inactiveBtn
                    ]}
                  >
                      <Text style={{color: colors.text, fontWeight:'bold'}}>{format(date, 'HH:mm')}</Text>
                      <Ionicons name="time-outline" size={18} color={colors.subText} style={{marginTop:4}}/>
                  </TouchableOpacity>
                </View>

                {/* VÙNG HIỂN THỊ PICKER (CHỈ HIỆN KHI BẤM NÚT) */}
                {showPicker && (
                    <View style={{alignItems: 'center', paddingBottom: 20}}>
                        <DateTimePicker 
                            testID="dateTimePicker"
                            value={date}
                            mode={pickerMode}
                            is24Hour={true}
                            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                            onChange={onDateChange}
                            textColor={colors.text}
                            themeVariant={theme}
                            style={{width: '100%'}} // Style cho iOS spinner
                        />
                        {/* Nút Xong nhỏ cho iOS để đóng picker */}
                        {Platform.OS === 'ios' && (
                            <TouchableOpacity onPress={() => setShowPicker(false)} style={{padding: 10}}>
                                <Text style={{color: colors.primary, fontWeight: 'bold'}}>Xong</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                )}

              </ScrollView>

              <TouchableOpacity style={[styles.saveBtn, dynamicStyles.btn]} onPress={handleSaveReminder}>
                <Text style={styles.saveBtnText}>Lưu & Hẹn giờ</Text>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </Modal>
      </SafeAreaView>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  headerContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingRight: 20 },
  addBtnSmall: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  card: { padding: 15, borderBottomWidth: 1, justifyContent: 'center', minHeight: 80 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 },
  cardTitle: { fontSize: 16, fontWeight: 'bold', flex: 1 },
  timeBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  cardTime: { fontSize: 12, fontWeight: 'bold' },
  cardContent: { fontSize: 14 },
  deleteAction: { backgroundColor: '#EF4444', justifyContent: 'center', alignItems: 'center', width: 80, height: '100%', borderRadius: 12 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { width: '100%', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 40, borderWidth: 1, height: '85%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  dateTimeRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  dateBtn: { flex: 0.48, padding: 12, borderRadius: 8, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  saveBtn: { padding: 15, borderRadius: 12, alignItems: 'center', marginTop: 10 },
  saveBtnText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
});