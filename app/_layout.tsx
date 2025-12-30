import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { AppWrapper } from '@/src/components/AppWrapper';

export const unstable_settings = {
  initialRouteName: 'index',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <AppWrapper>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <Stack>
          <Stack.Screen name="index" options={{ headerShown: false, title: 'Document Library' }} />
          <Stack.Screen 
            name="pdf-viewer/[documentId]" 
            options={{ 
              headerShown: true, 
              title: 'PDF Viewer',
              headerBackTitle: 'Library'
            }} 
          />
          <Stack.Screen 
            name="merge" 
            options={{ 
              headerShown: true, 
              title: 'Merge PDFs',
              headerBackTitle: 'Library',
              presentation: 'modal'
            }} 
          />
          <Stack.Screen 
            name="split/[documentId]" 
            options={{ 
              headerShown: true, 
              title: 'Split PDF',
              headerBackTitle: 'Viewer'
            }} 
          />
          <Stack.Screen 
            name="help" 
            options={{ 
              headerShown: true, 
              title: 'Help & Support',
              headerBackTitle: 'Settings',
              presentation: 'modal'
            }} 
          />
        </Stack>
        <StatusBar style="auto" />
      </ThemeProvider>
    </AppWrapper>
  );
}
