import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, Text, View, TouchableOpacity, TextInput, Image, 
  ScrollView, Alert, ActivityIndicator, KeyboardAvoidingView, Platform, Linking 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../context/ThemeContext'; 

// Kiểu dữ liệu
type TextItem = { id: string; cell: string; content: string };
type ImageItem = { id: string; cell: string; uri: string; base64: string | null };

export default function SheetsScreen() {
  const { colors } = useTheme();

  // --- STATE ---
  const DEFAULT_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwmGmcshrvrCsfmqXmj1qlyERulh0CtawveADAMK8rwR4g-Oa5h4NMEo73EiSrIiNcK/exec';
  
  const [webhookUrl, setWebhookUrl] = useState(DEFAULT_SCRIPT_URL); // Link Script (Để gửi)
  const [sheetLink, setSheetLink] = useState(''); // Link Trang tính (Để mở xem)
  
  const [showConfig, setShowConfig] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  // Danh sách dữ liệu
  const [textList, setTextList] = useState<TextItem[]>([{ id: '1', cell: '', content: '' }]);
  const [imageList, setImageList] = useState<ImageItem[]>([{ id: '1', cell: '', uri: '', base64: null }]);

  // Load Cấu hình đã lưu
  useEffect(() => {
    const loadSettings = async () => {
        try {
            const savedScript = await AsyncStorage.getItem('SHEET_API_URL');
            if (savedScript) setWebhookUrl(savedScript);

            const savedLink = await AsyncStorage.getItem('GOOGLE_SHEET_LINK');
            if (savedLink) setSheetLink(savedLink);
        } catch(e) {}
    };
    loadSettings();
  }, []);

  // Lưu Cấu hình
  const saveSettings = async () => {
      try {
        await AsyncStorage.setItem('SHEET_API_URL', webhookUrl);
        await AsyncStorage.setItem('GOOGLE_SHEET_LINK', sheetLink);
        setShowConfig(false);
        Alert.alert("Đã lưu", "Cấu hình kết nối đã được cập nhật!");
      } catch (e) {
        Alert.alert("Lỗi", "Không lưu được cài đặt.");
      }
  }

  // Mở trang tính Google Sheet
  const openGoogleSheet = () => {
      if (sheetLink) {
          Linking.openURL(sheetLink).catch(err => Alert.alert("Lỗi", "Không mở được link này!"));
      } else {
          Alert.alert("Chưa có link", "Anh hai bấm vào bánh răng cài đặt để nhập Link trang tính nhé!");
          setShowConfig(true);
      }
  };

  // --- LOGIC TEXT ---
  const addTextItem = () => {
    setTextList([...textList, { id: Date.now().toString(), cell: '', content: '' }]);
  };
  const removeTextItem = (id: string) => {
    if (textList.length === 1) return; 
    setTextList(textList.filter(item => item.id !== id));
  };
  const updateTextItem = (id: string, field: 'cell' | 'content', value: string) => {
    setTextList(textList.map(item => item.id === id ? { ...item, [field]: value } : item));
  };

  // --- LOGIC IMAGE ---
  const addImageItem = () => {
    setImageList([...imageList, { id: Date.now().toString(), cell: '', uri: '', base64: null }]);
  };
  const removeImageItem = (id: string) => {
    if (imageList.length === 1) return;
    setImageList(imageList.filter(item => item.id !== id));
  };
  const updateImageCell = (id: string, value: string) => {
    setImageList(imageList.map(item => item.id === id ? { ...item, cell: value } : item));
  };

  const pickImageForItem = async (id: string) => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return Alert.alert('Cần quyền', 'Cho phép truy cập ảnh đi anh hai!');

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

  // --- GỬI DỮ LIỆU ---
  const handleUpload = async () => {
    if (!webhookUrl) return Alert.alert("Lỗi", "Chưa có Link Script!");
    
    const validTexts = textList.filter(t => t.cell && t.content);
    const validImages = imageList.filter(i => i.cell && i.base64);

    if (validTexts.length === 0 && validImages.length === 0) {
      return Alert.alert("Trống trơn", "Anh hai chưa nhập gì cả!");
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
        Alert.alert("Thành công! 🚀", `Đã gửi xong!`);
        setTextList([{ id: Date.now().toString(), cell: '', content: '' }]);
        setImageList([{ id: (Date.now()+1).toString(), cell: '', uri: '', base64: null }]);
      } else {
        throw new Error(result.error);
      }
    } catch (error: any) {
      Alert.alert("Lỗi Gửi", error.message);
    } finally {
      setIsUploading(false);
    }
  };

  // --- STYLES ---
  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 10, paddingBottom: 10 },
    fixedHeader: { backgroundColor: colors.bg, borderBottomWidth: 1, borderBottomColor: colors.border, zIndex: 100 },
    sectionTitle: { fontSize: 14, fontWeight: 'bold', color: colors.primary, marginTop: 20, marginBottom: 10, textTransform: 'uppercase' },
    
    // Card chứa cụm nhập liệu
    itemCard: { 
      backgroundColor: colors.card, padding: 15, borderRadius: 12, borderWidth: 1, borderColor: colors.border, marginBottom: 15 
    },
    
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
    
    inputCell: { 
      width: 80, height: 40, borderWidth: 1, borderColor: colors.border, borderRadius: 8, 
      textAlign: 'center', fontWeight: 'bold', color: colors.text, backgroundColor: colors.inputBg, fontSize: 16
    },
    
    inputContentLarge: { 
      width: '100%', height: 100, 
      borderWidth: 1, borderColor: colors.border, borderRadius: 8, 
      padding: 12, color: colors.text, backgroundColor: colors.inputBg, 
      textAlignVertical: 'top', fontSize: 16
    },
    
    addBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 12, borderStyle: 'dashed', borderWidth: 1, borderColor: colors.subText, borderRadius: 10, marginTop: 5 },
    sendBtn: {
      backgroundColor: isUploading ? colors.subText : colors.primary, 
      paddingVertical: 12, borderRadius: 10, marginHorizontal: 20, marginBottom: 10,
      alignItems: 'center', flexDirection: 'row', justifyContent: 'center',
      shadowColor: "#000", shadowOffset: {width: 0, height: 2}, shadowOpacity: 0.2, shadowRadius: 3, elevation: 3
    },
    
    // Style cho Config Panel
    configPanel: {
        padding: 15, backgroundColor: colors.card, marginHorizontal: 20, marginBottom: 10, 
        borderRadius: 12, borderWidth: 1, borderColor: colors.primary
    },
    configLabel: { color: colors.subText, fontSize: 12, marginBottom: 5, fontWeight: 'bold', marginTop: 10 },
    configInput: { 
        color: colors.text, borderWidth: 1, borderColor: colors.border, 
        padding: 10, borderRadius: 8, backgroundColor: colors.inputBg 
    }
  });

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        
        {/* HEADER CỐ ĐỊNH */}
        <View style={styles.fixedHeader}>
            <View style={styles.headerRow}>
                <Text style={{fontSize: 24, fontWeight: 'bold', color: colors.text}}>Sheets 📊</Text>
                
                {/* Cụm nút bấm bên phải */}
                <View style={{flexDirection: 'row', gap: 15}}>
                    {/* Nút Mở Link Trang Tính */}
                    <TouchableOpacity onPress={openGoogleSheet} style={{padding: 5}}>
                       <Ionicons name="open-outline" size={26} color={colors.success} />
                    </TouchableOpacity>

                    {/* Nút Cài đặt (Bánh răng) */}
                    <TouchableOpacity onPress={() => setShowConfig(!showConfig)} style={{padding: 5}}>
                       <Ionicons name={showConfig ? "close-circle" : "settings-sharp"} size={26} color={colors.primary} />
                    </TouchableOpacity>
                </View>
            </View>

            {/* PANEL CẤU HÌNH (Ẩn/Hiện) */}
            {showConfig && (
                <View style={styles.configPanel}>
                   <Text style={{textAlign:'center', fontWeight:'bold', color: colors.primary, marginBottom: 10}}>CÀI ĐẶT KẾT NỐI</Text>
                   
                   <Text style={[styles.configLabel, {marginTop: 0}]}>🔗 Link Script (Apps Script URL):</Text>
                   <TextInput 
                        style={styles.configInput} 
                        value={webhookUrl} onChangeText={setWebhookUrl} 
                        placeholder="https://script.google.com/..." 
                        placeholderTextColor={colors.subText}
                   />

                   <Text style={styles.configLabel}>📄 Link Trang Tính (Google Sheet URL):</Text>
                   <TextInput 
                        style={styles.configInput} 
                        value={sheetLink} onChangeText={setSheetLink} 
                        placeholder="https://docs.google.com/spreadsheets/..." 
                        placeholderTextColor={colors.subText}
                   />

                   <TouchableOpacity onPress={saveSettings} style={{alignItems:'center', backgroundColor: colors.primary, padding: 10, borderRadius: 8, marginTop: 15}}>
                       <Text style={{color: 'white', fontWeight:'bold'}}>Lưu Cấu Hình</Text>
                   </TouchableOpacity>
                </View>
            )}

            <TouchableOpacity onPress={handleUpload} disabled={isUploading} style={styles.sendBtn}>
                {isUploading ? <ActivityIndicator color="#fff"/> : (
                    <>
                      <Ionicons name="cloud-upload" size={20} color="#fff" style={{marginRight: 8}}/>
                      <Text style={{color: '#fff', fontWeight: 'bold', fontSize: 16}}>GỬI NGAY</Text>
                    </>
                )}
            </TouchableOpacity>
        </View>

        {/* SCROLL VIEW */}
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 50 }}>
          
          {/* --- DANH SÁCH TEXT --- */}
          <Text style={styles.sectionTitle}>📝 Nội Dung Chữ</Text>
          
          {textList.map((item, index) => (
            <View key={item.id} style={styles.itemCard}>
                <View style={styles.cardHeader}>
                    <View style={{flexDirection: 'row', alignItems: 'center'}}>
                        <Text style={{color: colors.subText, marginRight: 8, fontWeight:'bold'}}>Vị trí:</Text>
                        <TextInput 
                            style={styles.inputCell} 
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
                    style={styles.inputContentLarge} 
                    placeholder="Nhập nội dung dài vào đây..." placeholderTextColor={colors.subText}
                    value={item.content} onChangeText={(val) => updateTextItem(item.id, 'content', val)}
                    multiline={true}
                />
            </View>
          ))}

          <TouchableOpacity onPress={addTextItem} style={styles.addBtn}>
              <Ionicons name="add" size={20} color={colors.primary} />
              <Text style={{color: colors.primary, fontWeight: 'bold', marginLeft: 5}}>Thêm ô Text mới</Text>
          </TouchableOpacity>

          {/* --- DANH SÁCH ẢNH --- */}
          <Text style={[styles.sectionTitle, {marginTop: 30}]}>📸 Hình Ảnh</Text>
          
          {imageList.map((item, index) => (
            <View key={item.id} style={styles.itemCard}>
                <View style={styles.cardHeader}>
                   <View style={{flexDirection:'row', alignItems:'center'}}>
                      <Text style={{color: colors.text, fontWeight:'bold', marginRight: 10}}>Vị trí:</Text>
                      <TextInput 
                          style={styles.inputCell} 
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
                            <Text style={{color: colors.subText, fontSize: 12, marginTop: 5}}>Chọn ảnh</Text>
                        </View>
                    )}
                </TouchableOpacity>
            </View>
          ))}

          <TouchableOpacity onPress={addImageItem} style={styles.addBtn}>
              <Ionicons name="add" size={20} color={colors.primary} />
              <Text style={{color: colors.primary, fontWeight: 'bold', marginLeft: 5}}>Thêm ô Ảnh mới</Text>
          </TouchableOpacity>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}