import { Stack } from 'expo-router';
import { ThemeProvider } from './context/ThemeContext'; // Đảm bảo đường dẫn đúng tới file context

export default function RootLayout() {
  return (
    // Đây là "Trạm phát điện" cung cấp Theme cho toàn bộ App
    <ThemeProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      </Stack>
    </ThemeProvider>
  );
}