import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, Text, View, TouchableOpacity, TextInput, Image, 
  ScrollView, Alert, ActivityIndicator, KeyboardAvoidingView, Platform 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../context/ThemeContext'; // Đảm bảo đường dẫn này đúng với file ThemeContext của anh

export default function SheetsScreen() {
  const { colors } = useTheme();

  // State
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [cellAddress, setCellAddress] = useState('A1');
  const [noteContent, setNoteContent] = useState('');
  
  const [webhookUrl, setWebhookUrl] = useState(''); 
  const [isUploading, setIsUploading] = useState(false);
  const [showConfig, setShowConfig] = useState(false);

  // Load URL đã lưu
  useEffect(() => {
    AsyncStorage.getItem('SHEET_API_URL').then(url => {
        if(url) setWebhookUrl(url);
    });
  }, []);

  // Lưu URL
  const saveUrl = async () => {
      await AsyncStorage.setItem('SHEET_API_URL', webhookUrl);
      setShowConfig(false);
      Alert.alert("Đã lưu", "Cấu hình đã được lưu lại!");
  }

  // Chọn ảnh
  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Cần quyền', 'Cho Tèo xin quyền truy cập ảnh nhé anh hai!');
      return;
    }

    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.5,
      base64: true, // Lấy luôn base64 để gửi
    });

    if (!result.canceled && result.assets[0].base64) {
      setImageUri(result.assets[0].uri);
      setImageBase64(result.assets[0].base64);
    }
  };

  // Gửi dữ liệu
  const handleUpload = async () => {
    if (!webhookUrl) {
      Alert.alert("Thiếu Link", "Anh hai bấm vào icon bánh răng để nhập Link Script đã nhé!");
      return;
    }
    if (!noteContent && !imageBase64) {
      Alert.alert("Trống", "Nhập gì đó hoặc chọn ảnh đi anh hai.");
      return;
    }

    setIsUploading(true);
    try {
      // Apps Script yêu cầu post dạng text/plain để tránh lỗi CORS trên trình duyệt
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' }, 
        body: JSON.stringify({
          cell: cellAddress,
          note: noteContent,
          image_base64: imageBase64
        })
      });

      const result = await response.json();
      
      if (result.result === 'success') {
        Alert.alert("Thành công! 🚀", "Dữ liệu đã vào Sheet.");
        setNoteContent('');
        setImageUri(null);
        setImageBase64(null);
      } else {
        throw new Error(result.error || "Lỗi không xác định");
      }
    } catch (error: any) {
      Alert.alert("Lỗi", "Không gửi được: " + error.message);
    } finally {
      setIsUploading(false);
    }
  };

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
    card: { backgroundColor: colors.card, padding: 15, borderRadius: 12, marginBottom: 15, borderWidth: 1, borderColor: colors.border }
  });

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: 20 }}>
          
          {/* Header */}
          <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20}}>
            <Text style={{fontSize: 24, fontWeight: 'bold', color: colors.text}}>Sheets 📊</Text>
            <TouchableOpacity onPress={() => setShowConfig(!showConfig)} style={{padding: 5}}>
              <Ionicons name={showConfig ? "close-circle" : "settings-sharp"} size={26} color={colors.primary} />
            </TouchableOpacity>
          </View>

          {/* Cấu hình URL */}
          {showConfig && (
            <View style={[styles.card, {borderColor: colors.primary, borderWidth: 1.5}]}>
              <Text style={[styles.label, {color: colors.primary}]}>LINK GOOGLE APPS SCRIPT:</Text>
              <TextInput 
                style={styles.input} 
                placeholder="https://script.google.com/..." 
                placeholderTextColor={colors.subText}
                value={webhookUrl}
                onChangeText={setWebhookUrl}
              />
              <TouchableOpacity onPress={saveUrl} style={{backgroundColor: colors.primary, padding: 10, borderRadius: 8, alignItems: 'center'}}>
                  <Text style={{color: 'white', fontWeight: 'bold'}}>Lưu cấu hình</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Form */}
          <View style={styles.card}>
            <Text style={styles.label}>VỊ TRÍ Ô (VD: A1, B5)</Text>
            <TextInput 
              style={[styles.input, {textAlign: 'center', fontWeight: 'bold', fontSize: 20, letterSpacing: 2}]} 
              value={cellAddress}
              onChangeText={text => setCellAddress(text.toUpperCase())}
            />

            <Text style={styles.label}>NỘI DUNG / GHI CHÚ</Text>
            <TextInput 
              style={[styles.input, {height: 100, textAlignVertical: 'top'}]} 
              multiline 
              placeholder="Nhập ghi chú vào đây..." 
              placeholderTextColor={colors.subText}
              value={noteContent}
              onChangeText={setNoteContent}
            />

            <Text style={styles.label}>HÌNH ẢNH (Tùy chọn)</Text>
            <TouchableOpacity onPress={pickImage} style={{
              height: 180, backgroundColor: colors.bg, borderRadius: 10, 
              justifyContent: 'center', alignItems: 'center', borderWidth: 1, 
              borderColor: colors.border, borderStyle: 'dashed', marginBottom: 15
            }}>
              {imageUri ? (
                <>
                    <Image source={{ uri: imageUri }} style={{ width: '100%', height: '100%', borderRadius: 10 }} resizeMode="contain" />
                    <View style={{position: 'absolute', bottom: 5, right: 5, backgroundColor: 'rgba(0,0,0,0.6)', padding: 5, borderRadius: 50}}>
                        <Ionicons name="refresh" size={16} color="white" />
                    </View>
                </>
              ) : (
                <View style={{alignItems: 'center'}}>
                  <Ionicons name="camera" size={40} color={colors.subText} />
                  <Text style={{color: colors.subText, fontSize: 12, marginTop: 5}}>Chọn ảnh từ thư viện</Text>
                </View>
              )}
            </TouchableOpacity>

            <TouchableOpacity 
              onPress={handleUpload}
              disabled={isUploading}
              style={{
                backgroundColor: isUploading ? colors.subText : colors.primary, 
                padding: 16, borderRadius: 12, 
                alignItems: 'center', flexDirection: 'row', justifyContent: 'center',
                shadowColor: "#000", shadowOffset: {width: 0, height: 2}, shadowOpacity: 0.2, shadowRadius: 3
              }}
            >
              {isUploading ? <ActivityIndicator color="#fff"/> : (
                <>
                  <Ionicons name="cloud-upload" size={20} color="#fff" style={{marginRight: 8}}/>
                  <Text style={{color: '#fff', fontWeight: 'bold', fontSize: 16}}>GỬI NGAY</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}