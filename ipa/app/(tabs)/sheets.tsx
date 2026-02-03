import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, Text, View, TouchableOpacity, TextInput, Image, 
  ScrollView, Alert, ActivityIndicator, KeyboardAvoidingView, Platform 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../context/ThemeContext'; 

export default function SheetsScreen() {
  const { colors } = useTheme();

  // --- STATE ---
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [cellAddress, setCellAddress] = useState('A1');
  const [noteContent, setNoteContent] = useState('');
  
  // Link Script mặc định (Tèo đã điền sẵn cho anh)
  const DEFAULT_URL = 'https://script.google.com/macros/s/AKfycbwmGmcshrvrCsfmqXmj1qlyERulh0CtawveADAMK8rwR4g-Oa5h4NMEo73EiSrIiNcK/exec';
  const [webhookUrl, setWebhookUrl] = useState(DEFAULT_URL);
  
  const [isUploading, setIsUploading] = useState(false);
  const [showConfig, setShowConfig] = useState(false);

  // Load URL đã lưu
  useEffect(() => {
    AsyncStorage.getItem('SHEET_API_URL').then(url => {
        if(url) setWebhookUrl(url);
    });
  }, []);

  const saveUrl = async () => {
      await AsyncStorage.setItem('SHEET_API_URL', webhookUrl);
      setShowConfig(false);
      Alert.alert("Đã lưu", "Cấu hình đã được lưu!");
  }

  // --- CHỌN ẢNH (KHÔNG NÉN) ---
  const pickImage = async () => {
    // 1. Xin quyền
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Cần quyền', 'Cho Tèo xin quyền truy cập ảnh nhé anh hai!');
      return;
    }

    // 2. Chọn ảnh
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true, // Vẫn cho cắt cúp cho đẹp khung hình
      quality: 1,          // [QUAN TRỌNG] quality: 1 là giữ nguyên chất lượng cao nhất
      base64: true,        // Lấy luôn chuỗi Base64 trực tiếp
    });

    if (!result.canceled && result.assets[0].uri) {
      setImageUri(result.assets[0].uri);
      
      // Lấy chuỗi base64 gốc (có thể rất dài)
      setImageBase64(result.assets[0].base64 || null);
    }
  };

  // --- GỬI DỮ LIỆU ---
  const handleUpload = async () => {
    if (!webhookUrl) {
      Alert.alert("Thiếu Link", "Link Script đang trống!");
      return;
    }
    if (!noteContent && !imageBase64) {
      Alert.alert("Trống", "Nhập nội dung hoặc chọn ảnh đi anh hai.");
      return;
    }

    setIsUploading(true);
    try {
      console.log("Đang gửi đến:", webhookUrl);
      
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' }, 
        body: JSON.stringify({
          cell: cellAddress,
          note: noteContent,
          image_base64: imageBase64 // Gửi ảnh gốc
        })
      });

      const result = await response.json();
      
      if (result.result === 'success') {
        Alert.alert("Thành công! 🚀", "Ảnh (Original) đã vào Sheet.");
        setNoteContent('');
        setImageUri(null);
        setImageBase64(null);
      } else {
        throw new Error(result.error || "Lỗi từ Google");
      }
    } catch (error: any) {
      console.log("Upload Error:", error);
      Alert.alert("Lỗi Gửi", "Có thể do ảnh quá nặng hoặc mạng yếu.\nChi tiết: " + error.message);
    } finally {
      setIsUploading(false);
    }
  };

  // --- STYLES ---
  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    input: { 
      backgroundColor: colors.card, 
      color: colors.text, 
      borderRadius: 10, 
      padding: 12, 
      borderWidth: 1, 
      borderColor: colors.border,
      marginBottom: 15
    },
    label: { color: colors.subText, marginBottom: 5, fontWeight: 'bold', fontSize: 13 },
    card: { backgroundColor: colors.card, padding: 15, borderRadius: 12, marginBottom: 15, borderWidth: 1, borderColor: colors.border },
    btnPrimary: {
      backgroundColor: isUploading ? colors.subText : colors.primary, 
      padding: 16, borderRadius: 12, 
      alignItems: 'center', flexDirection: 'row', justifyContent: 'center',
      shadowColor: "#000", shadowOffset: {width: 0, height: 2}, shadowOpacity: 0.2, shadowRadius: 3, elevation: 3
    }
  });

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: 20 }}>
          
          {/* Header */}
          <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20}}>
            <Text style={{fontSize: 24, fontWeight: 'bold', color: colors.text}}>Sheets 📊</Text>
            <TouchableOpacity onPress={() => setShowConfig(!showConfig)} style={{padding: 8}}>
              <Ionicons name={showConfig ? "close-circle" : "settings-sharp"} size={26} color={colors.primary} />
            </TouchableOpacity>
          </View>

          {/* Cấu hình URL */}
          {showConfig && (
            <View style={[styles.card, {borderColor: colors.primary, borderWidth: 1.5, backgroundColor: colors.theme === 'dark' ? '#1e1b4b' : '#EFF6FF'}]}>
              <Text style={[styles.label, {color: colors.primary}]}>⚙️ LINK GOOGLE APPS SCRIPT:</Text>
              <TextInput 
                style={[styles.input, {backgroundColor: colors.bg}]} 
                value={webhookUrl}
                onChangeText={setWebhookUrl}
              />
              <TouchableOpacity onPress={saveUrl} style={{backgroundColor: colors.primary, padding: 10, borderRadius: 8, alignItems: 'center'}}>
                  <Text style={{color: 'white', fontWeight: 'bold'}}>Lưu & Đóng</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Form */}
          <View style={styles.card}>
            {/* Ô Cell */}
            <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'}}>
               <View style={{flex: 1}}>
                  <Text style={styles.label}>VỊ TRÍ Ô</Text>
                  <TextInput 
                    style={[styles.input, {textAlign: 'center', fontWeight: 'bold', fontSize: 22, letterSpacing: 2}]} 
                    value={cellAddress}
                    onChangeText={text => setCellAddress(text.toUpperCase())}
                    placeholder="A1" placeholderTextColor={colors.subText}
                  />
               </View>
               <View style={{marginLeft: 15, justifyContent: 'center', opacity: 0.6}}>
                  <Text style={{fontSize: 10, color: colors.subText}}>Ví dụ: A1, B5...</Text>
               </View>
            </View>

            {/* Ghi chú */}
            <Text style={styles.label}>NỘI DUNG / GHI CHÚ</Text>
            <TextInput 
              style={[styles.input, {height: 100, textAlignVertical: 'top'}]} 
              multiline 
              placeholder="Nhập nội dung ghi chú..." 
              placeholderTextColor={colors.subText}
              value={noteContent}
              onChangeText={setNoteContent}
            />

            {/* Ảnh */}
            <Text style={styles.label}>HÌNH ẢNH (Chất lượng gốc)</Text>
            <TouchableOpacity onPress={pickImage} style={{
              height: 200, backgroundColor: colors.bg, borderRadius: 10, 
              justifyContent: 'center', alignItems: 'center', borderWidth: 1, 
              borderColor: colors.border, borderStyle: 'dashed', marginBottom: 20, overflow: 'hidden'
            }}>
              {imageUri ? (
                <>
                    <Image source={{ uri: imageUri }} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
                    <TouchableOpacity 
                        onPress={() => {setImageUri(null); setImageBase64(null)}}
                        style={{position: 'absolute', top: 5, right: 5, backgroundColor: 'rgba(0,0,0,0.6)', padding: 5, borderRadius: 50}}
                    >
                        <Ionicons name="close" size={20} color="white" />
                    </TouchableOpacity>
                </>
              ) : (
                <View style={{alignItems: 'center'}}>
                  <Ionicons name="camera" size={48} color={colors.subText} />
                  <Text style={{color: colors.subText, fontSize: 13, marginTop: 8}}>Chọn ảnh (Original)</Text>
                </View>
              )}
            </TouchableOpacity>

            {/* Nút Gửi */}
            <TouchableOpacity onPress={handleUpload} disabled={isUploading} style={styles.btnPrimary}>
              {isUploading ? <ActivityIndicator color="#fff"/> : (
                <>
                  <Ionicons name="cloud-upload" size={22} color="#fff" style={{marginRight: 10}}/>
                  <Text style={{color: '#fff', fontWeight: 'bold', fontSize: 16}}>GỬI LÊN SHEET</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}