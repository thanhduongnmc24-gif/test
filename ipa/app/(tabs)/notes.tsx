import React, { useState, useRef, useCallback, useEffect } from 'react';
import { 
  StyleSheet, Text, View, TouchableOpacity, FlatList, Modal, TextInput, 
  Platform, KeyboardAvoidingView, ScrollView, Animated, Keyboard, LayoutAnimation, UIManager, Alert, ActivityIndicator 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { GestureHandlerRootView, Swipeable, RectButton } from 'react-native-gesture-handler';
import * as WebBrowser from 'expo-web-browser';
import { supabase } from '../supabaseConfig'; // Import Supabase
import { useRouter } from 'expo-router'; // Dùng để nhảy sang tab Settings nếu cần

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// Kiểu dữ liệu
type QuickNote = {
  id: string;
  title: string;
  content: string;
  date: string;
  isPinned: boolean; 
  user_id?: string;
};

export default function NotesScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const [notes, setNotes] = useState<QuickNote[]>([]);
  const [loading, setLoading] = useState(false);
  const [session, setSession] = useState<any>(null); // Lưu trạng thái đăng nhập
  
  // State cho Modal Sửa/Thêm
  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const rowRefs = useRef<Map<string, Swipeable>>(new Map());

  useEffect(() => {
    // 1. Kiểm tra ngay xem đã đăng nhập bên Settings chưa
    checkSessionAndFetch();

    // 2. Lắng nghe thay đổi (Ví dụ: Đang ở tab này mà logout bên kia, hoặc login xong quay lại)
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
        setSession(session);
        if (session) {
            fetchNotes(); // Có mạng, có user -> Tải ngay
        } else {
            setNotes([]); // Mất user -> Xóa trắng danh sách để bảo mật
        }
    });

    // 3. Đăng ký Realtime (Người khác sửa -> Mình thấy ngay)
    const subscription = supabase
      .channel('public:notes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notes' }, () => {
          fetchNotes(); // DB thay đổi -> Tải lại danh sách
      })
      .subscribe();

    return () => { 
        authListener.subscription.unsubscribe();
        supabase.removeChannel(subscription); 
    };
  }, []);

  const checkSessionAndFetch = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);
      if (session) fetchNotes();
  };

  const fetchNotes = async () => {
    setLoading(true);
    // Lấy dữ liệu của chính user đang đăng nhập (nhờ Policy RLS đã cài)
    const { data, error } = await supabase
      .from('notes')
      .select('*')
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) {
      console.log("Lỗi tải note:", error);
    } else if (data) {
      // Map dữ liệu từ DB (snake_case) sang App (camelCase)
      const mappedNotes: QuickNote[] = data.map((item: any) => ({
        id: item.id,
        title: item.title,
        content: item.content,
        date: item.date,
        isPinned: item.is_pinned,
        user_id: item.user_id
      }));
      
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setNotes(mappedNotes);
    }
    setLoading(false);
  };

  const handleOpenModal = (note?: QuickNote) => {
    if (!session) {
        Alert.alert("Chưa đăng nhập", "Đại ca qua tab Cài đặt đăng nhập giúp Tèo nha!", [
            { text: "Để sau", style: "cancel" },
            { text: "Đi ngay", onPress: () => router.push('/(tabs)/settings') }
        ]);
        return;
    }

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

  const handleSave = async () => {
    if (!title.trim() && !content.trim()) {
      setModalVisible(false); return;
    }
    // Check lại lần nữa cho chắc
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    setModalVisible(false);
    setLoading(true);

    try {
      if (editingId) {
        // --- SỬA (UPDATE) ---
        const { error } = await supabase
          .from('notes')
          .update({ title, content })
          .eq('id', editingId);

        if (error) throw error;
      } else {
        // --- THÊM MỚI (INSERT) ---
        // Lưu ý: ID dùng Date.now() vẫn ổn, nhưng tốt nhất sau này nên dùng UUID
        const { error } = await supabase
          .from('notes')
          .insert({
            id: Date.now().toString(),
            title,
            content,
            date: new Date().toLocaleDateString('vi-VN'),
            is_pinned: false,
            user_id: session.user.id // Gán chính chủ
          });

        if (error) throw error;
      }
      fetchNotes(); 
    } catch (e: any) {
      Alert.alert("Lỗi lưu", e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!session) return;
    
    // Đóng swipe
    if (rowRefs.current.has(id)) {
        rowRefs.current.get(id)?.close();
        rowRefs.current.delete(id);
    }

    // Xóa Optimistic (Xóa trên giao diện ngay cho sướng mắt)
    const oldNotes = [...notes];
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setNotes(notes.filter(n => n.id !== id));

    // Xóa thật trên Cloud
    const { error } = await supabase.from('notes').delete().eq('id', id);
    if (error) {
        Alert.alert("Lỗi xóa", "Server đang bận, thử lại sau nha đại ca!");
        setNotes(oldNotes); // Hoàn tác nếu lỗi
    }
  };

  const togglePin = async (id: string, currentStatus: boolean) => {
    if (!session) return;

    // Optimistic Update
    const updatedNotes = notes.map(n => n.id === id ? { ...n, isPinned: !currentStatus } : n);
    setNotes(updatedNotes.sort((a, b) => {
         if (a.isPinned === b.isPinned) return 0;
         return a.isPinned ? -1 : 1;
    }));

    const { error } = await supabase
        .from('notes')
        .update({ is_pinned: !currentStatus })
        .eq('id', id);

    if (error) fetchNotes(); 
  };

  // --- RENDER ---
  // Nếu chưa đăng nhập -> Hiện thông báo nhắc nhở
  const renderEmptyComponent = () => {
      if (!session) {
          return (
              <View style={{alignItems:'center', marginTop: 50}}>
                  <Ionicons name="cloud-offline" size={60} color={colors.subText} />
                  <Text style={{color: colors.subText, marginTop: 10, textAlign:'center'}}>
                      Bạn chưa đăng nhập. {'\n'}Vào tab Cài đặt Đăng nhập để đồng bộ dữ liệu nhé!
                  </Text>
                  <TouchableOpacity onPress={() => router.push('/(tabs)/settings')} style={{marginTop:15, padding:10, backgroundColor:colors.primary, borderRadius:8}}>
                      <Text style={{color:'white', fontWeight:'bold'}}>Đến Cài đặt ngay</Text>
                  </TouchableOpacity>
              </View>
          );
      }
      return (
          <Text style={{textAlign:'center', color: colors.subText, marginTop: 50}}>
             {loading ? 'Đang tải từ vũ trụ...' : (searchQuery ? 'Không tìm thấy kết quả.' : 'Trống trơn. Bấm dấu + để thêm.')}
          </Text>
      );
  };

  // (Giữ nguyên logic render item và các hàm phụ trợ như handlePressLink...)
  const handlePressLink = async (text: string) => {
    if (text.startsWith('http')) {
        try {
            await WebBrowser.openBrowserAsync(text, {
                controlsColor: colors.primary,
                toolbarColor: colors.card,
                presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN
            });
        } catch (error) {}
    }
  };

  const filteredNotes = notes.filter(n => {
    const searchLower = searchQuery.toLowerCase();
    return (
        (n.title && n.title.toLowerCase().includes(searchLower)) ||
        (n.content && n.content.toLowerCase().includes(searchLower))
    );
  });

  const renderItem = ({ item }: { item: QuickNote }) => {
    const isLink = item.title.startsWith('http');
    const renderRightActions = (progress: any, dragX: any) => {
      const scale = dragX.interpolate({ inputRange: [-100, 0], outputRange: [1, 0], extrapolate: 'clamp' });
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
          <View style={[styles.card, { 
                  backgroundColor: item.isPinned ? (colors.theme === 'dark' ? '#312e81' : '#EEF2FF') : colors.card, 
                  borderColor: colors.border, borderWidth: 1
              }]}>
            <View style={styles.titleSection}>
               {isLink ? (
                  <TouchableOpacity onPress={() => handlePressLink(item.title)} style={{flex: 1}}>
                      <Text numberOfLines={1} style={[styles.cardTitle, { color: colors.primary, textDecorationLine: 'underline' }]}>{item.title} 🔗</Text>
                  </TouchableOpacity>
               ) : (
                  <View style={{flex: 1}}>
                    <Text numberOfLines={1} style={[styles.cardTitle, { color: colors.text }]}>{item.title || '(Không tiêu đề)'}</Text>
                  </View>
               )}
               <Text style={{fontSize: 11, color: colors.subText, marginLeft: 10, marginRight: 10}}>{item.date}</Text>
               <TouchableOpacity onPress={() => togglePin(item.id, item.isPinned)} style={{padding: 4}}>
                   <Ionicons name={item.isPinned ? "pin" : "pin-outline"} size={20} color={item.isPinned ? colors.primary : colors.subText} />
               </TouchableOpacity>
            </View>
            <View style={[styles.divider, {backgroundColor: colors.border}]} />
            <TouchableOpacity style={styles.contentSection} activeOpacity={0.7} onPress={() => handleOpenModal(item)}>
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
        {/* HEADER */}
        <View style={styles.header}>
          <Text style={[styles.headerTitle, {color: colors.text}]}>Ghi Chú ☁️</Text>
          <View style={{flexDirection:'row', alignItems:'center'}}>
             {loading && <ActivityIndicator size="small" color={colors.primary} style={{marginRight:10}}/>}
             <TouchableOpacity onPress={() => handleOpenModal()} style={[styles.addBtn, {backgroundColor: colors.primary, opacity: session ? 1 : 0.5}]}>
                <Ionicons name="add" size={24} color="white" />
             </TouchableOpacity>
          </View>
        </View>

        {/* THANH TÌM KIẾM */}
        <View style={{paddingHorizontal: 20, marginBottom: 10}}>
            <View style={[styles.searchBar, {backgroundColor: colors.iconBg, borderColor: colors.border}]}>
                <Ionicons name="search" size={20} color={colors.subText} />
                <TextInput 
                    style={[styles.searchInput, {color: colors.text}]}
                    placeholder="Tìm trên mây..." 
                    placeholderTextColor={colors.subText}
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                />
                {searchQuery.length > 0 && (
                    <TouchableOpacity onPress={() => {setSearchQuery(''); Keyboard.dismiss();}}><Ionicons name="close-circle" size={20} color={colors.subText} /></TouchableOpacity>
                )}
            </View>
        </View>

        <FlatList 
          data={filteredNotes} 
          renderItem={renderItem} 
          keyExtractor={i => i.id} 
          contentContainerStyle={{padding: 20, paddingBottom: 100, paddingTop: 5}}
          ListEmptyComponent={renderEmptyComponent}
          refreshing={loading}
          onRefresh={fetchNotes}
        />

        {/* MODAL EDIT */}
        <Modal visible={modalVisible} animationType="slide" transparent>
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.modalOverlay}>
            <View style={[styles.modalContent, {backgroundColor: colors.card, borderColor: colors.border}]}>
              <View style={styles.modalHeader}>
                <Text style={{fontSize:18, fontWeight:'bold', color: colors.text}}>{editingId ? 'Sửa ghi chú' : 'Ghi chú mới'}</Text>
                <TouchableOpacity onPress={() => setModalVisible(false)}><Ionicons name="close" size={24} color={colors.text}/></TouchableOpacity>
              </View>
              <ScrollView style={{ flex: 1 }}>
                <Text style={[styles.label, {color: colors.subText}]}>Tiêu đề (hoặc Link):</Text>
                <TextInput style={[styles.input, {backgroundColor: colors.iconBg, color: colors.text}]} placeholder="Tiêu đề..." placeholderTextColor={colors.subText} value={title} onChangeText={setTitle} />
                <Text style={[styles.label, {color: colors.subText}]}>Nội dung:</Text>
                <TextInput style={[styles.input, {backgroundColor: colors.iconBg, color: colors.text, height: 200, textAlignVertical:'top'}]} placeholder="Chi tiết..." placeholderTextColor={colors.subText} multiline value={content} onChangeText={setContent} />
              </ScrollView>
              <TouchableOpacity onPress={handleSave} style={[styles.saveBtn, {backgroundColor: colors.primary}]}>
                  <Text style={{color:'white', fontWeight:'bold'}}>{loading ? 'Đang lưu...' : 'Lưu lên mây ☁️'}</Text>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </Modal>
      </SafeAreaView>
    </GestureHandlerRootView>
  );
}

// Style giữ nguyên
const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 15, paddingBottom: 10 },
  headerTitle: { fontSize: 24, fontWeight: 'bold' },
  addBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  searchBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, borderWidth: 1, marginBottom: 5 },
  searchInput: { flex: 1, marginLeft: 10, fontSize: 15, height: 30 },
  noteWrapper: { marginBottom: 12 },
  card: { },
  titleSection: { padding: 12, paddingBottom: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { fontSize: 16, fontWeight: 'bold' },
  divider: { height: 1, width: '100%', opacity: 0.5 },
  contentSection: { padding: 12, paddingTop: 8, minHeight: 60, justifyContent: 'center' },
  deleteAction: { backgroundColor: '#EF4444', justifyContent: 'center', alignItems: 'center', width: 80, height: '100%' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, borderWidth: 1, height: '80%', display: 'flex', flexDirection: 'column' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  label: { marginBottom: 5, fontSize: 12, fontWeight: '600' },
  input: { borderRadius: 10, padding: 12, marginBottom: 15 },
  saveBtn: { padding: 15, borderRadius: 12, alignItems: 'center', marginTop: 10 },
});