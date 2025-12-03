import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, Text, View, TouchableOpacity, TextInput, 
  ScrollView, Alert, KeyboardAvoidingView, Platform, ActivityIndicator, Image
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import * as Clipboard from 'expo-clipboard';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { GoogleGenerativeAI } from "@google/generative-ai";
import * as ImagePicker from 'expo-image-picker';

type Character = { id: string; name: string; desc: string; generatedPrompt: string; };
type MediaType = 'video' | 'image' | 'title' | 'edit_image';

export default function MediaScreen() {
  const { colors } = useTheme();

  // --- STATE CHUNG ---
  const [apiKey, setApiKey] = useState('');
  const [mediaType, setMediaType] = useState<MediaType>('video'); 
  const [isGenerating, setIsGenerating] = useState(false); 
  const [showMenu, setShowMenu] = useState(false);

  // --- STATE CẤU HÌNH ---
  const [charMaxChars, setCharMaxChars] = useState('300'); 

  // --- VIDEO ---
  const [videoChars, setVideoChars] = useState<Character[]>([{ id: '1', name: '', desc: '', generatedPrompt: '' }]);
  const [videoPromptMain, setVideoPromptMain] = useState('');
  const [videoStyle, setVideoStyle] = useState('');
  const [videoMaxChars, setVideoMaxChars] = useState('1000'); 
  const [videoResultEn, setVideoResultEn] = useState(''); 
  const [videoResultVi, setVideoResultVi] = useState(''); 

  // --- IMAGE ---
  const [imageChars, setImageChars] = useState<Character[]>([{ id: '1', name: '', desc: '', generatedPrompt: '' }]);
  const [imagePromptMain, setImagePromptMain] = useState('');
  const [imageStyle, setImageStyle] = useState('');
  const [imageSize, setImageSize] = useState('1024x1024');
  const [imageResolution, setImageResolution] = useState('High');
  const [imageMaxChars, setImageMaxChars] = useState('1000');
  const [imageResultEn, setImageResultEn] = useState(''); 
  const [imageResultVi, setImageResultVi] = useState(''); 

  // --- TITLE ---
  const [titleInput, setTitleInput] = useState(''); 
  const [titlePlatform, setTitlePlatform] = useState<'short' | 'video'>('video'); 
  const [titleResult, setTitleResult] = useState(''); 

  // --- EDIT IMAGE ---
  const [editPrompt, setEditPrompt] = useState('Ghép sản phẩm vào tay người mẫu một cách tự nhiên. Chỉnh sửa ánh sáng và màu sắc cho phù hợp với phong cách quảng cáo mỹ phẩm cao cấp.');
  const [modelImage, setModelImage] = useState<string | null>(null);
  const [productImage, setProductImage] = useState<string | null>(null);
  const [editResult, setEditResult] = useState<string | null>(null);
  const [editTimer, setEditTimer] = useState(0);

  useEffect(() => {
    const loadKey = async () => {
      try {
        const savedKey = await AsyncStorage.getItem('GEMINI_API_KEY');
        if (savedKey) setApiKey(savedKey);
      } catch (e) { console.log("Lỗi load key:", e); }
    };
    loadKey();
  }, []);

  useEffect(() => {
    let interval: any;
    if (isGenerating && mediaType === 'edit_image') {
      interval = setInterval(() => {
        setEditTimer(prev => prev + 1);
      }, 1000);
    } else {
      setEditTimer(0);
    }
    return () => clearInterval(interval);
  }, [isGenerating, mediaType]);

  const handleKeyChange = async (text: string) => {
    setApiKey(text);
    try { await AsyncStorage.setItem('GEMINI_API_KEY', text); } catch (e) {}
  };

  const handleClearAll = () => {
    let tabName = mediaType === 'video' ? 'Video' : mediaType === 'image' ? 'Ảnh' : mediaType === 'title' ? 'Tiêu đề' : 'Xử lý ảnh';
    Alert.alert("Dọn dẹp", `Xóa sạch tab ${tabName}?`, [
        { text: "Hủy", style: "cancel" },
        { text: "Xóa", style: 'destructive', onPress: () => {
            if (mediaType === 'video') {
                setVideoChars([{ id: '1', name: '', desc: '', generatedPrompt: '' }]);
                setVideoPromptMain(''); setVideoStyle(''); setVideoResultEn(''); setVideoResultVi('');
            } else if (mediaType === 'image') {
                setImageChars([{ id: '1', name: '', desc: '', generatedPrompt: '' }]);
                setImagePromptMain(''); setImageStyle(''); setImageResultEn(''); setImageResultVi('');
            } else if (mediaType === 'title') { 
                setTitleInput(''); setTitleResult(''); 
            } else {
                setEditPrompt(''); setModelImage(null); setProductImage(null); setEditResult(null);
            }
        }}
    ]);
  };

  const copyToClipboard = async (text: string) => {
    if (!text) return;
    await Clipboard.setStringAsync(text);
    Alert.alert("Đã Copy!", `Đã lưu ${text.length} ký tự vào bộ nhớ tạm.`);
  };

  const pickImage = async (type: 'model' | 'product') => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1,
      base64: true,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      if (type === 'model') setModelImage(result.assets[0].base64 || null);
      else setProductImage(result.assets[0].base64 || null);
    }
  };

  const callGemini = async (promptInput: string, maxChars: number, mode: MediaType | 'character', style: string = '') => {
    if (!apiKey.trim()) { Alert.alert("Thiếu Key", "Nhập API Key trước đã đại ca!"); return null; }
    setIsGenerating(true);
    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      
      if (mode === 'edit_image') {
        if (!modelImage || !productImage) { Alert.alert("Lỗi", "Vui lòng chọn đủ ảnh người mẫu và sản phẩm."); setIsGenerating(false); return; }
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-image" });
        const result = await model.generateContent([
            { inlineData: { data: modelImage, mimeType: 'image/jpeg' } },
            { inlineData: { data: productImage, mimeType: 'image/jpeg' } },
            { text: promptInput }
        ]);
        const response = await result.response;
        if (response.candidates?.[0]?.content?.parts[0]?.inlineData) {
            setEditResult(response.candidates[0].content.parts[0].inlineData.data);
        } else {
            Alert.alert("Lỗi AI", "Không nhận được hình ảnh.");
        }
        return;
      }

      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" }); 
      let finalPrompt = '';
      const minChars = Math.max(10, maxChars - 50); 

      if (mode === 'character') {
        finalPrompt = `Role: Artist. Describe visuals of character: "${promptInput}". Output: English only.`;
      } 
      else if (mode === 'title') {
        finalPrompt = `Role: YouTube Expert. Generate 5 Vietnamese titles for ${style === 'short' ? 'Shorts' : 'Video'}. Input: "${promptInput}".`;
      }
      else if (mode === 'video' || mode === 'image') {
        const role = mode === 'video' ? 'Video Prompter' : 'Image Prompter';
        finalPrompt = `Role: ${role}. Task: Write a prompt based on input: "${promptInput}" (Style: ${style}). *** LENGTH GOAL *** Try to keep the English prompt between ${minChars} and ${maxChars} characters. *** OUTPUT FORMAT (STRICT) *** [Vietnamese Description]|||[English Prompt] CRITICAL RULES: 1. Do NOT write labels like "Part 1:", "Part 2:", "Vietnamese:", "English:", or "Answer:". 2. Just output the raw content separated by "|||". 3. Ensure the English Prompt is DETAILED and NOT EMPTY.`;
      }
      
      const result = await model.generateContent(finalPrompt);
      const response = await result.response;
      const text = response.text();

      if ((mode === 'video' || mode === 'image')) {
          if (text.includes('|||')) {
              const parts = text.split('|||');
              return { vi: parts[0].trim(), en: parts[1] ? parts[1].trim() : text };
          } else {
              return { vi: 'Không tách được nội dung', en: text.trim() };
          }
      }
      return { vi: '', en: text.trim() };
    } catch (error: any) {
      Alert.alert("Lỗi AI", error.message);
      return null;
    } finally {
      setIsGenerating(false);
    }
  };

  const updateCharsList = (chars: any, setChars: any, action: any, id?: any, field?: any, value?: any) => {
    if (action === 'add') setChars([...chars, { id: Date.now().toString(), name: '', desc: '', generatedPrompt: '' }]);
    else if (action === 'remove' && id && chars.length > 1) setChars(chars.filter((c:any) => c.id !== id));
    else if (action === 'update' && id) setChars(chars.map((c:any) => c.id === id ? { ...c, [field]: value } : c));
  };
  
  const generateCharPrompt = async (chars: any, setChars: any, id: string) => {
    const char = chars.find((c:any) => c.id === id);
    if (!char.name) return Alert.alert("Thiếu tên", "Nhập tên nhân vật!");
    const res = await callGemini(`Name: ${char.name}. Desc: ${char.desc}`, parseInt(charMaxChars), 'character');
    if (res?.en) updateCharsList(chars, setChars, 'update', id, 'generatedPrompt', res.en);
  };

  const generateVideoPromptTotal = async () => {
    let input = `Story: ${videoPromptMain}.\nCharacters: ` + videoChars.map(c => `${c.name} (${c.generatedPrompt})`).join(', ');
    const res = await callGemini(input, parseInt(videoMaxChars), 'video', videoStyle);
    if (res) { setVideoResultEn(res.en); setVideoResultVi(res.vi); }
  };

  const generateImagePromptTotal = async () => {
    let input = `Idea: ${imagePromptMain}.\nSize: ${imageSize}. Res: ${imageResolution}.\nCharacters: ` + imageChars.map(c => `${c.name} (${c.generatedPrompt})`).join(', ');
    const res = await callGemini(input, parseInt(imageMaxChars), 'image', imageStyle);
    if (res) { setImageResultEn(res.en); setImageResultVi(res.vi); }
  };

  const generateYoutubeTitle = async () => {
    if (!titleInput) return Alert.alert("Thiếu nội dung", "Nhập cốt truyện đi đại ca!");
    const res = await callGemini(titleInput, 0, 'title', titlePlatform);
    if (res?.en) setTitleResult(res.en);
  };

  const generateEditImage = async () => {
    if (!editPrompt) return Alert.alert("Thiếu yêu cầu", "Nhập yêu cầu chỉnh sửa đi đại ca!");
    await callGemini(editPrompt, 0, 'edit_image');
  };

  const dynamicStyles = {
    container: { flex: 1, backgroundColor: colors.bg },
    header: { flexDirection: 'row' as const, justifyContent: 'space-between' as const, alignItems: 'center' as const, marginBottom: 20 },
    title: { fontSize: 24, fontWeight: 'bold' as const, color: colors.text },
    label: { fontSize: 14, fontWeight: '600' as const, color: colors.subText, marginBottom: 5, marginTop: 15 },
    input: { backgroundColor: colors.iconBg, color: colors.text, borderRadius: 10, padding: 12, borderWidth: 1, borderColor: colors.border },
    card: { backgroundColor: colors.card, borderRadius: 16, padding: 15, marginBottom: 15, borderWidth: 1, borderColor: colors.border },
    btnPrimary: { backgroundColor: colors.primary, padding: 15, borderRadius: 12, alignItems: 'center' as const, marginTop: 20 },
    btnSecondary: { backgroundColor: colors.accent, padding: 10, borderRadius: 8, alignItems: 'center' as const, marginTop: 10 },
    btnText: { color: '#fff', fontWeight: 'bold' as const, fontSize: 16 },
    resultBox: { backgroundColor: colors.inputBg, padding: 15, borderRadius: 10, marginTop: 20, borderWidth: 1, borderColor: colors.border },
    resultTitle: { color: colors.subText, fontSize: 11, fontWeight: 'bold' as const, textTransform: 'uppercase' as const },
    resultText: { color: colors.text, fontSize: 14, fontStyle: 'italic' as const, lineHeight: 24, marginTop: 5 },
    menuContainer: { position: 'absolute' as const, top: 60, right: 20, backgroundColor: colors.card, borderRadius: 12, padding: 10, borderWidth: 1, borderColor: colors.border, zIndex: 100 },
    menuItem: { flexDirection: 'row' as const, alignItems: 'center' as const, paddingVertical: 12, paddingHorizontal: 15, borderBottomWidth: 1, borderBottomColor: colors.border },
    
    // [FIX LỖI HERE] Thêm 'as const' vào '100%' để TS hiểu đây là kích thước hợp lệ
    uploadBox: { 
        width: '100%' as const, 
        height: 150, 
        borderWidth: 2, 
        borderColor: colors.border, 
        borderStyle: 'dashed' as const, 
        borderRadius: 12, 
        justifyContent: 'center' as const, 
        alignItems: 'center' as const, 
        backgroundColor: colors.iconBg 
    },
  };

  const menuItems: { type: MediaType, label: string, icon: any }[] = [
    { type: 'video', label: 'Video 🎥', icon: 'videocam' },
    { type: 'image', label: 'Ảnh 🖼️', icon: 'image' },
    { type: 'title', label: 'Tiêu đề ✍️', icon: 'text' },
    { type: 'edit_image', label: 'Xử lý ảnh 🪄', icon: 'color-wand' },
  ];

  return (
    <SafeAreaView style={dynamicStyles.container} edges={['top']}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 100 }}>
          
          <View style={dynamicStyles.header}>
              <Text style={dynamicStyles.title}>Media Creator 🎬</Text>
              <View style={{flexDirection: 'row'}}>
                <TouchableOpacity onPress={handleClearAll} style={{padding:8, backgroundColor: colors.iconBg, borderRadius:8, marginRight: 10}}><Ionicons name="trash-bin-outline" size={24} color="#EF4444" /></TouchableOpacity>
                <TouchableOpacity onPress={() => setShowMenu(!showMenu)} style={{padding:8, backgroundColor: colors.iconBg, borderRadius:8}}><Ionicons name="menu" size={24} color={colors.text} /></TouchableOpacity>
              </View>
          </View>
          
          {showMenu && (
            <View style={dynamicStyles.menuContainer}>
                {menuItems.map((item, index) => (
                    <TouchableOpacity key={item.type} style={[dynamicStyles.menuItem, index === menuItems.length - 1 && {borderBottomWidth: 0}, mediaType === item.type && {backgroundColor: colors.iconBg}]} onPress={() => { setMediaType(item.type); setShowMenu(false); }}>
                        <Ionicons name={item.icon} size={20} color={mediaType === item.type ? colors.primary : colors.subText} />
                        <Text style={{marginLeft: 10, fontWeight: 'bold', color: mediaType === item.type ? colors.primary : colors.text}}>{item.label}</Text>
                    </TouchableOpacity>
                ))}
            </View>
          )}

          <Text style={[dynamicStyles.label, {marginTop: 0}]}>API Key (Gemini):</Text>
          <TextInput style={dynamicStyles.input} placeholder="Key Gemini..." placeholderTextColor={colors.subText} secureTextEntry value={apiKey} onChangeText={handleKeyChange} />
          
          <Text style={[dynamicStyles.label, {fontSize: 18, color: colors.primary}]}>Đang chọn: {menuItems.find(i => i.type === mediaType)?.label}</Text>

          {mediaType === 'title' && (
            <View style={{marginTop: 10}}>
                <Text style={dynamicStyles.label}>Nội dung:</Text>
                <TextInput style={[dynamicStyles.input, {height: 120, textAlignVertical: 'top'}]} placeholder="Nhập ý tưởng..." placeholderTextColor={colors.subText} multiline value={titleInput} onChangeText={setTitleInput} />
                <View style={{flexDirection: 'row', marginTop: 15}}>
                    {['video', 'short'].map((p: any) => (
                        <TouchableOpacity key={p} style={{flexDirection:'row', alignItems:'center', marginRight:20, padding:10, borderRadius:8, borderWidth:1, borderColor: titlePlatform===p?colors.primary:colors.border, backgroundColor: titlePlatform===p?colors.primary+'20':'transparent'}} onPress={() => setTitlePlatform(p)}>
                            <Ionicons name={p==='short'?"flash":"logo-youtube"} size={20} color={titlePlatform===p?"#FF0000":colors.subText} />
                            <Text style={{marginLeft:8, fontWeight:'bold', color:colors.text}}>{p==='short'?'Shorts':'Video Dài'}</Text>
                        </TouchableOpacity>
                    ))}
                </View>
                <TouchableOpacity style={dynamicStyles.btnPrimary} onPress={generateYoutubeTitle} disabled={isGenerating}>
                    {isGenerating ? <ActivityIndicator color="#fff" /> : <Text style={dynamicStyles.btnText}>✨ Tạo Tiêu Đề</Text>}
                </TouchableOpacity>
                {titleResult ? (
                    <View style={[dynamicStyles.resultBox, {borderColor: colors.primary}]}>
                        <View style={{flexDirection:'row', justifyContent:'space-between'}}>
                             <Text style={[dynamicStyles.resultTitle, {color: colors.primary}]}>KẾT QUẢ:</Text>
                             <TouchableOpacity onPress={() => copyToClipboard(titleResult)}><Ionicons name="copy-outline" size={18} color={colors.primary}/></TouchableOpacity>
                        </View>
                        <Text style={dynamicStyles.resultText}>{titleResult}</Text>
                    </View>
                ) : null}
            </View>
          )}

          {mediaType === 'edit_image' && (
            <View style={{marginTop: 10}}>
                <View style={{flexDirection: 'row', justifyContent: 'space-between'}}>
                    <View style={{flex: 1, marginRight: 10}}>
                        <Text style={dynamicStyles.label}>1. Ảnh người mẫu:</Text>
                        <TouchableOpacity style={dynamicStyles.uploadBox} onPress={() => pickImage('model')}>
                            {modelImage ? <Image source={{ uri: `data:image/jpeg;base64,${modelImage}` }} style={{width: '100%', height: '100%', borderRadius: 10}} resizeMode="contain" /> : <Ionicons name="person-add" size={40} color={colors.subText} />}
                        </TouchableOpacity>
                    </View>
                    <View style={{flex: 1}}>
                        <Text style={dynamicStyles.label}>2. Ảnh sản phẩm:</Text>
                        <TouchableOpacity style={dynamicStyles.uploadBox} onPress={() => pickImage('product')}>
                            {productImage ? <Image source={{ uri: `data:image/jpeg;base64,${productImage}` }} style={{width: '100%', height: '100%', borderRadius: 10}} resizeMode="contain" /> : <Ionicons name="gift" size={40} color={colors.subText} />}
                        </TouchableOpacity>
                    </View>
                </View>
                
                <Text style={dynamicStyles.label}>3. Yêu cầu chỉnh sửa:</Text>
                <TextInput style={[dynamicStyles.input, {height: 100, textAlignVertical: 'top'}]} placeholder="Mô tả cách ghép..." placeholderTextColor={colors.subText} multiline value={editPrompt} onChangeText={setEditPrompt} />
                
                <TouchableOpacity style={dynamicStyles.btnPrimary} onPress={generateEditImage} disabled={isGenerating || !modelImage || !productImage}>
                    {isGenerating ? <View style={{flexDirection: 'row', alignItems: 'center'}}><ActivityIndicator color="#fff" /><Text style={[dynamicStyles.btnText, {marginLeft: 10}]}>Đang xử lý ({editTimer}s)...</Text></View> : <Text style={dynamicStyles.btnText}>🪄 Chỉnh sửa & Kết hợp</Text>}
                </TouchableOpacity>

                {editResult && (
                    <View style={[dynamicStyles.resultBox, {borderColor: colors.primary, alignItems: 'center'}]}>
                        <Text style={[dynamicStyles.resultTitle, {color: colors.primary, marginBottom: 10}]}>KẾT QUẢ:</Text>
                        <Image source={{ uri: `data:image/jpeg;base64,${editResult}` }} style={{width: 300, height: 300, borderRadius: 10}} resizeMode="contain" />
                    </View>
                )}
            </View>
          )}

          {(mediaType === 'video' || mediaType === 'image') && (
            <View style={{marginTop: 10}}>
               <View style={{flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginTop:15}}>
                  <Text style={[dynamicStyles.label, {marginTop:0}]}>Nhân Vật:</Text>
                  <View style={{flexDirection:'row', alignItems:'center'}}>
                    <Text style={{color:colors.subText, fontSize:12}}>Max:</Text>
                    <TextInput style={[dynamicStyles.input, {width:60, textAlign:'center', padding:8, height:40, marginLeft:5}]} keyboardType="numeric" value={charMaxChars} onChangeText={setCharMaxChars} />
                    <TouchableOpacity onPress={() => updateCharsList(mediaType==='video'?videoChars:imageChars, mediaType==='video'?setVideoChars:setImageChars, 'add')} style={{marginLeft:10}}><Ionicons name="add-circle" size={32} color={colors.primary}/></TouchableOpacity>
                  </View>
               </View>

               {(mediaType==='video'?videoChars:imageChars).map((char, index) => (
                 <View key={char.id} style={dynamicStyles.card}>
                    <View style={{flexDirection:'row', justifyContent:'space-between', marginBottom:10}}>
                       <Text style={{color:colors.text, fontWeight:'bold'}}>NV {index + 1}</Text>
                       <TouchableOpacity onPress={() => updateCharsList(mediaType==='video'?videoChars:imageChars, mediaType==='video'?setVideoChars:setImageChars, 'remove', char.id)}><Ionicons name="trash-outline" size={20} color="#EF4444"/></TouchableOpacity>
                    </View>
                    <TextInput style={[dynamicStyles.input, {marginBottom:10}]} placeholder="Tên..." placeholderTextColor={colors.subText} value={char.name} onChangeText={(t) => updateCharsList(mediaType==='video'?videoChars:imageChars, mediaType==='video'?setVideoChars:setImageChars, 'update', char.id, 'name', t)} />
                    <TextInput style={[dynamicStyles.input, {height:60}]} placeholder="Mô tả..." placeholderTextColor={colors.subText} multiline value={char.desc} onChangeText={(t) => updateCharsList(mediaType==='video'?videoChars:imageChars, mediaType==='video'?setVideoChars:setImageChars, 'update', char.id, 'desc', t)} />
                    <TouchableOpacity style={dynamicStyles.btnSecondary} onPress={() => generateCharPrompt(mediaType==='video'?videoChars:imageChars, mediaType==='video'?setVideoChars:setImageChars, char.id)} disabled={isGenerating}><Text style={{color:'#fff', fontWeight:'bold'}}>✨ AI Mô tả NV</Text></TouchableOpacity>
                    {char.generatedPrompt ? <View style={[dynamicStyles.resultBox, {marginTop:10, padding:10}]}><Text style={{color:colors.text, fontSize:12}}>{char.generatedPrompt}</Text></View> : null}
                 </View>
               ))}

               <Text style={dynamicStyles.label}>Nội dung chính:</Text>
               <TextInput style={[dynamicStyles.input, {height:100}]} placeholder="Mô tả ý tưởng..." placeholderTextColor={colors.subText} multiline value={mediaType==='video'?videoPromptMain:imagePromptMain} onChangeText={mediaType==='video'?setVideoPromptMain:setImagePromptMain} />

               <View style={{flexDirection:'row', justifyContent:'space-between'}}>
                  <View style={{flex:0.6, marginRight:10}}><Text style={dynamicStyles.label}>Phong cách:</Text><TextInput style={dynamicStyles.input} value={mediaType==='video'?videoStyle:imageStyle} onChangeText={mediaType==='video'?setVideoStyle:setImageStyle} /></View>
                  <View style={{flex:0.4}}><Text style={dynamicStyles.label}>Max Ký tự:</Text><TextInput style={dynamicStyles.input} keyboardType="numeric" value={mediaType==='video'?videoMaxChars:imageMaxChars} onChangeText={mediaType==='video'?setVideoMaxChars:setImageMaxChars} /></View>
               </View>

               <TouchableOpacity style={dynamicStyles.btnPrimary} onPress={mediaType==='video'?generateVideoPromptTotal:generateImagePromptTotal} disabled={isGenerating}>
                  {isGenerating ? <ActivityIndicator color="#fff" /> : <Text style={dynamicStyles.btnText}>✨ Tạo Prompt Tổng Hợp</Text>}
               </TouchableOpacity>

               {((mediaType==='video'?videoResultEn:imageResultEn) || (mediaType==='video'?videoResultVi:imageResultVi)) ? (
                 <View style={{marginTop: 20}}>
                    <View style={[dynamicStyles.resultBox, {borderColor: colors.accent}]}>
                        <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'}}>
                            <Text style={[dynamicStyles.resultTitle, {color: colors.accent}]}>🇻🇳 MÔ TẢ TIẾNG VIỆT</Text>
                            <TouchableOpacity onPress={() => copyToClipboard(mediaType==='video'?videoResultVi:imageResultVi)}>
                                <Ionicons name="copy-outline" size={18} color={colors.accent} />
                            </TouchableOpacity>
                        </View>
                        <Text style={dynamicStyles.resultText}>{mediaType==='video'?videoResultVi:imageResultVi}</Text>
                    </View>
                    <View style={[dynamicStyles.resultBox, {marginTop: 15, borderColor: colors.primary}]}>
                         <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'}}>
                            <Text style={[dynamicStyles.resultTitle, {color: colors.primary}]}>🇺🇸 PROMPT TIẾNG ANH</Text>
                            <TouchableOpacity onPress={() => copyToClipboard(mediaType==='video'?videoResultEn:imageResultEn)}>
                                <View style={{flexDirection:'row', alignItems:'center'}}>
                                    <Ionicons name="copy-outline" size={18} color={colors.primary} />
                                    <Text style={{color:colors.primary, fontWeight:'bold', marginLeft:4}}>COPY</Text>
                                </View>
                            </TouchableOpacity>
                         </View>
                        <Text style={dynamicStyles.resultText}>{mediaType==='video'?videoResultEn:imageResultEn}</Text>
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