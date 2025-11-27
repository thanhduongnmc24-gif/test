import React, { useState } from 'react';
import { 
  StyleSheet, Text, View, TouchableOpacity, TextInput, 
  ScrollView, Alert, KeyboardAvoidingView, Platform, ActivityIndicator 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import * as Clipboard from 'expo-clipboard';
// [QUAN TRỌNG] Import thư viện Gemini
import { GoogleGenerativeAI } from "@google/generative-ai";

// Kiểu dữ liệu cho nhân vật
type Character = {
  id: string;
  name: string;
  desc: string;
  generatedPrompt: string; // Prompt mô tả nhân vật do AI tạo ra
};

export default function MediaScreen() {
  const { colors } = useTheme();

  // --- STATE CHUNG ---
  const [apiKey, setApiKey] = useState('');
  const [mediaType, setMediaType] = useState<'video' | 'image'>('video'); // Chế độ Video/Ảnh
  const [isGenerating, setIsGenerating] = useState(false); // Trạng thái đang gọi API

  // --- STATE VIDEO ---
  const [videoChars, setVideoChars] = useState<Character[]>([{ id: '1', name: '', desc: '', generatedPrompt: '' }]);
  const [videoPromptMain, setVideoPromptMain] = useState('');
  const [videoStyle, setVideoStyle] = useState('');
  const [videoMaxChars, setVideoMaxChars] = useState('1000'); 
  const [videoResult, setVideoResult] = useState(''); 

  // --- STATE ẢNH ---
  const [imageChars, setImageChars] = useState<Character[]>([{ id: '1', name: '', desc: '', generatedPrompt: '' }]);
  const [imagePromptMain, setImagePromptMain] = useState('');
  const [imageStyle, setImageStyle] = useState('');
  const [imageSize, setImageSize] = useState('1024x1024');
  const [imageResolution, setImageResolution] = useState('High');
  const [imageMaxChars, setImageMaxChars] = useState('500');
  const [imageResult, setImageResult] = useState('');

  // --- HÀM XỬ LÝ GỌI API ---

  // Hàm gọi Gemini chung
  const callGemini = async (promptInput: string, maxChars: number) => {
    if (!apiKey.trim()) {
      Alert.alert("Thiếu Key", "Anh hai ơi, nhập API Key Gemini vào ô trên cùng trước nhé!");
      return null;
    }
    
    setIsGenerating(true);
    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      // Dùng model flash cho nhanh và rẻ
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" }); 
      
      const finalPrompt = `
        Nhiệm vụ: Viết một prompt (câu lệnh nhắc) bằng tiếng Anh để dùng cho các công cụ tạo ảnh/video AI (như Midjourney, Runway, Sora).
        Yêu cầu:
        - Nội dung gốc: "${promptInput}"
        - Phong cách viết: Chi tiết, mô tả ánh sáng, màu sắc, góc quay (nếu là video), độ phân giải cao (8k, photorealistic).
        - Độ dài: Không quá ${maxChars} ký tự.
        - Chỉ trả về nội dung prompt tiếng Anh, không giải thích thêm.
      `;
      
      const result = await model.generateContent(finalPrompt);
      const response = await result.response;
      return response.text();
    } catch (error) {
      Alert.alert("Lỗi AI", "Không kết nối được Gemini. Kiểm tra lại Key hoặc mạng nhé đại ca!");
      console.error(error);
      return null;
    } finally {
      setIsGenerating(false);
    }
  };

  // Copy vào clipboard
  const copyToClipboard = async (text: string) => {
    await Clipboard.setStringAsync(text);
    Alert.alert("Đã copy", "Đã lưu vào bộ nhớ tạm!");
  };

  // Quản lý danh sách nhân vật (Thêm/Xóa/Sửa) - Dùng chung logic
  const updateCharsList = (
    chars: Character[], 
    setChars: React.Dispatch<React.SetStateAction<Character[]>>, 
    action: 'add' | 'remove' | 'update', 
    id?: string, 
    field?: keyof Character, 
    value?: string
  ) => {
    if (action === 'add') {
      const newChar = { id: Date.now().toString(), name: '', desc: '', generatedPrompt: '' };
      setChars([...chars, newChar]);
    } else if (action === 'remove' && id) {
      if (chars.length <= 1) return;
      setChars(chars.filter(c => c.id !== id));
    } else if (action === 'update' && id && field && value !== undefined) {
      setChars(chars.map(c => c.id === id ? { ...c, [field]: value } : c));
    }
  };

  // 1. Tạo Prompt cho từng Nhân vật
  const generateCharPrompt = async (chars: Character[], setChars: any, id: string) => {
    const char = chars.find(c => c.id === id);
    if (!char || !char.name || !char.desc) {
        Alert.alert("Thiếu thông tin", "Nhập tên và mô tả trước đã đại ca!");
        return;
    }
    const promptInput = `Mô tả ngoại hình nhân vật: Tên ${char.name}, đặc điểm ${char.desc}`;
    const result = await callGemini(promptInput, 300); // Giới hạn mô tả nhân vật khoảng 300 ký tự
    if (result) updateCharsList(chars, setChars, 'update', id, 'generatedPrompt', result);
  };

  // 2. Tạo Prompt Tổng hợp VIDEO
  const generateVideoPromptTotal = async () => {
    let promptInput = `Tạo prompt video phong cách ${videoStyle}.\n`;
    
    // Gộp thông tin nhân vật
    if (videoChars.some(c => c.name)) {
      promptInput += `Các nhân vật:\n`;
      videoChars.forEach(c => {
        // Ưu tiên dùng prompt AI đã tạo, nếu chưa có thì dùng mô tả thô
        const charDesc = c.generatedPrompt || `${c.name}: ${c.desc}`;
        if (charDesc.trim()) promptInput += `- ${charDesc}\n`;
      });
    }
    
    promptInput += `\nNội dung cảnh quay: ${videoPromptMain}`;
    
    const limit = parseInt(videoMaxChars) || 1000;
    const result = await callGemini(promptInput, limit);
    if (result) setVideoResult(result);
  };

  // 3. Tạo Prompt Tổng hợp ẢNH
  const generateImagePromptTotal = async () => {
    let promptInput = `Tạo prompt ảnh phong cách ${imageStyle}. Kích thước ${imageSize}, độ phân giải ${imageResolution}.\n`;
    
    if (imageChars.some(c => c.name)) {
        promptInput += `Các nhân vật:\n`;
        imageChars.forEach(c => {
          const charDesc = c.generatedPrompt || `${c.name}: ${c.desc}`;
          if (charDesc.trim()) promptInput += `- ${charDesc}\n`;
        });
      }

    promptInput += `\nNội dung bức ảnh: ${imagePromptMain}`;

    const limit = parseInt(imageMaxChars) || 500;
    const result = await callGemini(promptInput, limit);
    if (result) setImageResult(result);
  };

  const dynamicStyles = {
    container: { flex: 1, backgroundColor: colors.bg },
    title: { fontSize: 24, fontWeight: 'bold' as const, color: colors.text, marginBottom: 20 },
    label: { fontSize: 14, fontWeight: '600' as const, color: colors.subText, marginBottom: 5, marginTop: 15 },
    input: { 
      backgroundColor: colors.iconBg, color: colors.text, borderRadius: 10, padding: 12, fontSize: 15,
      borderWidth: 1, borderColor: colors.border
    },
    card: { 
      backgroundColor: colors.card, borderRadius: 16, padding: 15, marginBottom: 15, 
      borderWidth: 1, borderColor: colors.border 
    },
    btnPrimary: { backgroundColor: colors.primary, padding: 15, borderRadius: 12, alignItems: 'center' as const, marginTop: 20 },
    btnSecondary: { backgroundColor: colors.accent, padding: 10, borderRadius: 8, alignItems: 'center' as const, marginTop: 10 },
    btnText: { color: '#fff', fontWeight: 'bold' as const, fontSize: 16 },
    resultBox: { backgroundColor: colors.inputBg, padding: 15, borderRadius: 10, marginTop: 20, borderWidth: 1, borderColor: colors.border },
    resultText: { color: colors.text, fontSize: 14, fontStyle: 'italic' as const },
    tabBtn: { flex: 1, padding: 12, alignItems: 'center' as const, justifyContent: 'center' as const, borderRadius: 8 },
    tabText: { fontWeight: 'bold' as const },
  };

  return (
    <SafeAreaView style={dynamicStyles.container} edges={['top']}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 100 }}>
          
          <Text style={dynamicStyles.title}>Media Creator 🎬</Text>

          {/* Ô NHẬP KEY */}
          <Text style={dynamicStyles.label}>API Key (Gemini):</Text>
          <View style={{flexDirection: 'row', alignItems: 'center'}}>
             <TextInput 
                style={[dynamicStyles.input, {flex: 1}]} 
                placeholder="Dán key Gemini vào đây..." 
                placeholderTextColor={colors.subText}
                secureTextEntry // Che key đi cho bảo mật
                value={apiKey}
                onChangeText={setApiKey}
             />
          </View>

          {/* NÚT CHUYỂN ĐỔI VIDEO / ẢNH */}
          <View style={{flexDirection: 'row', backgroundColor: colors.iconBg, borderRadius: 10, padding: 4, marginTop: 20}}>
             <TouchableOpacity 
               style={[dynamicStyles.tabBtn, {backgroundColor: mediaType==='video' ? colors.card : 'transparent'}]}
               onPress={() => setMediaType('video')}
             >
                <Text style={[dynamicStyles.tabText, {color: mediaType==='video' ? colors.primary : colors.subText}]}>Video 🎥</Text>
             </TouchableOpacity>
             <TouchableOpacity 
               style={[dynamicStyles.tabBtn, {backgroundColor: mediaType==='image' ? colors.card : 'transparent'}]}
               onPress={() => setMediaType('image')}
             >
                <Text style={[dynamicStyles.tabText, {color: mediaType==='image' ? colors.primary : colors.subText}]}>Ảnh 🖼️</Text>
             </TouchableOpacity>
          </View>

          {/* --- PHẦN GIAO DIỆN VIDEO --- */}
          {mediaType === 'video' && (
            <View style={{marginTop: 20}}>
               
               {/* PHẦN NHÂN VẬT */}
               <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'}}>
                  <Text style={[dynamicStyles.label, {marginTop: 0}]}>Nhân Vật:</Text>
                  <TouchableOpacity onPress={() => updateCharsList(videoChars, setVideoChars, 'add')}>
                     <Text style={{color: colors.primary, fontWeight: 'bold'}}>+ Thêm mới</Text>
                  </TouchableOpacity>
               </View>

               {videoChars.map((char, index) => (
                 <View key={char.id} style={dynamicStyles.card}>
                    <View style={{flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10}}>
                       <Text style={{color: colors.text, fontWeight: 'bold'}}>Nhân vật {index + 1}</Text>
                       <TouchableOpacity onPress={() => updateCharsList(videoChars, setVideoChars, 'remove', char.id)}>
                          <Ionicons name="trash-outline" size={20} color="#EF4444" />
                       </TouchableOpacity>
                    </View>
                    
                    <TextInput 
                      style={[dynamicStyles.input, {marginBottom: 10}]} 
                      placeholder="Tên nhân vật (VD: Cô gái tóc vàng)..." 
                      placeholderTextColor={colors.subText}
                      value={char.name}
                      onChangeText={(text) => updateCharsList(videoChars, setVideoChars, 'update', char.id, 'name', text)}
                    />
                    <TextInput 
                      style={[dynamicStyles.input, {height: 60, textAlignVertical: 'top'}]} 
                      placeholder="Mô tả chi tiết ngoại hình..." 
                      placeholderTextColor={colors.subText}
                      multiline
                      value={char.desc}
                      onChangeText={(text) => updateCharsList(videoChars, setVideoChars, 'update', char.id, 'desc', text)}
                    />
                    
                    {/* Nút tạo prompt nhân vật riêng lẻ */}
                    <TouchableOpacity 
                        style={[dynamicStyles.btnSecondary, isGenerating && {opacity: 0.5}]} 
                        onPress={() => generateCharPrompt(videoChars, setVideoChars, char.id)}
                        disabled={isGenerating}
                    >
                        <Text style={{color: '#fff', fontWeight: 'bold'}}>✨ Tạo mô tả nhân vật (AI)</Text>
                    </TouchableOpacity>

                    {/* Hiển thị kết quả prompt nhân vật */}
                    {char.generatedPrompt ? (
                        <View style={[dynamicStyles.resultBox, {marginTop: 10, padding: 10}]}>
                            <Text style={{color: colors.text, fontSize: 12}}>{char.generatedPrompt}</Text>
                            <TouchableOpacity style={{alignSelf: 'flex-end', marginTop: 5}} onPress={() => copyToClipboard(char.generatedPrompt)}>
                                <Ionicons name="copy-outline" size={18} color={colors.primary} />
                            </TouchableOpacity>
                        </View>
                    ) : null}
                 </View>
               ))}

               {/* PHẦN PROMPT CHÍNH */}
               <Text style={dynamicStyles.label}>Nội dung Video (Prompt chính):</Text>
               <TextInput 
                  style={[dynamicStyles.input, {height: 100, textAlignVertical: 'top'}]} 
                  placeholder="Mô tả hành động, bối cảnh video..." 
                  placeholderTextColor={colors.subText}
                  multiline
                  value={videoPromptMain}
                  onChangeText={setVideoPromptMain}
               />

               {/* CẤU HÌNH KHÁC */}
               <View style={{flexDirection: 'row', justifyContent: 'space-between'}}>
                  <View style={{flex: 0.6, marginRight: 10}}>
                     <Text style={dynamicStyles.label}>Phong cách:</Text>
                     <TextInput 
                        style={dynamicStyles.input} 
                        placeholder="Cinematic, Anime..." 
                        placeholderTextColor={colors.subText}
                        value={videoStyle}
                        onChangeText={setVideoStyle}
                     />
                  </View>
                  <View style={{flex: 0.4}}>
                     <Text style={dynamicStyles.label}>Max Ký tự:</Text>
                     <TextInput 
                        style={dynamicStyles.input} 
                        placeholder="1000" 
                        keyboardType="numeric"
                        placeholderTextColor={colors.subText}
                        value={videoMaxChars}
                        onChangeText={setVideoMaxChars}
                     />
                  </View>
               </View>

               {/* NÚT TẠO TỔNG HỢP */}
               <TouchableOpacity 
                 style={[dynamicStyles.btnPrimary, isGenerating && {opacity: 0.5}]} 
                 onPress={generateVideoPromptTotal}
                 disabled={isGenerating}
               >
                  {isGenerating ? <ActivityIndicator color="#fff" /> : <Text style={dynamicStyles.btnText}>✨ Tạo Prompt Video Tổng Hợp</Text>}
               </TouchableOpacity>

               {/* KẾT QUẢ */}
               {videoResult ? (
                 <View style={dynamicStyles.resultBox}>
                    <Text style={{color: colors.subText, marginBottom: 5, fontSize: 12}}>KẾT QUẢ PROMPT:</Text>
                    <Text style={dynamicStyles.resultText}>{videoResult}</Text>
                    <TouchableOpacity style={{alignSelf: 'flex-end', marginTop: 10}} onPress={() => copyToClipboard(videoResult)}>
                       <Text style={{color: colors.primary, fontWeight: 'bold'}}>Copy Toàn Bộ</Text>
                    </TouchableOpacity>
                 </View>
               ) : null}
            </View>
          )}

          {/* --- PHẦN GIAO DIỆN ẢNH --- */}
          {mediaType === 'image' && (
            <View style={{marginTop: 20}}>
               
                 {/* PHẦN NHÂN VẬT (ẢNH) */}
                 <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'}}>
                  <Text style={[dynamicStyles.label, {marginTop: 0}]}>Nhân Vật (Nếu có):</Text>
                  <TouchableOpacity onPress={() => updateCharsList(imageChars, setImageChars, 'add')}>
                     <Text style={{color: colors.primary, fontWeight: 'bold'}}>+ Thêm mới</Text>
                  </TouchableOpacity>
               </View>

               {imageChars.map((char, index) => (
                 <View key={char.id} style={dynamicStyles.card}>
                    <View style={{flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10}}>
                       <Text style={{color: colors.text, fontWeight: 'bold'}}>Nhân vật {index + 1}</Text>
                       <TouchableOpacity onPress={() => updateCharsList(imageChars, setImageChars, 'remove', char.id)}>
                          <Ionicons name="trash-outline" size={20} color="#EF4444" />
                       </TouchableOpacity>
                    </View>
                    
                    <TextInput 
                      style={[dynamicStyles.input, {marginBottom: 10}]} 
                      placeholder="Tên nhân vật..." 
                      placeholderTextColor={colors.subText}
                      value={char.name}
                      onChangeText={(text) => updateCharsList(imageChars, setImageChars, 'update', char.id, 'name', text)}
                    />
                    <TextInput 
                      style={[dynamicStyles.input, {height: 60, textAlignVertical: 'top'}]} 
                      placeholder="Mô tả ngoại hình..." 
                      placeholderTextColor={colors.subText}
                      multiline
                      value={char.desc}
                      onChangeText={(text) => updateCharsList(imageChars, setImageChars, 'update', char.id, 'desc', text)}
                    />
                     <TouchableOpacity 
                        style={[dynamicStyles.btnSecondary, isGenerating && {opacity: 0.5}]} 
                        onPress={() => generateCharPrompt(imageChars, setImageChars, char.id)}
                        disabled={isGenerating}
                    >
                        <Text style={{color: '#fff', fontWeight: 'bold'}}>✨ Tạo mô tả nhân vật (AI)</Text>
                    </TouchableOpacity>

                    {char.generatedPrompt ? (
                        <View style={[dynamicStyles.resultBox, {marginTop: 10, padding: 10}]}>
                            <Text style={{color: colors.text, fontSize: 12}}>{char.generatedPrompt}</Text>
                            <TouchableOpacity style={{alignSelf: 'flex-end', marginTop: 5}} onPress={() => copyToClipboard(char.generatedPrompt)}>
                                <Ionicons name="copy-outline" size={18} color={colors.primary} />
                            </TouchableOpacity>
                        </View>
                    ) : null}
                 </View>
               ))}

               <Text style={[dynamicStyles.label]}>Nội dung Ảnh:</Text>
               <TextInput 
                  style={[dynamicStyles.input, {height: 100, textAlignVertical: 'top'}]} 
                  placeholder="Mô tả ý tưởng bức ảnh..." 
                  placeholderTextColor={colors.subText}
                  multiline
                  value={imagePromptMain}
                  onChangeText={setImagePromptMain}
               />

               <View style={{flexDirection: 'row', justifyContent: 'space-between'}}>
                  <View style={{flex: 1, marginRight: 10}}>
                     <Text style={dynamicStyles.label}>Phong cách:</Text>
                     <TextInput 
                        style={dynamicStyles.input} 
                        placeholder="Realistic, 3D..." 
                        placeholderTextColor={colors.subText}
                        value={imageStyle}
                        onChangeText={setImageStyle}
                     />
                  </View>
                  <View style={{flex: 1}}>
                     <Text style={dynamicStyles.label}>Độ phân giải:</Text>
                     <TextInput 
                        style={dynamicStyles.input} 
                        placeholder="High / 4K" 
                        placeholderTextColor={colors.subText}
                        value={imageResolution}
                        onChangeText={setImageResolution}
                     />
                  </View>
               </View>

               <View style={{flexDirection: 'row', justifyContent: 'space-between'}}>
                  <View style={{flex: 1, marginRight: 10}}>
                     <Text style={dynamicStyles.label}>Kích thước:</Text>
                     <TextInput 
                        style={dynamicStyles.input} 
                        placeholder="1024x1024" 
                        placeholderTextColor={colors.subText}
                        value={imageSize}
                        onChangeText={setImageSize}
                     />
                  </View>
                  <View style={{flex: 1}}>
                     <Text style={dynamicStyles.label}>Max Ký tự:</Text>
                     <TextInput 
                        style={dynamicStyles.input} 
                        placeholder="500" 
                        keyboardType="numeric"
                        placeholderTextColor={colors.subText}
                        value={imageMaxChars}
                        onChangeText={setImageMaxChars}
                     />
                  </View>
               </View>

               <TouchableOpacity 
                style={[dynamicStyles.btnPrimary, isGenerating && {opacity: 0.5}]} 
                onPress={generateImagePromptTotal}
                disabled={isGenerating}
               >
                  {isGenerating ? <ActivityIndicator color="#fff" /> : <Text style={dynamicStyles.btnText}>✨ Tạo Prompt Ảnh Tổng Hợp</Text>}
               </TouchableOpacity>

               {imageResult ? (
                 <View style={dynamicStyles.resultBox}>
                    <Text style={{color: colors.subText, marginBottom: 5, fontSize: 12}}>KẾT QUẢ PROMPT:</Text>
                    <Text style={dynamicStyles.resultText}>{imageResult}</Text>
                    <TouchableOpacity style={{alignSelf: 'flex-end', marginTop: 10}} onPress={() => copyToClipboard(imageResult)}>
                       <Text style={{color: colors.primary, fontWeight: 'bold'}}>Copy Toàn Bộ</Text>
                    </TouchableOpacity>
                 </View>
               ) : null}
            </View>
          )}

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}