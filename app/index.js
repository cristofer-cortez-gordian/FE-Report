import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useRef, useState } from 'react';
import {
    Alert,
    Image,
    KeyboardAvoidingView, Platform,
    StatusBar,
    StyleSheet, Text,
    TextInput, TouchableOpacity,
    View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BRAND } from '../constants/theme';
import supabase from '../supabase';
import { migrateLocalReportsToUser, restoreUserSnapshot, saveUserSnapshot } from '../utils/backup';

WebBrowser.maybeCompleteAuthSession();

export default function LoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const syncLockRef = useRef(false);
  const PENDING_SIGNUPS_KEY = '@pending_signups';

  const loadPendingSignups = async () => {
    try {
      const json = await AsyncStorage.getItem(PENDING_SIGNUPS_KEY);
      const list = json ? JSON.parse(json) : [];
      return Array.isArray(list) ? list : [];
    } catch (e) {
      return [];
    }
  };

  const savePendingSignups = async (list) => {
    const safeList = Array.isArray(list) ? list : [];
    await AsyncStorage.setItem(PENDING_SIGNUPS_KEY, JSON.stringify(safeList));
  };

  const upsertPendingSignup = async (pendingEmail, pendingPassword) => {
    const list = await loadPendingSignups();
    const normalized = String(pendingEmail || '').toLowerCase();
    if (!normalized || !pendingPassword) return list;
    const payload = { email: normalized, password: pendingPassword, createdAt: new Date().toISOString() };
    const idx = list.findIndex((item) => String(item?.email || '').toLowerCase() === normalized);
    if (idx >= 0) list[idx] = payload;
    else list.push(payload);
    await savePendingSignups(list);
    return list;
  };

  const syncPendingSignups = async () => {
    if (syncLockRef.current) return;
    syncLockRef.current = true;
    try {
      const list = await loadPendingSignups();
      if (!list.length) return;

      const remaining = [];
      for (const item of list) {
        const pendingEmail = String(item?.email || '').toLowerCase();
        const pendingPassword = String(item?.password || '');
        if (!pendingEmail || !pendingPassword) continue;

        let canContinue = true;
        try {
          const { error } = await supabase.auth.signUp({
            email: pendingEmail,
            password: pendingPassword
          });
          if (error && !String(error.message || '').toLowerCase().includes('already registered')) {
            canContinue = false;
          }
        } catch (e) {
          canContinue = false;
        }

        if (!canContinue) {
          remaining.push(item);
          continue;
        }

        try {
          const { error: signInError } = await supabase.auth.signInWithPassword({
            email: pendingEmail,
            password: pendingPassword
          });
          if (!signInError) {
            const { data: userData } = await supabase.auth.getUser();
            const userEmail = userData?.user?.email || pendingEmail;
            if (userEmail) await AsyncStorage.setItem('@user_session', userEmail);
            await restoreUserSnapshot();
            await saveUserSnapshot();
          }
        } catch (e) {
          // Ignore sign-in errors; account may need email confirmation.
        }
      }

      await savePendingSignups(remaining);
    } finally {
      syncLockRef.current = false;
    }
  };

  useEffect(() => {
    syncPendingSignups();
    const unsubscribe = NetInfo.addEventListener((state) => {
      if (state.isConnected && state.isInternetReachable !== false) {
        syncPendingSignups();
      }
    });
    return () => unsubscribe();
  }, []);



  const handleAuth = async () => {
    setErrorMsg('');
    if (!email.trim() || !password.trim()) {
      setErrorMsg('Por favor completa todos los campos.');
      return;
    }

    try {
      setIsSyncing(true);
      const normalizedEmail = email.trim().toLowerCase();
      const net = await NetInfo.fetch();
      const offline = !net.isConnected || net.isInternetReachable === false;

      let isOnlineLoginSuccess = false;
      let sessionDataToUse = null;

      try {
        if (isLoginMode) {
          const { data, error } = await supabase.auth.signInWithPassword({
            email: normalizedEmail,
            password
          });
          if (error) throw error;
          if (data?.session?.access_token) {
            await AsyncStorage.setItem('@custom_access_token', data.session.access_token);
          }
          sessionDataToUse = data;
          isOnlineLoginSuccess = true;
        } else {
          const { data, error } = await supabase.auth.signUp({
            email: normalizedEmail,
            password
          });
          if (error) throw error;
          if (!data?.session) {
            Alert.alert('Revisa tu correo', 'Te enviamos un enlace para confirmar tu cuenta.');
            return;
          }
          if (data?.session?.access_token) {
            await AsyncStorage.setItem('@custom_access_token', data.session.access_token);
          }
          sessionDataToUse = data;
          isOnlineLoginSuccess = true;
        }
      } catch (e) {
        const msg = e?.message?.toLowerCase() || '';
        const isNetworkError = msg.includes('network') || msg.includes('fetch') || msg.includes('offline');
        
        if (isNetworkError || offline) {
          // Fallback to offline mode
          const { data: sessionData } = await supabase.auth.getSession();
          const sessionEmail = sessionData?.session?.user?.email?.toLowerCase() || '';
          if (sessionEmail && sessionEmail === normalizedEmail) {
            await AsyncStorage.setItem('@user_session', sessionEmail);
            router.replace('/home');
            return;
          }
          const storedEmail = (await AsyncStorage.getItem('@user_session'))?.toLowerCase() || '';
          if (storedEmail && storedEmail === normalizedEmail) {
            router.replace('/home');
            return;
          }
          const pending = await loadPendingSignups();
          const match = pending.find((item) => {
            const itemEmail = String(item?.email || '').toLowerCase();
            return itemEmail === normalizedEmail && String(item?.password || '') === String(password);
          });
          if (match) {
            await AsyncStorage.setItem('@user_session', normalizedEmail);
            router.replace('/home');
            return;
          }

          if (!isLoginMode) {
            await upsertPendingSignup(normalizedEmail, password);
            await AsyncStorage.setItem('@user_session', normalizedEmail);
            Alert.alert('Cuenta creada offline', 'Se sincronizará automáticamente cuando haya internet.');
            router.replace('/home');
            return;
          }

          setErrorMsg('Sin internet: inicia sesión una vez en línea para habilitar el acceso offline.');
          return;
        } else {
          // Real auth error
          throw e;
        }
      }



      const { data: userData } = await supabase.auth.getUser();
      const userEmail = userData?.user?.email || normalizedEmail;
      if (userEmail) await AsyncStorage.setItem('@user_session', userEmail);
      await restoreUserSnapshot();
      await saveUserSnapshot();
      await migrateLocalReportsToUser();
      router.replace('/home');
    } catch (e) {
      const msg = e?.message || '';
      if (msg.toLowerCase().includes('invalid login')) {
        setErrorMsg('Correo o contraseña incorrectos.');
      } else if (msg.toLowerCase().includes('email not confirmed')) {
        setErrorMsg('Tu correo no está confirmado. Revisa tu bandeja.');
      } else if (msg.toLowerCase().includes('already registered')) {
        setErrorMsg('Este correo ya está registrado.');
      } else {
        setErrorMsg('No se pudo iniciar sesión.');
      }
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[styles.container, { paddingBottom: insets.bottom }]}
    >
      <StatusBar barStyle="light-content" />
      <View style={styles.bgOrbA} />
      <View style={styles.bgOrbB} />
      <View style={styles.contentContainer}>
        <View style={styles.header}>
          <Image 
            source={require('../assets/images/logofe-report1.png')} 
            style={{width: 200, height: 200, borderRadius: 100, resizeMode: 'contain', marginBottom: 5, alignSelf: 'center'}}
          />
          <Text style={styles.title}>FE-Report</Text>
          <Text style={styles.subtitle}>Inicia sesión</Text>
        </View>

        <View style={styles.form}>
          <Text style={styles.label}>Email</Text>
          <TextInput 
            style={[styles.input, errorMsg && !email ? styles.inputError : null]} 
            placeholder="ejemplo@correo.com" 
            placeholderTextColor="#666"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
          />

          <Text style={styles.label}>Contraseña</Text>
          <View style={[styles.passwordContainer, errorMsg && !password ? styles.inputError : null]}>
            <TextInput 
              style={styles.inputPassword} 
              secureTextEntry={!showPassword} 
              placeholderTextColor="#666"
              value={password}
              onChangeText={setPassword}
            />
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeIcon}>
              <Ionicons name={showPassword ? "eye-off" : "eye"} size={24} color="#888" />
            </TouchableOpacity>
          </View>

          {errorMsg ? <Text style={{color: BRAND.colors.danger, marginBottom: 10, textAlign: 'center'}}>{errorMsg}</Text> : null}
          {isSyncing ? <Text style={styles.syncText}>Sincronizando...</Text> : null}

          <TouchableOpacity style={styles.button} onPress={handleAuth}>
            <Text style={styles.buttonText}>INICIAR SESIÓN</Text>
          </TouchableOpacity>


        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BRAND.colors.bg },
  contentContainer: { flex: 1, justifyContent: 'center', padding: 24 },
  header: { marginBottom: 36, alignItems: 'center' },
  title: { fontSize: 34, color: BRAND.colors.text, fontFamily: BRAND.fonts.title, letterSpacing: 0.8 },
  subtitle: { fontSize: 14, color: BRAND.colors.textMuted, marginTop: 6, fontFamily: BRAND.fonts.body },
  form: { width: '100%' },
  label: { color: BRAND.colors.textMuted, fontSize: 12, fontFamily: BRAND.fonts.semi, marginBottom: 8, letterSpacing: 0.6 },
  input: { width: '100%', height: 54, backgroundColor: BRAND.colors.card, borderRadius: BRAND.radius.md, paddingHorizontal: 16, color: BRAND.colors.text, marginBottom: 18, borderWidth: 1, borderColor: BRAND.colors.border, fontFamily: BRAND.fonts.body },
  passwordContainer: { width: '100%', height: 54, backgroundColor: BRAND.colors.card, borderRadius: BRAND.radius.md, flexDirection: 'row', alignItems: 'center', marginBottom: 18, borderWidth: 1, borderColor: BRAND.colors.border },
  inputPassword: { flex: 1, height: '100%', paddingHorizontal: 16, color: BRAND.colors.text, fontFamily: BRAND.fonts.body },
  eyeIcon: { padding: 10 },
  button: { width: '100%', height: 54, backgroundColor: BRAND.colors.accent, borderRadius: BRAND.radius.pill, alignItems: 'center', justifyContent: 'center', marginTop: 6 },
  buttonText: { color: BRAND.colors.ink, fontSize: 15, fontFamily: BRAND.fonts.semi, letterSpacing: 0.6 },
  switchContainer: { marginTop: 22, alignItems: 'center' },
  switchText: { color: BRAND.colors.textMuted, textDecorationLine: 'underline', fontFamily: BRAND.fonts.body }
  ,dividerRow: { flexDirection: 'row', alignItems: 'center', marginTop: 18, marginBottom: 10 },
  dividerLine: { flex: 1, height: 1, backgroundColor: BRAND.colors.border },
  dividerText: { color: BRAND.colors.textMuted, marginHorizontal: 10, fontFamily: BRAND.fonts.body },
  googleBtn: { width: '100%', height: 50, backgroundColor: BRAND.colors.cardAlt, borderRadius: BRAND.radius.pill, alignItems: 'center', justifyContent: 'center', marginTop: 10, borderWidth: 1, borderColor: BRAND.colors.border },
  appleBtn: { width: '100%', height: 50, backgroundColor: BRAND.colors.cardAlt, borderRadius: BRAND.radius.pill, alignItems: 'center', justifyContent: 'center', marginTop: 10, borderWidth: 1, borderColor: BRAND.colors.border },
  appleBtnDisabled: { opacity: 0.5 },
  socialContent: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  googleIcon: { width: 18, height: 18 },
  socialTextDark: { color: BRAND.colors.text, fontSize: 13, fontFamily: BRAND.fonts.semi },
  socialTextLight: { color: BRAND.colors.text, fontSize: 13, fontFamily: BRAND.fonts.semi },
  syncText: { color: BRAND.colors.accentStrong, textAlign: 'center', marginBottom: 10, fontFamily: BRAND.fonts.body },
  bgOrbA: { position: 'absolute', width: 260, height: 260, borderRadius: 130, backgroundColor: 'rgba(70,241,255,0.16)', top: -90, right: -60, opacity: 0.6 },
  bgOrbB: { position: 'absolute', width: 230, height: 230, borderRadius: 115, backgroundColor: 'rgba(199,163,49,0.18)', bottom: -70, left: -40, opacity: 0.6 },
});