import { Orbitron_600SemiBold, Orbitron_700Bold } from '@expo-google-fonts/orbitron';
import { Sora_400Regular, Sora_500Medium, Sora_600SemiBold } from '@expo-google-fonts/sora';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { testSupabaseConnection } from '../supabase';
import { registerBackgroundSync } from '../utils/backgroundSync';
import { recoverLocalAssetsOnStartup } from '../utils/backup';
import { startNetworkListener } from '../utils/networkSync';

export default function Layout() {
  const [fontsLoaded] = useFonts({
    Orbitron_600SemiBold,
    Orbitron_700Bold,
    Sora_400Regular,
    Sora_500Medium,
    Sora_600SemiBold,
  });

  useEffect(() => {
    SplashScreen.preventAutoHideAsync();
    // Start network listener when app loads
    const unsubscribe = startNetworkListener();
    if (Platform.OS !== 'web') {
      registerBackgroundSync();
      recoverLocalAssetsOnStartup();
    }

    testSupabaseConnection()
      .then((result) => {
        console.log('[SupabaseCheck] Connection test result:', result);
      })
                                                                         
      .catch((error) => {
        console.log('[SupabaseCheck] Connection test failed:', error);
      });

    // Cleanup when app unmounts
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" /> 
      <Stack.Screen name="home" />
      <Stack.Screen name="reporte_alarma" />
      <Stack.Screen name="reporte_supresion" />
      <Stack.Screen name="ReportesBombas" />
      <Stack.Screen name="reportehidrantes" />
      <Stack.Screen name="historial" />
      <Stack.Screen name="backups" />
    </Stack>
  );
}
