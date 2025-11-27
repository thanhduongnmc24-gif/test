import React, { useState, useEffect, useRef } from 'react';
import { 
  StyleSheet, Text, View, TouchableOpacity, FlatList, Modal, TextInput, 
  Platform, KeyboardAvoidingView, ScrollView, Animated 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../context/ThemeContext';
import { GestureHandlerRootView, Swipeable, RectButton } from 'react-native-gesture-handler';
// [MỚI] Import thư viện WebBrowser
import * as WebBrowser from 'expo-web-browser';

type QuickNote = {
  id: string;
  title: string;
  content: string;
  date: string;
};

export default function NotesScreen() {
  const { colors } = useTheme();
  const [notes, setNotes] = useState<QuickNote[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  
  const rowRefs = useRef<Map<string, Swipeable>>(new Map());

  useEffect(() => { loadNotes(); }, []);

  const loadNotes = async () => {
    try {
      const data = await AsyncStorage.getItem('QUICK_NOTES');
      if (data) setNotes(JSON.parse(data));
    } catch (e) {}
  };

  const saveNotes = async (newNotes: QuickNote[]) => {
    try {
      await AsyncStorage.setItem('QUICK_NOTES', JSON.stringify(newNotes));
      setNotes(newNotes);
    } catch (e) {}
  };

  const handleOpenModal = (note?: QuickNote) => {
    if (note) {
      setEditingId(note.id);
      setTitle(note.title);
      setContent(note.content);
    } else {
      setEditingId(null);
      setTitle('');
      setContent('');
    }
    setModalVisible(true);
  };

  const handleSave = () => {
    if (!title.trim() && !content.trim()) {
      setModalVisible(false); return;
    }
    let updatedNotes = [...notes];
    if (editingId) {
      updatedNotes = updatedNotes.map(n => n.id === editingId ? { ...n, title, content } : n);
    } else {
      const newNote = { id: Date.now().toString(), title, content, date: new Date().toLocaleDateString('vi-VN') };
      updatedNotes = [newNote, ...updatedNotes];
    }
    saveNotes(updatedNotes);
    setModalVisible(false);
  };

  const handleDelete = (id: string) => {
    const updatedNotes = notes.filter(n => n.id !== id);
    saveNotes(updatedNotes);
    if (rowRefs.current.has(id)) {
        rowRefs.current.get(id)?.close();
        rowRefs.current.delete(id);
    }
  };

  // [SỬA] Hàm mở link bằng In-App Browser
  const handlePressLink = async (text: string) => {
    if (text.startsWith('http')) {
        try {
            await WebBrowser.openBrowserAsync(text, {
                // Tùy chỉnh màu sắc trình duyệt theo theme app
                controlsColor: colors.primary,
                toolbarColor: colors.card,
                presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN
            });
        } catch (error) {
            console.log("Không thể mở trình duyệt:", error);
        }
    }
  };

  const renderItem = ({ item }: { item: QuickNote }) => {
    const isLink = item.title.startsWith('http');

    const renderRightActions = (progress: any, dragX: any) => {
      const scale = dragX.interpolate({
        inputRange: [-100, 0],
        outputRange: [1, 0],
        extrapolate: 'clamp',
      });
      return (
        <RectButton style={styles.deleteAction} onPress={() => handleDelete(item.id)}>
          <Animated.View style={{ transform: [{ scale }], alignItems: 'center' }}>
             <Ionicons name="trash-bin" size={24} color="white" />
             <Text style={{color:'white', fontWeight:'bold', fontSize: 12, marginTop: 4}}>Xóa</Text>
          </Animated.View>
        </RectButton>
      );
    };

    return (
      <View style={styles.noteWrapper}>
        <Swipeable
          ref={ref => { if (ref && !rowRefs.current.has(item.id)) rowRefs.current.set(item.id, ref); }}
          renderRightActions={renderRightActions}
          overshootRight={false}
          containerStyle={{borderRadius: 12, overflow: 'hidden'}} 
        >
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            
            {/* PHẦN 1: TIÊU ĐỀ (Chứa Logic Link) */}
            <View style={styles.titleSection}>
               {isLink ? (
                  <TouchableOpacity onPress={() => handlePressLink(item.title)} style={{flex: 1}}>
                      <Text 
                        numberOfLines={1} 
                        style={[styles.cardTitle, { color: colors.primary, textDecorationLine: 'underline' }]}
                      >
                        {item.title} 🔗
                      </Text>
                  </TouchableOpacity>
               ) : (
                  <View style={{flex: 1}}>
                    <Text 
                       numberOfLines={1} 
                       style={[styles.cardTitle, { color: colors.text }]}
                    >
                       {item.title || '(Không tiêu đề)'}
                    </Text>
                  </View>
               )}
               <Text style={{fontSize: 11, color: colors.subText, marginLeft: 10}}>{item.date}</Text>
            </View>

            <View style={[styles.divider, {backgroundColor: colors.border}]} />

            {/* PHẦN 2: NỘI DUNG (Bấm vào đây để Sửa) */}
            <TouchableOpacity 
               style={styles.contentSection} 
               activeOpacity={0.7}
               onPress={() => handleOpenModal(item)}
            >
               <Text numberOfLines={2} style={{color: colors.subText, fontSize: 14, lineHeight: 20}}>
                  {item.content || 'Chạm vào đây để viết nội dung...'}
               </Text>
            </TouchableOpacity>

          </View>
        </Swipeable>
      </View>
    );
  };

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.bg }}>
      <SafeAreaView style={{flex: 1}} edges={['top']}>
        <View style={styles.header}>
          <Text style={[styles.headerTitle, {color: colors.text}]}>Ghi Chú 📝</Text>
          <TouchableOpacity onPress={() => handleOpenModal()} style={[styles.addBtn, {backgroundColor: colors.primary}]}>
            <Ionicons name="add" size={24} color="white" />
          </TouchableOpacity>
        </View>

        <FlatList 
          data={notes} renderItem={renderItem} keyExtractor={i => i.id} 
          contentContainerStyle={{padding: 20, paddingBottom: 100}}
          ListEmptyComponent={<Text style={{textAlign:'center', color: colors.subText, marginTop: 50}}>Trống trơn. Bấm dấu + để thêm.</Text>}
        />

        <Modal visible={modalVisible} animationType="slide" transparent>
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.modalOverlay}>
            <View style={[styles.modalContent, {backgroundColor: colors.card, borderColor: colors.border}]}>
              <View style={styles.modalHeader}>
                <Text style={{fontSize:18, fontWeight:'bold', color: colors.text}}>
                    {editingId ? 'Sửa ghi chú' : 'Ghi chú mới'}
                </Text>
                <TouchableOpacity onPress={() => setModalVisible(false)}><Ionicons name="close" size={24} color={colors.text}/></TouchableOpacity>
              </View>
              
              <ScrollView style={{ flex: 1 }}>
                <Text style={[styles.label, {color: colors.subText}]}>Tiêu đề (hoặc Link):</Text>
                <TextInput 
                    style={[styles.input, {backgroundColor: colors.iconBg, color: colors.text}]} 
                    placeholder="http://... hoặc Tiêu đề" 
                    placeholderTextColor={colors.subText} 
                    value={title} onChangeText={setTitle} 
                />
                
                <Text style={[styles.label, {color: colors.subText}]}>Nội dung:</Text>
                <TextInput 
                    style={[styles.input, {backgroundColor: colors.iconBg, color: colors.text, height: 200, textAlignVertical:'top'}]} 
                    placeholder="Chi tiết..." 
                    placeholderTextColor={colors.subText} 
                    multiline value={content} onChangeText={setContent} 
                />
              </ScrollView>
              
              <TouchableOpacity onPress={handleSave} style={[styles.saveBtn, {backgroundColor: colors.primary}]}>
                  <Text style={{color:'white', fontWeight:'bold'}}>Lưu lại</Text>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </Modal>
      </SafeAreaView>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 15 },
  headerTitle: { fontSize: 24, fontWeight: 'bold' },
  addBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  
  noteWrapper: {
    marginBottom: 12,
  },
  
  card: { 
    borderWidth: 1, 
  },
  
  titleSection: { padding: 12, paddingBottom: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { fontSize: 16, fontWeight: 'bold' },
  divider: { height: 1, width: '100%', opacity: 0.5 },
  contentSection: { padding: 12, paddingTop: 8, minHeight: 60, justifyContent: 'center' },

  deleteAction: { 
    backgroundColor: '#EF4444', 
    justifyContent: 'center', 
    alignItems: 'center', 
    width: 80, 
    height: '100%', 
  },
  
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, borderWidth: 1, height: '80%', display: 'flex', flexDirection: 'column' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  label: { marginBottom: 5, fontSize: 12, fontWeight: '600' },
  input: { borderRadius: 10, padding: 12, marginBottom: 15 },
  saveBtn: { padding: 15, borderRadius: 12, alignItems: 'center', marginTop: 10 },
});