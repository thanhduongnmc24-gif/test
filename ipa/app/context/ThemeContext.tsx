import React, { createContext, useState, useContext, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

type ThemeType = 'light' | 'dark';

interface ThemeContextProps {
  theme: ThemeType;
  toggleTheme: () => void;
  colors: any;
}

const Themes = {
  light: {
    bg: '#F3F4F6',       // Xám rất nhạt (nền tổng)
    card: '#FFFFFF',     // Trắng tinh (nền thẻ)
    text: '#111827',     // Đen than (dễ đọc hơn đen tuyền)
    subText: '#6B7280',  // Xám trung tính
    primary: '#4F46E5',  // Indigo đậm (Màu chủ đạo)
    accent: '#F59E0B',   // Vàng nghệ (Điểm nhấn)
    border: '#E5E7EB',   // Viền rất nhạt
    success: '#10B981',  // Xanh lá
    error: '#EF4444',    // Đỏ
    inputBg: '#F9FAFB',
    tabActive: '#4F46E5',
    tabInactive: '#9CA3AF'
  },
  dark: {
    bg: '#111827',       // Đen than chì (không phải đen thui)
    card: '#1F2937',     // Xám đậm
    text: '#F9FAFB',     // Trắng đục
    subText: '#9CA3AF',  // Xám sáng
    primary: '#818CF8',  // Indigo sáng
    accent: '#FBBF24',   // Vàng sáng
    border: '#374151',   // Viền tối
    success: '#34D399',
    error: '#F87171',
    inputBg: '#111827',
    tabActive: '#818CF8',
    tabInactive: '#4B5563'
  }
};

const ThemeContext = createContext<ThemeContextProps>({
  theme: 'light',
  toggleTheme: () => {},
  colors: Themes.light,
});

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const [theme, setTheme] = useState<ThemeType>('light');

  useEffect(() => { loadTheme(); }, []);

  const loadTheme = async () => {
    try {
      const savedTheme = await AsyncStorage.getItem('APP_THEME');
      if (savedTheme) setTheme(savedTheme as ThemeType);
    } catch (e) {}
  };

  const toggleTheme = async () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    try { await AsyncStorage.setItem('APP_THEME', newTheme); } catch (e) {}
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, colors: Themes[theme] }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);