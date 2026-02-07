import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  StyleSheet, Text, View, TouchableOpacity, TextInput, Image, 
  ScrollView, Alert, ActivityIndicator, KeyboardAvoidingView, Platform, Linking 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '../context/ThemeContext'; 
import { supabase } from '../supabaseConfig'; // Import Supabase
import { useRouter } from 'expo-router';

// Kiểu dữ liệu
type TextItem = { id: string; cell: string; content: string };
type ImageItem = { id: string; cell: string; uri: string; base64: string | null };

export default function SheetsScreen() {
  const { colors } = useTheme();
  const router = useRouter();

  // --- STATE ---
  const DEFAULT_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwmGmcshrvrCsfmqXmj1qlyERulh0CtawveADAMK8rwR4g-Oa5h4NMEo73EiSrIiNcK/exec';
  
  const [webhookUrl, setWebhookUrl] = useState(DEFAULT_SCRIPT_URL);
  const [sheetLink, setSheetLink] = useState('');
  
  const [showConfig, setShowConfig] = useState(false);
  const [isUploading, setIsUploading] = useState(false); // Trạng thái gửi Google Sheet
  const [isSyncing, setIsSyncing] = useState(false);     // Trạng thái đồng bộ Supabase
  const [session, setSession] = useState<any>(null);

  // Danh sách dữ liệu
  const [textList, setTextList] = useState<TextItem[]>([{ id: '1', cell: '', content: '' }]);
  const [imageList, setImageList] = useState<ImageItem[]>([{ id: '1', cell: '', uri: '', base64: null }]);
  
  // Ref để tránh loop khi auto-save
  const isLoadedRef = useRef(false);

  // --- 1. LOAD DATA TỪ SUPABASE ---
  useEffect(() => {
    // Kiểm tra session và tải dữ liệu
    const initData = async () => {
        const { data: { session } } = await supabase.auth.getSession();
        setSession(session);
        
        if (session) {
            setIsSyncing(true);
            const { data, error } = await supabase
                .from('sheet_configs')
                .select('*')
                .eq('user_id', session.user.id) // Đảm bảo lấy đúng của user
                .single();

            if (data) {
                if (data.webhook_url) setWebhookUrl(data.webhook_url);
                if (data.sheet_link) setSheetLink(data.sheet_link);
                // Parse JSON text
                if (data.text_data && Array.isArray(data.text_data)) {
                    setTextList(data.text_data);
                }
                // Parse JSON image (Lưu ý: data về không có URI, chỉ có cấu trúc ô)
                if (data.image_data && Array.isArray(data.image_data)) {
                    const loadedImages = data.image_data.map((img: any) => ({
                        ...img,
                        uri: '',       // Mặc định rỗng vì không lưu ảnh trên server
                        base64: null
                    }));
                    if (loadedImages.length > 0) setImageList(loadedImages);
                }
            }
            setIsSyncing(false);
        }
        isLoadedRef.current = true; // Đánh dấu đã load xong
    };

    initData();

    // Lắng nghe đăng nhập/đăng xuất
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
        setSession(session);
        if(!session) {
            // Reset nếu logout
            setTextList([{ id: '1', cell: '', content: '' }]);
            setImageList([{ id: '1', cell: '', uri: '', base64: null }]);
            isLoadedRef.current = false;
        } else if (!isLoadedRef.current) {
            initData();
        }
    });

    return () => { authListener.subscription.unsubscribe(); };
  }, []);

  // --- 2. AUTO SAVE (DEBOUNCE) ---
  useEffect(() => {
    if (!isLoadedRef.current || !session) return;

    const saveData = async () => {
        setIsSyncing(true);
        try {
            // [QUAN TRỌNG] Lọc bỏ dữ liệu ảnh trước khi lưu lên mây
            const cleanImages = imageList.map(img => ({
                id: img.id,
                cell: img.cell,
                // Không lưu uri, base64
            }));

            const { error } = await supabase
                .from('sheet_configs')
                .upsert({
                    user_id: session.user.id,
                    webhook_url: webhookUrl,
                    sheet_link: sheetLink,
                    text_data: textList,
                    image_data: cleanImages,
                    updated_at: new Date()
                }, { onConflict: 'user_id' }); // Nếu có rồi thì update, chưa có thì insert

            if (error) console.log("Lỗi auto-save:", error);
        } catch (e) {
            console.log("Lỗi save:", e);
        } finally {
            setIsSyncing(false);
        }
    };
    
    // Đợi 1.5s sau khi ngừng gõ mới lưu để đỡ spam server
    const timeoutId = setTimeout(saveData, 1500);
    return () => clearTimeout(timeoutId);

  }, [textList, imageList, webhookUrl, sheetLink, session]);

  // --- LOGIC GIAO DIỆN ---
  const openGoogleSheet = () => {
      if (sheetLink) {
          Linking.openURL(sheetLink).catch(err => Alert.alert("Lỗi", "Link không hợp lệ!"));
      } else {
          Alert.alert("Chưa có link", "Vào cài đặt nhập Link Google Sheet nha đại ca!");
          setShowConfig(true);
      }
  };

  // TEXT HANDLERS
  const addTextItem = () => setTextList([...textList, { id: Date.now().toString(), cell: '', content: '' }]);
  const removeTextItem = (id: string) => { if (textList.length > 1) setTextList(textList.filter(item => item.id !== id)); };
  const updateTextItem = (id: string, field: 'cell' | 'content', value: string) => {
    setTextList(textList.map(item => item.id === id ? { ...item, [field]: value } : item));
  };

  // IMAGE HANDLERS
  const addImageItem = () => setImageList([...imageList, { id: Date.now().toString(), cell: '', uri: '', base64: null }]);
  const removeImageItem = (id: string) => { if (imageList.length > 1) setImageList(imageList.filter(item => item.id !== id)); };
  const updateImageCell = (id: string, value: string) => {
    setImageList(imageList.map(item => item.id === id ? { ...item, cell: value } : item));
  };

  const pickImageForItem = async (id: string) => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return Alert.alert('Cần quyền', 'Cấp quyền ảnh cho Tèo đi đại ca!');

    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 1, base64: true,
    });

    if (!result.canceled && result.assets[0].uri) {
      setImageList(imageList.map(item => item.id === id ? { 
        ...item, uri: result.assets[0].uri, base64: result.assets[0].base64 || null 
      } : item));
    }
  };

  // --- GỬI DỮ LIỆU ĐI GOOGLE SHEET ---
  const handleUpload = async () => {
    if (!webhookUrl) return Alert.alert("Lỗi", "Chưa có Link Script!");
    
    const validTexts = textList.filter(t => t.cell && t.content);
    const validImages = imageList.filter(i => i.cell && i.base64);

    if (validTexts.length === 0 && validImages.length === 0) {
      return Alert.alert("Trống trơn", "Nhập gì đó rồi hãy gửi đại ca ơi!");
    }

    setIsUploading(true);
    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' }, 
        body: JSON.stringify({ texts: validTexts, images: validImages })
      });

      const result = await response.json();
      if (result.result === 'success') {
        Alert.alert("Thành công! 🚀", `Đã bắn dữ liệu lên Google Sheet!`);
      } else {
        throw new Error(result.error);
      }
    } catch (error: any) {
      Alert.alert("Lỗi Gửi", error.message);
    } finally {
      setIsUploading(false);
    }
  };

  // --- RENDER ---
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        
        {/* HEADER CỐ ĐỊNH */}
        <View style={[styles.fixedHeader, { borderBottomColor: colors.border, backgroundColor: colors.bg }]}>
            <View style={styles.headerRow}>
                <View>
                    <Text style={{fontSize: 24, fontWeight: 'bold', color: colors.text}}>Sheets 📊</Text>
                    {/* Trạng thái Sync */}
                    <View style={{flexDirection:'row', alignItems:'center'}}>
                        {!session ? (
                            <Text style={{fontSize:10, color: colors.error}}>(Chưa đăng nhập)</Text>
                        ) : (
                            <Text style={{fontSize:10, color: isSyncing ? colors.primary : colors.success}}>
                                {isSyncing ? 'Đang lưu cấu hình...' : 'Đã đồng bộ Cloud'}
                            </Text>
                        )}
                    </View>
                </View>
                
                <View style={{flexDirection: 'row', gap: 15}}>
                    <TouchableOpacity onPress={openGoogleSheet} style={{padding: 5}}>
                       <Ionicons name="open-outline" size={26} color={colors.success} />
                    </TouchableOpacity>

                    <TouchableOpacity onPress={() => setShowConfig(!showConfig)} style={{padding: 5}}>
                       <Ionicons name={showConfig ? "close-circle" : "settings-sharp"} size={26} color={colors.primary} />
                    </TouchableOpacity>
                </View>
            </View>

            {/* PANEL CẤU HÌNH */}
            {showConfig && (
                <View style={[styles.configPanel, {backgroundColor: colors.card, borderColor: colors.primary}]}>
                   <Text style={{textAlign:'center', fontWeight:'bold', color: colors.primary, marginBottom: 10}}>CÀI ĐẶT KẾT NỐI</Text>
                   {!session && (
                       <TouchableOpacity onPress={() => router.push('/(tabs)/settings')} style={{marginBottom:10, backgroundColor:'#FEE2E2', padding:8, borderRadius:5, alignItems:'center'}}>
                           <Text style={{color:'#DC2626', fontSize:12, fontWeight:'bold'}}>⚠️ Chưa đăng nhập! Cấu hình sẽ không được lưu.</Text>
                       </TouchableOpacity>
                   )}
                   <Text style={[styles.configLabel, {color: colors.subText}]}>🔗 Link Script (Apps Script URL):</Text>
                   <TextInput 
                        style={[styles.configInput, {color: colors.text, borderColor: colors.border, backgroundColor: colors.inputBg}]} 
                        value={webhookUrl} onChangeText={setWebhookUrl} 
                        placeholder="https://script.google.com/..." 
                        placeholderTextColor={colors.subText}
                   />

                   <Text style={[styles.configLabel, {color: colors.subText}]}>📄 Link Trang Tính (Google Sheet URL):</Text>
                   <TextInput 
                        style={[styles.configInput, {color: colors.text, borderColor: colors.border, backgroundColor: colors.inputBg}]} 
                        value={sheetLink} onChangeText={setSheetLink} 
                        placeholder="https://docs.google.com/spreadsheets/..." 
                        placeholderTextColor={colors.subText}
                   />
                   <View style={{height:10}} />
                </View>
            )}

            <TouchableOpacity onPress={handleUpload} disabled={isUploading} style={[styles.sendBtn, {backgroundColor: isUploading ? colors.subText : colors.primary}]}>
                {isUploading ? <ActivityIndicator color="#fff"/> : (
                    <>
                      <Ionicons name="cloud-upload" size={20} color="#fff" style={{marginRight: 8}}/>
                      <Text style={{color: '#fff', fontWeight: 'bold', fontSize: 16}}>GỬI GOOGLE SHEET</Text>
                    </>
                )}
            </TouchableOpacity>
        </View>

        {/* SCROLL VIEW */}
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 50 }}>
          
          {/* --- DANH SÁCH TEXT --- */}
          <Text style={[styles.sectionTitle, {color: colors.primary}]}>📝 Nội Dung Chữ ({textList.length})</Text>
          
          {textList.map((item, index) => (
            <View key={item.id} style={[styles.itemCard, {backgroundColor: colors.card, borderColor: colors.border}]}>
                <View style={styles.cardHeader}>
                    <View style={{flexDirection: 'row', alignItems: 'center'}}>
                        <Text style={{color: colors.subText, marginRight: 8, fontWeight:'bold'}}>Vị trí:</Text>
                        <TextInput 
                            style={[styles.inputCell, {borderColor: colors.border, color: colors.text, backgroundColor: colors.inputBg}]} 
                            placeholder="A1" placeholderTextColor={colors.subText}
                            value={item.cell} onChangeText={(val) => updateTextItem(item.id, 'cell', val.toUpperCase())}
                        />
                    </View>
                    <TouchableOpacity onPress={() => removeTextItem(item.id)} style={{padding: 5}}>
                        <Ionicons name="trash" size={20} color={colors.error} />
                    </TouchableOpacity>
                </View>

                <Text style={{color: colors.subText, marginBottom: 5, fontSize: 12}}>Nội dung chi tiết:</Text>
                <TextInput 
                    style={[styles.inputContentLarge, {borderColor: colors.border, color: colors.text, backgroundColor: colors.inputBg}]} 
                    placeholder="Nhập nội dung dài vào đây..." placeholderTextColor={colors.subText}
                    value={item.content} onChangeText={(val) => updateTextItem(item.id, 'content', val)}
                    multiline={true}
                />
            </View>
          ))}

          <TouchableOpacity onPress={addTextItem} style={[styles.addBtn, {borderColor: colors.subText}]}>
              <Ionicons name="add" size={20} color={colors.primary} />
              <Text style={{color: colors.primary, fontWeight: 'bold', marginLeft: 5}}>Thêm ô Text mới</Text>
          </TouchableOpacity>

          {/* --- DANH SÁCH ẢNH --- */}
          <Text style={[styles.sectionTitle, {marginTop: 30, color: colors.primary}]}>📸 Hình Ảnh ({imageList.length})</Text>
          
          {imageList.map((item, index) => (
            <View key={item.id} style={[styles.itemCard, {backgroundColor: colors.card, borderColor: colors.border}]}>
                <View style={styles.cardHeader}>
                   <View style={{flexDirection:'row', alignItems:'center'}}>
                      <Text style={{color: colors.text, fontWeight:'bold', marginRight: 10}}>Vị trí:</Text>
                      <TextInput 
                          style={[styles.inputCell, {borderColor: colors.border, color: colors.text, backgroundColor: colors.inputBg}]} 
                          placeholder="B2" placeholderTextColor={colors.subText}
                          value={item.cell} onChangeText={(val) => updateImageCell(item.id, val.toUpperCase())}
                      />
                   </View>
                   <TouchableOpacity onPress={() => removeImageItem(item.id)} style={{padding: 5}}>
                      <Ionicons name="trash" size={20} color={colors.error}/>
                   </TouchableOpacity>
                </View>

                <TouchableOpacity onPress={() => pickImageForItem(item.id)} style={{
                    width: '100%', height: 180, backgroundColor: colors.bg, borderRadius: 8,
                    justifyContent: 'center', alignItems: 'center', borderStyle: 'dashed', borderWidth: 1, borderColor: colors.subText
                }}>
                    {item.uri ? (
                        <Image source={{ uri: item.uri }} style={{ width: '100%', height: '100%', borderRadius: 8 }} resizeMode="contain" />
                    ) : (
                        <View style={{alignItems:'center'}}>
                            <Ionicons name="image" size={30} color={colors.subText} />
                            <Text style={{color: colors.subText, fontSize: 12, marginTop: 5}}>Chọn ảnh từ thư viện</Text>
                            <Text style={{color: colors.subText, fontSize: 10, fontStyle:'italic'}}>(Chỉ lưu vị trí ô, không lưu ảnh lên mây)</Text>
                        </View>
                    )}
                </TouchableOpacity>
            </View>
          ))}

          <TouchableOpacity onPress={addImageItem} style={[styles.addBtn, {borderColor: colors.subText}]}>
              <Ionicons name="add" size={20} color={colors.primary} />
              <Text style={{color: colors.primary, fontWeight: 'bold', marginLeft: 5}}>Thêm ô Ảnh mới</Text>
          </TouchableOpacity>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 10, paddingBottom: 10 },
    fixedHeader: { borderBottomWidth: 1, zIndex: 100 },
    sectionTitle: { fontSize: 14, fontWeight: 'bold', marginTop: 20, marginBottom: 10, textTransform: 'uppercase' },
    itemCard: { padding: 15, borderRadius: 12, borderWidth: 1, marginBottom: 15 },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
    inputCell: { width: 80, height: 40, borderWidth: 1, borderRadius: 8, textAlign: 'center', fontWeight: 'bold', fontSize: 16 },
    inputContentLarge: { width: '100%', height: 100, borderWidth: 1, borderRadius: 8, padding: 12, textAlignVertical: 'top', fontSize: 16 },
    addBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 12, borderStyle: 'dashed', borderWidth: 1, borderRadius: 10, marginTop: 5 },
    sendBtn: { paddingVertical: 12, borderRadius: 10, marginHorizontal: 20, marginBottom: 10, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', shadowColor: "#000", shadowOffset: {width: 0, height: 2}, shadowOpacity: 0.2, shadowRadius: 3, elevation: 3 },
    configPanel: { padding: 15, marginHorizontal: 20, marginBottom: 10, borderRadius: 12, borderWidth: 1 },
    configLabel: { fontSize: 12, marginBottom: 5, fontWeight: 'bold', marginTop: 10 },
    configInput: { borderWidth: 1, padding: 10, borderRadius: 8 }
});