import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, Text, View, TouchableOpacity, TextInput, 
  ScrollView, Alert, KeyboardAvoidingView, Platform, ActivityIndicator 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import * as Clipboard from 'expo-clipboard';
import AsyncStorage from '@react-native-async-storage/async-storage';
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
  const [mediaType, setMediaType] = useState<'video' | 'image'>('video'); 
  const [isGenerating, setIsGenerating] = useState(false); 

  // --- STATE CẤU HÌNH CHUNG CHO NHÂN VẬT ---
  const [charMaxChars, setCharMaxChars] = useState('300'); 

  // --- STATE VIDEO ---
  const [videoChars, setVideoChars] = useState<Character[]>([{ id: '1', name: '', desc: '', generatedPrompt: '' }]);
  const [videoPromptMain, setVideoPromptMain] = useState('');
  const [videoStyle, setVideoStyle] = useState('');
  const [videoMaxChars, setVideoMaxChars] = useState('1000'); 
  const [videoResultEn, setVideoResultEn] = useState(''); // Kết quả Tiếng Anh
  const [videoResultVi, setVideoResultVi] = useState(''); // Kết quả Tiếng Việt

  // --- STATE ẢNH ---
  const [imageChars, setImageChars] = useState<Character[]>([{ id: '1', name: '', desc: '', generatedPrompt: '' }]);
  const [imagePromptMain, setImagePromptMain] = useState('');
  const [imageStyle, setImageStyle] = useState('');
  const [imageSize, setImageSize] = useState('1024x1024');
  const [imageResolution, setImageResolution] = useState('High');
  const [imageMaxChars, setImageMaxChars] = useState('500');
  const [imageResultEn, setImageResultEn] = useState(''); // Kết quả Tiếng Anh
  const [imageResultVi, setImageResultVi] = useState(''); // Kết quả Tiếng Việt

  // --- LOAD VÀ SAVE KEY TỰ ĐỘNG ---
  useEffect(() => {
    const loadKey = async () => {
      try {
        const savedKey = await AsyncStorage.getItem('GEMINI_API_KEY');
        if (savedKey) setApiKey(savedKey);
      } catch (e) {
        console.log("Lỗi load key:", e);
      }
    };
    loadKey();
  }, []);

  const handleKeyChange = async (text: string) => {
    setApiKey(text);
    try {
      await AsyncStorage.setItem('GEMINI_API_KEY', text);
    } catch (e) {
      console.log("Lỗi lưu key:", e);
    }
  };

  // --- HÀM XÓA TẤT CẢ DỮ LIỆU ---
  const handleClearAll = () => {
    Alert.alert(
        "Dọn dẹp", 
        `Đại ca muốn xóa trắng toàn bộ dữ liệu bên tab ${mediaType === 'video' ? 'Video' : 'Ảnh'} không?`,
        [
            { text: "Hủy", style: "cancel" },
            { 
                text: "Xóa sạch", 
                style: 'destructive', 
                onPress: () => {
                    if (mediaType === 'video') {
                        setVideoChars([{ id: '1', name: '', desc: '', generatedPrompt: '' }]);
                        setVideoPromptMain('');
                        setVideoStyle('');
                        setVideoResultEn('');
                        setVideoResultVi('');
                    } else {
                        setImageChars([{ id: '1', name: '', desc: '', generatedPrompt: '' }]);
                        setImagePromptMain('');
                        setImageStyle('');
                        setImageResultEn('');
                        setImageResultVi('');
                    }
                }
            }
        ]
    );
  };

  // --- HÀM XỬ LÝ GỌI API (TRẢ VỀ CẢ VIỆT VÀ ANH) ---

  const callGemini = async (promptInput: string, maxChars: number, mode: 'video' | 'image' | 'character', style: string = '') => {
    if (!apiKey.trim()) {
      Alert.alert("Thiếu Key", "Anh hai ơi, nhập API Key Gemini vào ô trên cùng trước nhé!");
      return null;
    }
    
    setIsGenerating(true);
    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" }); 
      
      let finalPrompt = '';

      if (mode === 'character') {
        // Character: Chỉ cần tiếng Anh để làm prompt
        finalPrompt = `
          Role: Character Concept Artist.
          Task: Describe the physical appearance and clothing of the character based on the input.
          Input: "${promptInput}"
          Requirements: Focus ONLY on visuals. No style/quality tags. Under ${maxChars} chars.
          Output: Return ONLY the English description.
        `;
      } 
      else if (mode === 'video') {
        // Video: Cần trả về 2 phần (Việt và Anh)
        finalPrompt = `
          Role: Expert AI Video Prompter.
          Task: Create a video prompt based on the input.
          
          --- INPUT DATA ---
          ${promptInput}
          Visual Style: "${style}" 
          ------------------

          Requirements:
          1. DURATION: Max 8 seconds. Plan timeline (e.g., [0-2s]).
          2. CHARACTERS: Use names for known characters. Only describe new ones.
          3. STYLE: Follow "${style}".
          4. CAMERA: Explicit movement.
          5. LENGTH: Under ${maxChars} chars.
          
          *** OUTPUT FORMAT (STRICTLY FOLLOW THIS) ***
          Please return the result in exactly two parts separated by "|||".
          Part 1: A detailed description of the video content in VIETNAMESE.
          Part 2: The actual prompt in ENGLISH.
          
          Example:
          Cảnh quay bắt đầu với... ||| Cinematic shot of...
        `;
      } else {
        // Image: Cần trả về 2 phần (Việt và Anh)
        finalPrompt = `
          Role: Expert AI Image Prompter.
          Task: Create an image prompt.
          
          --- INPUT DATA ---
          Content: "${promptInput}"
          Style: "${style}"
          ------------------
          
          Requirements:
          1. VISUALS: Details, lighting, composition.
          2. QUALITY: 8k, photorealistic.
          3. LENGTH: Under ${maxChars} chars.

          *** OUTPUT FORMAT (STRICTLY FOLLOW THIS) ***
          Please return the result in exactly two parts separated by "|||".
          Part 1: A detailed description in VIETNAMESE.
          Part 2: The actual prompt in ENGLISH.
        `;
      }
      
      const result = await model.generateContent(finalPrompt);
      const response = await result.response;
      const text = response.text();

      // Xử lý tách chuỗi cho Video và Image
      if (mode !== 'character' && text.includes('|||')) {
          const parts = text.split('|||');
          return {
              vi: parts[0].trim(),
              en: parts[1].trim()
          };
      }

      // Mặc định (cho character hoặc nếu lỗi tách chuỗi)
      return { vi: '', en: text.trim() };

    } catch (error: any) {
      const errorMessage = error.message || JSON.stringify(error);
      Alert.alert("Lỗi AI", "Gemini báo lỗi nè anh hai: " + errorMessage);
      console.error(error);
      return null;
    } finally {
      setIsGenerating(false);
    }
  };

  const copyToClipboard = async (text: string) => {
    await Clipboard.setStringAsync(text);
    Alert.alert("Đã copy", "Đã lưu vào bộ nhớ tạm!");
  };

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

  // 1. Tạo Prompt cho từng Nhân vật (Chỉ lấy tiếng Anh)
  const generateCharPrompt = async (chars: Character[], setChars: any, id: string) => {
    const char = chars.find(c => c.id === id);
    if (!char || !char.name || !char.desc) {
        Alert.alert("Thiếu thông tin", "Nhập tên và mô tả trước đã đại ca!");
        return;
    }
    const promptInput = `Character Description: Name: ${char.name}. Features: ${char.desc}`;
    const limit = parseInt(charMaxChars) || 300; 
    
    const result = await callGemini(promptInput, limit, 'character'); 
    if (result && result.en) {
        updateCharsList(chars, setChars, 'update', id, 'generatedPrompt', result.en);
    }
  };

  // 2. Tạo Prompt Tổng hợp VIDEO
  const generateVideoPromptTotal = async () => {
    let promptInput = ``;
    
    if (videoChars.some(c => c.name)) {
      promptInput += `Characters involved (Known characters):\n`;
      videoChars.forEach(c => {
        const charDesc = c.generatedPrompt || `${c.name}: ${c.desc}`;
        if (charDesc.trim()) promptInput += `- Name: ${c.name}. Description: ${charDesc}\n`;
      });
    }
    
    promptInput += `\nScene Action/Story: ${videoPromptMain}`;
    
    const limit = parseInt(videoMaxChars) || 1000;
    
    const result = await callGemini(promptInput, limit, 'video', videoStyle);
    if (result) {
        setVideoResultEn(result.en);
        setVideoResultVi(result.vi);
    }
  };

  // 3. Tạo Prompt Tổng hợp ẢNH
  const generateImagePromptTotal = async () => {
    let promptInput = `Aspect Ratio/Size: ${imageSize}, Resolution: ${imageResolution}.\n`;
    
    if (imageChars.some(c => c.name)) {
        promptInput += `Characters present:\n`;
        imageChars.forEach(c => {
          const charDesc = c.generatedPrompt || `${c.name}: ${c.desc}`;
          if (charDesc.trim()) promptInput += `- ${charDesc}\n`;
        });
      }

    promptInput += `\nImage Content/Idea: ${imagePromptMain}`;

    const limit = parseInt(imageMaxChars) || 500;
    
    const result = await callGemini(promptInput, limit, 'image', imageStyle);
    if (result) {
        setImageResultEn(result.en);
        setImageResultVi(result.vi);
    }
  };

  const dynamicStyles = {
    container: { flex: 1, backgroundColor: colors.bg },
    header: { flexDirection: 'row' as const, justifyContent: 'space-between' as const, alignItems: 'center' as const, marginBottom: 20 },
    title: { fontSize: 24, fontWeight: 'bold' as const, color: colors.text },
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
    resultTitle: { color: colors.subText, fontSize: 11, fontWeight: 'bold' as const, marginBottom: 5, textTransform: 'uppercase' as const },
    resultText: { color: colors.text, fontSize: 14, fontStyle: 'italic' as const, lineHeight: 20 },
    tabBtn: { flex: 1, padding: 12, alignItems: 'center' as const, justifyContent: 'center' as const, borderRadius: 8 },
    tabText: { fontWeight: 'bold' as const },
    charConfigRow: { flexDirection: 'row' as const, justifyContent: 'space-between' as const, alignItems: 'center' as const, marginBottom: 10, marginTop: 10 },
    smallInput: { width: 80, textAlign: 'center' as const, padding: 8, height: 40 },
    clearBtn: { padding: 8, backgroundColor: colors.iconBg, borderRadius: 8 },
  };

  return (
    <SafeAreaView style={dynamicStyles.container} edges={['top']}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 100 }}>
          
          {/* HEADER VỚI NÚT XÓA TẤT CẢ */}
          <View style={dynamicStyles.header}>
              <Text style={dynamicStyles.title}>Media Creator 🎬</Text>
              <TouchableOpacity onPress={handleClearAll} style={dynamicStyles.clearBtn}>
                  <Ionicons name="trash-bin-outline" size={24} color="#EF4444" />
              </TouchableOpacity>
          </View>

          {/* Ô NHẬP KEY */}
          <Text style={[dynamicStyles.label, {marginTop: 0}]}>API Key (Gemini):</Text>
          <View style={{flexDirection: 'row', alignItems: 'center'}}>
             <TextInput 
                style={[dynamicStyles.input, {flex: 1}]} 
                placeholder="Dán key Gemini vào đây..." 
                placeholderTextColor={colors.subText}
                secureTextEntry 
                value={apiKey}
                onChangeText={handleKeyChange} 
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
            <View style={{marginTop: 10}}>
               
               {/* THANH CẤU HÌNH NHÂN VẬT CHUNG */}
               <View style={dynamicStyles.charConfigRow}>
                  <Text style={[dynamicStyles.label, {marginTop: 0}]}>Nhân Vật:</Text>
                  <View style={{flexDirection: 'row', alignItems: 'center'}}>
                    <Text style={{color: colors.subText, fontSize: 12, marginRight: 5}}>Max Ký tự:</Text>
                    <TextInput 
                        style={[dynamicStyles.input, dynamicStyles.smallInput]} 
                        placeholder="300"
                        keyboardType="numeric"
                        placeholderTextColor={colors.subText}
                        value={charMaxChars}
                        onChangeText={setCharMaxChars}
                    />
                    <TouchableOpacity onPress={() => updateCharsList(videoChars, setVideoChars, 'add')} style={{marginLeft: 15}}>
                        <Ionicons name="add-circle" size={32} color={colors.primary} />
                    </TouchableOpacity>
                  </View>
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
                    <TouchableOpacity 
                        style={[dynamicStyles.btnSecondary, isGenerating && {opacity: 0.5}]} 
                        onPress={() => generateCharPrompt(videoChars, setVideoChars, char.id)}
                        disabled={isGenerating}
                    >
                        <Text style={{color: '#fff', fontWeight: 'bold'}}>✨ Tạo mô tả NV (AI)</Text>
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

               {/* PHẦN PROMPT CHÍNH */}
               <Text style={dynamicStyles.label}>Nội dung Video (Prompt chính):</Text>
               <TextInput 
                  style={[dynamicStyles.input, {height: 100, textAlignVertical: 'top'}]} 
                  placeholder="Mô tả hành động, bối cảnh video (VD: Tèo đang chạy bộ trong công viên...)" 
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

               {/* KẾT QUẢ HIỂN THỊ */}
               {(videoResultEn || videoResultVi) ? (
                 <View style={{marginTop: 20}}>
                    {/* Ô Tiếng Việt */}
                    <View style={[dynamicStyles.resultBox, {borderColor: colors.accent}]}>
                        <Text style={[dynamicStyles.resultTitle, {color: colors.accent}]}>🇻🇳 MÔ TẢ TIẾNG VIỆT (THAM KHẢO)</Text>
                        <Text style={dynamicStyles.resultText}>{videoResultVi}</Text>
                    </View>

                    {/* Ô Tiếng Anh */}
                    <View style={[dynamicStyles.resultBox, {marginTop: 15, borderColor: colors.primary}]}>
                        <Text style={[dynamicStyles.resultTitle, {color: colors.primary}]}>🇺🇸 PROMPT TIẾNG ANH (COPY)</Text>
                        <Text style={dynamicStyles.resultText}>{videoResultEn}</Text>
                        <TouchableOpacity style={{alignSelf: 'flex-end', marginTop: 10}} onPress={() => copyToClipboard(videoResultEn)}>
                           <Text style={{color: colors.primary, fontWeight: 'bold'}}>COPY</Text>
                        </TouchableOpacity>
                    </View>
                 </View>
               ) : null}
            </View>
          )}

          {/* --- PHẦN GIAO DIỆN ẢNH --- */}
          {mediaType === 'image' && (
            <View style={{marginTop: 10}}>
               
               {/* THANH CẤU HÌNH NHÂN VẬT CHUNG */}
               <View style={dynamicStyles.charConfigRow}>
                  <Text style={[dynamicStyles.label, {marginTop: 0}]}>Nhân Vật (Nếu có):</Text>
                  <View style={{flexDirection: 'row', alignItems: 'center'}}>
                    <Text style={{color: colors.subText, fontSize: 12, marginRight: 5}}>Max Ký tự:</Text>
                    <TextInput 
                        style={[dynamicStyles.input, dynamicStyles.smallInput]} 
                        placeholder="300"
                        keyboardType="numeric"
                        placeholderTextColor={colors.subText}
                        value={charMaxChars}
                        onChangeText={setCharMaxChars}
                    />
                    <TouchableOpacity onPress={() => updateCharsList(imageChars, setImageChars, 'add')} style={{marginLeft: 15}}>
                         <Ionicons name="add-circle" size={32} color={colors.primary} />
                    </TouchableOpacity>
                  </View>
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
                        <Text style={{color: '#fff', fontWeight: 'bold'}}>✨ Tạo mô tả NV (AI)</Text>
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

               {/* KẾT QUẢ HIỂN THỊ */}
               {(imageResultEn || imageResultVi) ? (
                 <View style={{marginTop: 20}}>
                    <View style={[dynamicStyles.resultBox, {borderColor: colors.accent}]}>
                        <Text style={[dynamicStyles.resultTitle, {color: colors.accent}]}>🇻🇳 MÔ TẢ TIẾNG VIỆT (THAM KHẢO)</Text>
                        <Text style={dynamicStyles.resultText}>{imageResultVi}</Text>
                    </View>

                    <View style={[dynamicStyles.resultBox, {marginTop: 15, borderColor: colors.primary}]}>
                        <Text style={[dynamicStyles.resultTitle, {color: colors.primary}]}>🇺🇸 PROMPT TIẾNG ANH (COPY)</Text>
                        <Text style={dynamicStyles.resultText}>{imageResultEn}</Text>
                        <TouchableOpacity style={{alignSelf: 'flex-end', marginTop: 10}} onPress={() => copyToClipboard(imageResultEn)}>
                           <Text style={{color: colors.primary, fontWeight: 'bold'}}>COPY</Text>
                        </TouchableOpacity>
                    </View>
                 </View>
               ) : null}
            </View>
          )}

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}