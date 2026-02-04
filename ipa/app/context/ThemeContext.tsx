import React, { createContext, useContext, useState, useEffect } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Định nghĩa bảng màu
const themes = {
  light: {
    theme: 'light',
    bg: '#F3F4F6',        // Xám rất nhạt (nền)
    card: '#FFFFFF',      // Trắng tinh (thẻ)
    text: '#111827',      // Đen than (chữ chính)
    subText: '#6B7280',   // Xám vừa (chữ phụ)
    border: '#E5E7EB',    // Viền nhạt
    primary: '#2563EB',   // Xanh dương chủ đạo
    iconBg: '#EFF6FF',    // Nền icon nhạt
    success: '#10B981',   // Màu xanh lá
    error: '#EF4444',     // Màu đỏ
    inputBg: '#F9FAFB'    // Nền ô nhập liệu
  },
  dark: {
    theme: 'dark',
    // --- MÀU MỚI ĐÃ CHỈNH SỬA (DỊU MẮT HƠN) ---
    bg: '#18181B',        // Xám đen (Zinc 900) - Không đen kịt
    card: '#27272A',      // Xám đậm (Zinc 800) - Nổi bật trên nền
    text: '#F4F4F5',      // Trắng đục (Zinc 100) - Đọc không chói
    subText: '#A1A1AA',   // Xám bạc (Zinc 400)
    border: '#3F3F46',    // Viền xám (Zinc 700)
    primary: '#60A5FA',   // Xanh dương sáng hơn chút cho nổi trên nền tối
    iconBg: '#3F3F46',    // Nền icon
    success: '#34D399',   // Xanh lá sáng
    error: '#F87171',     // Đỏ sáng
    inputBg: '#27272A'    // Nền ô nhập liệu trùng màu card
  },
};

type ThemeContextType = {
  theme: 'light' | 'dark';
  colors: typeof themes.light;
  toggleTheme: () => void;
  setTheme: (theme: 'light' | 'dark') => void;
};

const ThemeContext = createContext<ThemeContextType>({
  theme: 'light',
  colors: themes.light,
  toggleTheme: () => {},
  setTheme: () => {},
});

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const systemScheme = useColorScheme();
  const [theme, setThemeState] = useState<'light' | 'dark'>(systemScheme === 'dark' ? 'dark' : 'light');

  useEffect(() => {
    AsyncStorage.getItem('APP_THEME').then(savedTheme => {
      if (savedTheme === 'light' || savedTheme === 'dark') {
        setThemeState(savedTheme);
      }
    });
  }, []);

  const toggleTheme = async () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setThemeState(newTheme);
    await AsyncStorage.setItem('APP_THEME', newTheme);
  };

  const setTheme = async (newTheme: 'light' | 'dark') => {
    setThemeState(newTheme);
    await AsyncStorage.setItem('APP_THEME', newTheme);
  };

  return (
    <ThemeContext.Provider value={{ theme, colors: themes[theme], toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);