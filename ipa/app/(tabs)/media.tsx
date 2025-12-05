import React, { useState, useCallback } from 'react';
import { 
  StyleSheet, Text, View, TouchableOpacity, TextInput, 
  ScrollView, Alert, KeyboardAvoidingView, Platform, ActivityIndicator, DimensionValue
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import * as Clipboard from 'expo-clipboard';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { useFocusEffect } from 'expo-router';

// --- TYPES ---
type DetectedChar = { name: string; visual_prompt: string; };
type MediaType = 'video' | 'image' | 'title' | 'music';

type MusicTopic = {
    title: string;
    icon: string;
    genre: string;
    prompt: string;
    chord: string;
};

type SongData = {
    song_title: string;
    song_genre: string;
    song_tempo: string;
    song_vocals: string;
    song_instruments: string;
    song_abc_notation: string;
    song_lyrics: string;
};

export default function MediaScreen() {
  const { colors } = useTheme();

  // --- STATE CHUNG ---
  const [apiKey, setApiKey] = useState('');
  const [mediaType, setMediaType] = useState<MediaType>('video'); 
  const [isGenerating, setIsGenerating] = useState(false); 

  // --- VIDEO STATE ---
  const [limitCharDesc, setLimitCharDesc] = useState('200'); 
  const [limitMainPrompt, setLimitMainPrompt] = useState('800'); 
  const [storyInput, setStoryInput] = useState(''); 
  const [detectedChars, setDetectedChars] = useState<DetectedChar[]>([]); 
  const [videoPromptEn, setVideoPromptEn] = useState(''); 
  const [videoPromptVi, setVideoPromptVi] = useState(''); 

  // --- IMAGE & TITLE STATE ---
  const [imagePrompt, setImagePrompt] = useState('');
  const [imageResult, setImageResult] = useState('');
  const [titleInput, setTitleInput] = useState('');
  const [titleResult, setTitleResult] = useState('');
  const [titlePlatform, setTitlePlatform] = useState<'short' | 'video'>('video');

  // --- MUSIC STATE ---
  const [musicInput, setMusicInput] = useState('');
  const [currentTopic, setCurrentTopic] = useState<MusicTopic | null>(null);
  const [songResult, setSongResult] = useState<SongData | null>(null);
  const [musicMode, setMusicMode] = useState<'welcome' | 'topic' | 'input'>('welcome');
  
  // State Studio
  const [extendedContent, setExtendedContent] = useState<string | null>(null);
  const [extendedTitle, setExtendedTitle] = useState('');
  const [isExtendedLoading, setIsExtendedLoading] = useState(false);

  // Load Key
  useFocusEffect(
    useCallback(() => {
        const loadKey = async () => {
            try {
                const savedKey = await AsyncStorage.getItem('GEMINI_API_KEY');
                if (savedKey) setApiKey(savedKey);
            } catch (e) { console.log("Lỗi load key:", e); }
        };
        loadKey();
    }, [])
  );

  const handleClearAll = () => {
    Alert.alert("Dọn dẹp", `Xóa sạch nội dung tab hiện tại?`, [
        { text: "Hủy", style: "cancel" },
        { text: "Xóa", style: 'destructive', onPress: () => {
            if (mediaType === 'video') {
                setStoryInput(''); setDetectedChars([]); setVideoPromptEn(''); setVideoPromptVi('');
            } else if (mediaType === 'image') {
                setImagePrompt(''); setImageResult('');
            } else if (mediaType === 'title') {
                setTitleInput(''); setTitleResult('');
            } else {
                setMusicInput(''); setCurrentTopic(null); setSongResult(null); setMusicMode('welcome'); setExtendedContent(null);
            }
        }}
    ]);
  };

  const copyToClipboard = async (text: string) => {
    if (!text) return;
    await Clipboard.setStringAsync(text);
    Alert.alert("Đã Copy!", "Đã lưu vào bộ nhớ tạm.");
  };

  const callGeminiRaw = async (prompt: string): Promise<string | null> => {
      if (!apiKey.trim()) { Alert.alert("Thiếu Key", "Vào Cài đặt nhập Key Gemini đi đại ca!"); return null; }
      try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
        const result = await model.generateContent(prompt);
        return result.response.text();
      } catch (error: any) {
        Alert.alert("Lỗi AI", error.message);
        return null;
      }
  };

  // --- VIDEO LOGIC ---
  const generateVeo3Prompt = async () => {
    if (!storyInput.trim()) return Alert.alert("Thiếu nội dung", "Nhập cốt truyện đi đại ca!");
    setIsGenerating(true);
    setDetectedChars([]); setVideoPromptEn(''); setVideoPromptVi('');

    const systemPrompt = `
      Role: Expert Video Prompt Engineer for VEO3 (8-second videos).
      Input Story: "${storyInput}"
      Constraints: Character Limit ${limitCharDesc}, Main Prompt Limit ${limitMainPrompt}. English Output.
      CRITICAL: KEEP DIALOGUE IN VIETNAMESE inside "".
      Structure: Chronological.
      Output JSON ONLY: { "characters": [{ "name": "", "visual_prompt": "" }], "main_prompt_en": "", "main_prompt_vi": "" }
    `;
    const text = await callGeminiRaw(systemPrompt);
    setIsGenerating(false);
    if (text) {
        try {
            const cleanText = text.replace(/```json|```/g, '').trim();
            const jsonRes = JSON.parse(cleanText);
            setDetectedChars(jsonRes.characters || []);
            setVideoPromptEn(jsonRes.main_prompt_en || '');
            setVideoPromptVi(jsonRes.main_prompt_vi || '');
        } catch (e) { Alert.alert("Lỗi parse", "AI trả về định dạng sai."); }
    }
  };

  // --- IMAGE & TITLE LOGIC ---
  const generateOther = async (type: 'image' | 'title') => {
      const input = type === 'image' ? imagePrompt : titleInput;
      if (!input.trim()) return Alert.alert("Thiếu nội dung", "Nhập gì đó đi đại ca!");
      setIsGenerating(true);
      const prompt = type === 'image' 
        ? `Describe image idea (English): "${input}". Translate to Vietnamese. Format: [Viet]|||[Eng]`
        : `Generate 5 YouTube titles for "${input}" (${titlePlatform}). Output titles only.`;
      const text = await callGeminiRaw(prompt);
      setIsGenerating(false);
      if (text) type === 'image' ? setImageResult(text) : setTitleResult(text);
  };

  // --- MUSIC LOGIC ---
  const predefinedTopics = [
      { title: "Tiếng Mưa Mái Tôn", icon: "rainy", genre: "Lofi / Acoustic", prompt: "Ngày mưa bão, ấm áp trong nhà, tiếng mưa ồn ào nhưng bình yên.", chord: "Cmaj7 - Am7 - Fmaj7 - G7" },
      { title: "Đôi Giày Cũ", icon: "walk", genre: "Ballad / Country", prompt: "Đôi giày mòn gót của cha, hành trình vất vả và tình yêu thầm lặng.", chord: "G - D/F# - Em - C" },
      { title: "Cơm Chiều", icon: "restaurant", genre: "Pop / Swing", prompt: "Tiếng bát đũa, mùi thức ăn, chờ bố về ăn cơm.", chord: "F - G - Em - Am" },
      { title: "Chủ Nhật Lười", icon: "bed", genre: "Reggae", prompt: "Không báo thức, chỉ có tiếng quạt và mèo kêu. Niềm vui không làm gì.", chord: "Dm7 - G7 - Cmaj7" },
      { title: "Kẹt Xe", icon: "car", genre: "Rap / Hip-hop", prompt: "Hỗn loạn giờ tan tầm, tiếng còi xe và mong muốn về nhà.", chord: "Bm - G - A - F#" },
  ];

  const handleRandomTopic = () => {
      const random = predefinedTopics[Math.floor(Math.random() * predefinedTopics.length)];
      setCurrentTopic(random);
      setMusicMode('topic');
      setSongResult(null); setExtendedContent(null);
  };

  const handleCustomMusicTopic = async () => {
      if (!musicInput.trim()) return Alert.alert("Chưa nhập", "Nhập ý tưởng đi đại ca!");
      setIsGenerating(true);
      const prompt = `Based on raw idea: "${musicInput}", generate a creative song topic (Vietnamese).
      Return JSON ONLY: { "title": "Song Title", "icon": "ionic-icon-name (e.g. musical-notes)", "genre": "Genre", "prompt": "Inspiring description", "chord": "Chord progression" }`;
      const text = await callGeminiRaw(prompt);
      setIsGenerating(false);
      if (text) {
          try {
              const cleanText = text.replace(/```json|```/g, '').trim();
              const topic = JSON.parse(cleanText);
              setCurrentTopic(topic);
              setMusicMode('topic');
              setSongResult(null); setExtendedContent(null);
          } catch (e) { Alert.alert("Lỗi", "AI không hiểu ý tưởng này."); }
      }
  };

  const composeFullSong = async () => {
      if (!currentTopic) return;
      setIsGenerating(true);
      setExtendedContent(null);
      const query = `Act as a professional songwriter. Write a full song in Vietnamese based on:
      - Title: "${currentTopic.title}"
      - Genre: ${currentTopic.genre}
      - Idea: ${currentTopic.prompt}
      Return JSON ONLY:
      {
        "song_title": "Tên bài",
        "song_genre": "Thể loại",
        "song_tempo": "Nhịp độ",
        "song_vocals": "Giọng hát",
        "song_instruments": "Nhạc cụ",
        "song_abc_notation": "Valid simple ABC Notation string for melody (X:1...)",
        "song_lyrics": "Lyrics with [Chords] inline. Use <br> for new lines."
      }`;
      const text = await callGeminiRaw(query);
      setIsGenerating(false);
      if (text) {
          try {
              const cleanText = text.replace(/```json|```/g, '').trim();
              const songData = JSON.parse(cleanText);
              setSongResult(songData);
          } catch (e) { 
               setSongResult({
                   song_title: currentTopic.title,
                   song_genre: currentTopic.genre,
                   song_tempo: "Tự do", song_vocals: "Tùy chọn", song_instruments: "Cơ bản",
                   song_abc_notation: "",
                   song_lyrics: text || "Lỗi hiển thị lời."
               });
          }
      }
  };

  const generateExtendedContent = async (type: 'arrange' | 'translate' | 'art' | 'critic' | 'mv' | 'theory') => {
      if (!songResult || !currentTopic) return;
      setIsExtendedLoading(true);
      setExtendedContent(null);
      let query = '';
      let title = '';
      switch (type) {
          case 'arrange': title = "Gợi ý Hòa âm"; query = `Analyze song "${songResult.song_title}" (${songResult.song_genre}). Provide a short music arrangement guide in Vietnamese. Use bullet points.`; break;
          case 'translate': title = "Dịch sang Tiếng Anh"; query = `Translate lyrics of "${songResult.song_title}" to English (Singable). Return lyrics only.`; break;
          case 'art': title = "Prompt Ảnh Bìa"; query = `Create a high-quality Midjourney prompt for album cover of "${songResult.song_title}" (${songResult.song_genre}). Return Prompt only (English).`; break;
          case 'critic': title = "Góc Phê Bình"; query = `Review song "${songResult.song_title}". Give Star Rating (1-5). Write a witty comment (Vietnamese). Recommend 3 similar artists.`; break;
          case 'mv': title = "Kịch Bản MV"; query = `Create a short MV script for "${songResult.song_title}". Describe 3 key scenes. Vietnamese.`; break;
          case 'theory': title = "Giải Mã Nhạc Lý"; query = `Explain the chord progression/style of "${songResult.song_title}" simply for beginners. Vietnamese.`; break;
      }
      setExtendedTitle(title);
      const text = await callGeminiRaw(query);
      setIsExtendedLoading(false);
      if (text) setExtendedContent(text);
  };

  // --- STYLES ---
  const dynamicStyles = {
    container: { flex: 1, backgroundColor: colors.bg },
    header: { flexDirection: 'row' as const, justifyContent: 'space-between' as const, alignItems: 'center' as const, marginBottom: 15 },
    title: { fontSize: 24, fontWeight: 'bold' as const, color: colors.text },
    label: { fontSize: 13, fontWeight: 'bold' as const, color: colors.subText, marginBottom: 5, marginTop: 10 },
    input: { backgroundColor: colors.iconBg, color: colors.text, borderRadius: 10, padding: 12, borderWidth: 1, borderColor: colors.border },
    btnPrimary: { backgroundColor: colors.primary, padding: 15, borderRadius: 12, alignItems: 'center' as const, marginTop: 20 },
    btnText: { color: '#fff', fontWeight: 'bold' as const, fontSize: 16 },
    tabButton: { flex: 1, paddingVertical: 10, alignItems: 'center' as const, borderRadius: 10, borderWidth: 1, borderColor: 'transparent', marginHorizontal: 2 },
    tabButtonActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    tabButtonInactive: { backgroundColor: colors.iconBg, borderColor: colors.border },
    tabText: { fontWeight: 'bold' as const, fontSize: 14 },
    resultBox: { backgroundColor: colors.inputBg, padding: 12, borderRadius: 10, marginBottom: 15, borderWidth: 1, borderColor: colors.border },
    charCard: { backgroundColor: colors.card, padding: 10, borderRadius: 8, marginBottom: 8, borderLeftWidth: 3, borderLeftColor: colors.accent, borderWidth: 1, borderColor: colors.border },
    musicCard: { backgroundColor: 'white', borderRadius: 16, overflow: 'hidden' as const, borderWidth: 1, borderColor: '#E0E7FF', marginBottom: 20, shadowColor: "#000", shadowOffset: {width: 0, height: 4}, shadowOpacity: 0.1, shadowRadius: 10, elevation: 5 },
    musicHeader: { backgroundColor: '#4F46E5', padding: 20, alignItems: 'center' as const },
    musicContent: { padding: 20, alignItems: 'center' as const },
    musicTitle: { fontSize: 22, fontWeight: 'bold' as const, color: '#4338CA', marginBottom: 5 },
    chordBadge: { backgroundColor: '#F3F4F6', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4, fontSize: 12, fontWeight: 'bold' as const, color: '#374151', marginRight: 5, borderWidth: 1, borderColor: '#E5E7EB' },
    studioGrid: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, justifyContent: 'space-between' as const, marginTop: 10 },
    studioBtn: { width: '48%' as DimensionValue, flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'center' as const, padding: 12, marginBottom: 10, borderRadius: 8, borderWidth: 1, borderColor: '#E0E7FF', backgroundColor: '#F9FAFB' },
    studioBtnText: { fontSize: 11, fontWeight: 'bold' as const, color: '#4F46E5', marginLeft: 5 },
  };

  return (
    <SafeAreaView style={dynamicStyles.container} edges={['top']}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 100 }}>
          
          <View style={dynamicStyles.header}>
              <Text style={dynamicStyles.title}>Media Creator 🎬</Text>
              <TouchableOpacity onPress={handleClearAll} style={{padding:8, backgroundColor: colors.iconBg, borderRadius:8}}><Ionicons name="trash-bin-outline" size={24} color="#EF4444" /></TouchableOpacity>
          </View>
          
          <View style={{flexDirection: 'row', marginBottom: 20}}>
              {['video', 'image', 'title', 'music'].map((t) => (
                  <TouchableOpacity key={t} 
                    style={[dynamicStyles.tabButton, mediaType === t ? dynamicStyles.tabButtonActive : dynamicStyles.tabButtonInactive]} 
                    onPress={() => setMediaType(t as MediaType)}
                  >
                      <Text style={[dynamicStyles.tabText, {color: mediaType === t ? 'white' : colors.subText}]}>
                        {t === 'video' ? 'Video' : t === 'image' ? 'Ảnh' : t === 'title' ? 'Tiêu đề' : 'Nhạc 🎵'}
                      </Text>
                  </TouchableOpacity>
              ))}
          </View>

          {mediaType === 'music' && (
            <View>
                <View style={dynamicStyles.musicCard}>
                    <View style={dynamicStyles.musicHeader}><Ionicons name="musical-notes" size={40} color="white" style={{opacity: 0.9}} /><Text style={{color: 'white', fontSize: 20, fontWeight: 'bold', marginTop: 10}}>Cảm Hứng Hôm Nay</Text><Text style={{color: '#E0E7FF', fontSize: 12}}>Khơi nguồn sáng tạo cùng AI</Text></View>
                    <View style={dynamicStyles.musicContent}>
                        {musicMode === 'welcome' && (
                            <View style={{alignItems: 'center', width: '100%'}}><Ionicons name="bulb" size={50} color="#FACC15" style={{marginBottom: 10}} /><Text style={{color: '#4B5563', fontWeight: '600', fontSize: 16}}>Bạn đang bí ý tưởng?</Text><Text style={{color: '#9CA3AF', fontSize: 13, marginBottom: 20, textAlign: 'center'}}>Chọn ngẫu nhiên hoặc nhập ý tưởng riêng.</Text><View style={{flexDirection: 'row', gap: 10, width: '100%'}}><TouchableOpacity onPress={handleRandomTopic} style={{flex: 1, backgroundColor: '#E0E7FF', padding: 12, borderRadius: 8, alignItems: 'center', flexDirection: 'row', justifyContent: 'center'}}><Ionicons name="shuffle" size={16} color="#4338CA" style={{marginRight: 5}} /><Text style={{color: '#4338CA', fontWeight: 'bold'}}>Ngẫu nhiên</Text></TouchableOpacity><TouchableOpacity onPress={() => setMusicMode('input')} style={{flex: 1, backgroundColor: '#4F46E5', padding: 12, borderRadius: 8, alignItems: 'center', flexDirection: 'row', justifyContent: 'center'}}><Ionicons name="create" size={16} color="white" style={{marginRight: 5}} /><Text style={{color: 'white', fontWeight: 'bold'}}>Tự nhập</Text></TouchableOpacity></View></View>
                        )}
                        {musicMode === 'input' && (
                            <View style={{width: '100%'}}><Text style={{fontWeight: 'bold', color: '#374151', marginBottom: 5}}>Ý tưởng sơ khai:</Text><TextInput style={[dynamicStyles.input, {height: 80, textAlignVertical: 'top', backgroundColor: '#F9FAFB'}]} placeholder="Ví dụ: Mèo phi hành gia nhớ nhà..." placeholderTextColor="#9CA3AF" multiline value={musicInput} onChangeText={setMusicInput}/><TouchableOpacity onPress={handleCustomMusicTopic} disabled={isGenerating} style={{backgroundColor: '#4F46E5', padding: 12, borderRadius: 8, alignItems: 'center', marginTop: 10}}>{isGenerating ? <ActivityIndicator color="white"/> : <Text style={{color: 'white', fontWeight: 'bold'}}>✨ Tạo Chủ Đề</Text>}</TouchableOpacity><TouchableOpacity onPress={() => setMusicMode('welcome')} style={{marginTop: 10, alignItems: 'center'}}><Text style={{color: '#6B7280'}}>Hủy</Text></TouchableOpacity></View>
                        )}
                        {musicMode === 'topic' && currentTopic && (
                            <View style={{width: '100%'}}><View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15, borderBottomWidth: 1, borderBottomColor: '#F3F4F6', paddingBottom: 10}}><Text style={dynamicStyles.musicTitle}>{currentTopic.title}</Text><View style={{width: 40, height: 40, backgroundColor: '#EEF2FF', borderRadius: 20, alignItems: 'center', justifyContent: 'center'}}><Ionicons name={(currentTopic.icon || 'musical-notes') as any} size={20} color="#6366F1" /></View></View><View style={{marginBottom: 10}}><Text style={{fontSize: 10, fontWeight: 'bold', color: '#6B7280', textTransform: 'uppercase'}}>Thể loại</Text><Text style={{fontSize: 16, color: '#4F46E5', fontWeight: 'bold'}}>{currentTopic.genre}</Text></View><View style={{backgroundColor: '#EEF2FF', padding: 12, borderRadius: 8, marginBottom: 10}}><Text style={{fontSize: 10, fontWeight: 'bold', color: '#6B7280', textTransform: 'uppercase'}}>Ý tưởng chủ đạo</Text><Text style={{fontSize: 13, color: '#374151', fontStyle: 'italic', marginTop: 2}}>"{currentTopic.prompt}"</Text></View><View><Text style={{fontSize: 10, fontWeight: 'bold', color: '#6B7280', textTransform: 'uppercase', marginBottom: 5}}>Vòng hợp âm gợi ý</Text><View style={{flexDirection: 'row', flexWrap: 'wrap'}}>{currentTopic.chord.split('-').map((c, i) => (<Text key={i} style={dynamicStyles.chordBadge}>{c.trim()}</Text>))}</View></View><TouchableOpacity onPress={composeFullSong} disabled={isGenerating} style={{backgroundColor: 'transparent', borderWidth: 1, borderColor: '#4F46E5', padding: 12, borderRadius: 25, alignItems: 'center', marginTop: 20, flexDirection: 'row', justifyContent: 'center'}}>{isGenerating ? <ActivityIndicator color="#4F46E5"/> : (<><Ionicons name="sparkles" size={16} color="#FBBF24" style={{marginRight: 5}} /><Text style={{color: '#4F46E5', fontWeight: 'bold'}}>Viết Nhạc & Lời (AI)</Text></>)}</TouchableOpacity><TouchableOpacity onPress={() => setMusicMode('welcome')} style={{marginTop: 10, alignItems: 'center'}}><Text style={{color: '#6B7280', fontSize: 12}}>Chọn chủ đề khác</Text></TouchableOpacity></View>
                        )}
                    </View>
                </View>
                {songResult && (
                    <View style={{backgroundColor: '#F8FAFC', padding: 15, borderRadius: 10, borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 20}}>
                         <View style={{flexDirection: 'row', alignItems: 'center', marginBottom: 10}}><View style={{backgroundColor: '#E9D5FF', padding: 5, borderRadius: 5, marginRight: 8}}><Ionicons name="pencil" size={16} color="#9333EA" /></View><Text style={{fontWeight: 'bold', color: '#1F2937', textTransform: 'uppercase'}}>Bản Thảo Hoàn Chỉnh</Text></View>
                         <View style={{backgroundColor: 'white', padding: 10, borderRadius: 8, marginBottom: 10, borderWidth: 1, borderColor: '#F1F5F9'}}><Text style={{fontWeight: 'bold', fontSize: 16, color: '#4338CA', marginBottom: 5}}>{songResult.song_title}</Text><View style={{flexDirection: 'row', flexWrap: 'wrap', gap: 5}}><Text style={{fontSize: 11, color: '#4B5563'}}>🎵 {songResult.song_genre}</Text><Text style={{fontSize: 11, color: '#4B5563'}}>🥁 {songResult.song_tempo}</Text><Text style={{fontSize: 11, color: '#4B5563'}}>🎤 {songResult.song_vocals}</Text></View></View>
                         <View style={{backgroundColor: 'white', padding: 15, borderRadius: 8, borderWidth: 1, borderColor: '#F1F5F9'}}><View style={{flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5}}><Text style={{fontSize: 10, fontWeight: 'bold', color: '#9CA3AF', textTransform: 'uppercase'}}>Lời & Hợp âm</Text><TouchableOpacity onPress={() => copyToClipboard(songResult.song_lyrics.replace(/<br>/g, '\n'))}><Text style={{fontSize: 10, color: '#4F46E5', fontWeight: 'bold'}}>Copy</Text></TouchableOpacity></View><Text style={{fontSize: 13, color: '#374151', lineHeight: 22}}>{songResult.song_lyrics.split('<br>').map((line, i) => (<Text key={i}>{line}{'\n'}</Text>))}</Text></View>
                         {songResult.song_abc_notation && (<View style={{marginTop: 10, padding: 10, backgroundColor: '#F0FDF4', borderRadius: 8, borderWidth: 1, borderColor: '#BBF7D0'}}><Text style={{fontSize: 10, fontWeight: 'bold', color: '#166534', marginBottom: 5}}>SHEET NHẠC (ABC NOTATION)</Text><Text style={{fontFamily: 'monospace', fontSize: 10, color: '#15803D'}}>{songResult.song_abc_notation}</Text><TouchableOpacity onPress={() => copyToClipboard(songResult.song_abc_notation)} style={{marginTop: 5}}><Text style={{fontSize: 10, color: '#16A34A', fontWeight: 'bold'}}>Copy mã này dán vào abcjs.net</Text></TouchableOpacity></View>)}
                         <View style={{marginTop: 20, paddingTop: 15, borderTopWidth: 1, borderTopColor: '#E2E8F0', borderStyle: 'dashed'}}><Text style={{textAlign: 'center', fontSize: 12, fontWeight: 'bold', color: '#64748B', marginBottom: 10, textTransform: 'uppercase'}}>✨ Studio Sáng Tạo AI</Text><View style={dynamicStyles.studioGrid}><TouchableOpacity onPress={() => generateExtendedContent('arrange')} style={dynamicStyles.studioBtn}><Ionicons name="options" size={16} color="#EC4899" /><Text style={dynamicStyles.studioBtnText}>Hòa Âm</Text></TouchableOpacity><TouchableOpacity onPress={() => generateExtendedContent('translate')} style={dynamicStyles.studioBtn}><Ionicons name="language" size={16} color="#3B82F6" /><Text style={dynamicStyles.studioBtnText}>Dịch Anh</Text></TouchableOpacity><TouchableOpacity onPress={() => generateExtendedContent('art')} style={dynamicStyles.studioBtn}><Ionicons name="image" size={16} color="#10B981" /><Text style={dynamicStyles.studioBtnText}>Ảnh Bìa</Text></TouchableOpacity><TouchableOpacity onPress={() => generateExtendedContent('critic')} style={dynamicStyles.studioBtn}><Ionicons name="star" size={16} color="#F59E0B" /><Text style={dynamicStyles.studioBtnText}>Phê Bình</Text></TouchableOpacity><TouchableOpacity onPress={() => generateExtendedContent('mv')} style={dynamicStyles.studioBtn}><Ionicons name="videocam" size={16} color="#EF4444" /><Text style={dynamicStyles.studioBtnText}>Kịch Bản</Text></TouchableOpacity><TouchableOpacity onPress={() => generateExtendedContent('theory')} style={dynamicStyles.studioBtn}><Ionicons name="school" size={16} color="#8B5CF6" /><Text style={dynamicStyles.studioBtnText}>Nhạc Lý</Text></TouchableOpacity></View>{isExtendedLoading && <ActivityIndicator color={colors.primary} style={{marginTop: 10}} />}{extendedContent && (<View style={{marginTop: 10, padding: 15, backgroundColor: 'white', borderRadius: 8, borderWidth: 1, borderColor: '#CBD5E1', borderLeftWidth: 4, borderLeftColor: colors.primary}}><View style={{flexDirection:'row', justifyContent:'space-between', marginBottom: 5}}><Text style={{fontWeight: 'bold', color: colors.primary}}>{extendedTitle}</Text><TouchableOpacity onPress={() => setExtendedContent(null)}><Ionicons name="close" size={16} color="#94A3B8"/></TouchableOpacity></View><Text style={{color: '#334155', fontSize: 13, lineHeight: 20}}>{extendedContent}</Text><TouchableOpacity onPress={() => copyToClipboard(extendedContent)} style={{marginTop: 10}}><Text style={{fontSize: 11, fontWeight:'bold', color: colors.primary}}>Copy nội dung</Text></TouchableOpacity></View>)}</View>
                    </View>
                )}
            </View>
          )}

          {mediaType === 'video' && (
             <View>
                 <View style={{flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10}}>
                    <View style={{flex: 0.48}}><Text style={dynamicStyles.label}>Max ký tự NV:</Text><TextInput style={dynamicStyles.input} keyboardType="numeric" value={limitCharDesc} onChangeText={setLimitCharDesc} placeholder="200" /></View>
                    <View style={{flex: 0.48}}><Text style={dynamicStyles.label}>Max ký tự Video:</Text><TextInput style={dynamicStyles.input} keyboardType="numeric" value={limitMainPrompt} onChangeText={setLimitMainPrompt} placeholder="1000" /></View>
                </View>
                <Text style={dynamicStyles.label}>Nội dung / Câu chuyện (8s):</Text>
                <TextInput style={[dynamicStyles.input, {height: 120, textAlignVertical: 'top'}]} placeholder="Ví dụ: Tèo đang ngồi code..." placeholderTextColor={colors.subText} multiline value={storyInput} onChangeText={setStoryInput} />
                <TouchableOpacity style={dynamicStyles.btnPrimary} onPress={generateVeo3Prompt} disabled={isGenerating}>
                    {isGenerating ? <ActivityIndicator color="#fff" /> : <Text style={dynamicStyles.btnText}>✨ Phân tích & Tạo Prompt</Text>}
                </TouchableOpacity>
                {(detectedChars.length > 0 || videoPromptEn) && (
                    <View style={{marginTop: 25}}>
                        {detectedChars.length > 0 && (
                            <View style={{marginBottom: 15}}>
                                <Text style={[dynamicStyles.label, {color: colors.accent}]}>👥 NHÂN VẬT:</Text>
                                {detectedChars.map((char, index) => (
                                    <View key={index} style={dynamicStyles.charCard}>
                                        <View style={{flexDirection: 'row', justifyContent: 'space-between'}}>
                                            <Text style={{fontWeight: 'bold', color: colors.text}}>{char.name}</Text>
                                            <TouchableOpacity onPress={() => copyToClipboard(char.visual_prompt)}><Ionicons name="copy-outline" size={16} color={colors.subText}/></TouchableOpacity>
                                        </View>
                                        <Text style={{fontSize: 12, color: colors.subText, marginTop: 4}}>{char.visual_prompt}</Text>
                                    </View>
                                ))}
                            </View>
                        )}
                        <Text style={[dynamicStyles.label, {color: colors.primary}]}>🇺🇸 PROMPT VIDEO:</Text>
                        
                        {/* [ĐÃ THÊM LẠI] Nút Copy cho phần Video Prompt */}
                        <View style={[dynamicStyles.resultBox, {borderColor: colors.primary}]}>
                            <View style={{flexDirection:'row', justifyContent:'flex-end', marginBottom: 5}}>
                                <TouchableOpacity onPress={() => copyToClipboard(videoPromptEn)}>
                                    <View style={{flexDirection:'row', alignItems:'center'}}>
                                        <Ionicons name="copy" size={16} color={colors.primary} />
                                        <Text style={{fontSize:12, fontWeight:'bold', color:colors.primary, marginLeft:5}}>COPY</Text>
                                    </View>
                                </TouchableOpacity>
                            </View>
                            <Text style={{color: colors.text, fontStyle: 'italic'}}>{videoPromptEn}</Text>
                        </View>

                        <Text style={[dynamicStyles.label, {color: colors.success}]}>🇻🇳 NỘI DUNG VIỆT:</Text>
                        <View style={[dynamicStyles.resultBox, {borderColor: colors.success}]}><Text style={{color: colors.text}}>{videoPromptVi}</Text></View>
                    </View>
                )}
             </View>
          )}

          {mediaType === 'image' && (
            <View>
                <Text style={dynamicStyles.label}>Ý tưởng ảnh:</Text>
                <TextInput style={[dynamicStyles.input, {height: 100}]} multiline value={imagePrompt} onChangeText={setImagePrompt} placeholder="Mô tả ảnh..." placeholderTextColor={colors.subText}/>
                <TouchableOpacity style={dynamicStyles.btnPrimary} onPress={() => generateOther('image')} disabled={isGenerating}>
                    {isGenerating ? <ActivityIndicator color="#fff" /> : <Text style={dynamicStyles.btnText}>✨ Tạo Prompt Ảnh</Text>}
                </TouchableOpacity>
                {imageResult ? <View style={[dynamicStyles.resultBox, {marginTop: 20}]}><Text style={{color:colors.text}}>{imageResult}</Text></View> : null}
            </View>
          )}

          {mediaType === 'title' && (
             <View>
                <Text style={dynamicStyles.label}>Nội dung video:</Text>
                <TextInput style={[dynamicStyles.input, {height: 100}]} multiline value={titleInput} onChangeText={setTitleInput} placeholder="Nội dung..." placeholderTextColor={colors.subText}/>
                <View style={{flexDirection: 'row', marginTop: 10}}>
                    {['video', 'short'].map((p: any) => (
                        <TouchableOpacity key={p} onPress={() => setTitlePlatform(p)} style={{padding: 10, marginRight: 10, borderRadius: 8, backgroundColor: titlePlatform === p ? colors.primary : colors.iconBg}}>
                            <Text style={{color: titlePlatform === p ? 'white' : colors.text}}>{p === 'short' ? 'Shorts' : 'Video Dài'}</Text>
                        </TouchableOpacity>
                    ))}
                </View>
                <TouchableOpacity style={dynamicStyles.btnPrimary} onPress={() => generateOther('title')} disabled={isGenerating}>
                     {isGenerating ? <ActivityIndicator color="#fff" /> : <Text style={dynamicStyles.btnText}>✨ Tạo Tiêu Đề</Text>}
                </TouchableOpacity>
                {titleResult ? <View style={[dynamicStyles.resultBox, {marginTop: 20}]}><Text style={{color:colors.text}}>{titleResult}</Text></View> : null}
             </View>
          )}

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}