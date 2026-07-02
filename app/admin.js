import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Alert, TextInput, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BRAND } from '../constants/theme';
import AsyncStorage from '@react-native-async-storage/async-storage';
import supabase from '../supabase';

export default function AdminScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [tab, setTab] = useState('empleados');
  const [users, setUsers] = useState([]);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [searchReport, setSearchReport] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');

  useEffect(() => {
    if (tab === 'empleados') loadUsers();
    else loadAllReports();
  }, [tab]);

  const invokeAdminFunction = async (action, payload = {}) => {
    const { data: sessionData } = await supabase.auth.getSession();
    let token = sessionData?.session?.access_token;
    
    // Si la librería oficial pierde el token, lo recuperamos manualmente
    if (!token) {
      token = await AsyncStorage.getItem('@custom_access_token');
    }
    
    if (!token) {
      throw new Error("Sesión caducada. Por favor, cierra sesión y vuelve a iniciarla.");
    }
    
    // We use the direct Supabase URL to bypass the supabase-js React Native fetch bug
    const supabaseUrl = 'https://bzvkeqrwegpvioihzeeu.supabase.co';
    
    const response = await fetch(`${supabaseUrl}/functions/v1/admin-users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify({ action, payload })
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `Error ${response.status}`;
      try {
        const parsed = JSON.parse(errorText);
        errorMessage = parsed.error || parsed.message || errorText;
        if (parsed.details) errorMessage += ` (${parsed.details})`;
      } catch (e) {
        errorMessage = errorText;
      }
      throw new Error(errorMessage);
    }

    const data = await response.json();
    if (data.error) throw new Error(data.error);
    return data;
  };

  const loadUsers = async () => {
    setLoading(true);
    try {
      const data = await invokeAdminFunction('list_users');
      if (data?.users) setUsers(data.users);
    } catch (e) {
      Alert.alert('Error de Acceso', e.message);
    } finally {
      setLoading(false);
    }
  };

  const loadAllReports = async () => {
    setLoading(true);
    try {
      const data = await invokeAdminFunction('list_all_reports');
      if (data?.reports) setReports(data.reports);
    } catch (e) {
      Alert.alert('Error de Acceso', e.message);
    } finally {
      setLoading(false);
    }
  };

  const updateUser = async () => {
    if (!editingUser) return;
    setLoading(true);
    try {
      await invokeAdminFunction('update_user', { 
        id: editingUser.id, 
        email: newEmail || undefined, 
        password: newPassword || undefined 
      });
      Alert.alert('Éxito', 'Usuario actualizado correctamente');
      setEditingUser(null);
      setNewPassword('');
      loadUsers();
    } catch (e) {
      Alert.alert('Error al Actualizar', e.message);
    } finally {
      setLoading(false);
    }
  };

  const createUser = async () => {
    if (!newUserEmail || !newUserPassword) {
      Alert.alert('Error', 'El correo y la contraseña son obligatorios.');
      return;
    }
    if (newUserPassword.length < 6) {
      Alert.alert('Error', 'La contraseña debe tener al menos 6 caracteres.');
      return;
    }
    setLoading(true);
    try {
      await invokeAdminFunction('create_user', { 
        email: newUserEmail, 
        password: newUserPassword 
      });
      Alert.alert('Éxito', 'Empleado creado correctamente');
      setShowAddForm(false);
      setNewUserEmail('');
      setNewUserPassword('');
      loadUsers();
    } catch (e) {
      Alert.alert('Error al Crear', e.message);
    } finally {
      setLoading(false);
    }
  };

  const renderEmpleado = ({ item }) => (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{item.email}</Text>
      <Text style={styles.cardSub}>Último acceso: {new Date(item.last_sign_in_at || item.created_at).toLocaleDateString()}</Text>
      <TouchableOpacity 
        style={styles.btnSmall}
        onPress={() => { setEditingUser(item); setNewEmail(item.email); setNewPassword(''); }}
      >
        <Text style={styles.btnText}>Modificar</Text>
      </TouchableOpacity>
    </View>
  );

  const filteredReports = reports.filter(r => 
    (r.client || r.cliente || '').toLowerCase().includes(searchReport.toLowerCase()) ||
    (r.user_id || '').toLowerCase().includes(searchReport.toLowerCase())
  );

  const renderReporte = ({ item }) => {
    const reportData = typeof item.data === 'object' ? item.data : item;
    return (
      <View style={styles.card}>
        <Text style={styles.cardTitle}>{item.client || item.cliente || 'Sin Cliente'}</Text>
        <Text style={styles.cardSub}>Tipo: {item.tipo || reportData.tipo || 'No especificado'}</Text>
        <Text style={styles.cardSub}>Técnico (ID): {item.user_id}</Text>
        <Text style={styles.cardSub}>Fecha: {new Date(item.last_backup || item.created_at).toLocaleString()}</Text>
      </View>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={{padding: 10, marginRight: 10}}>
          <Text style={{color: BRAND.colors.ink, fontSize: 18}}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Panel Administrador</Text>
      </View>

      <View style={styles.tabContainer}>
        <TouchableOpacity style={[styles.tab, tab === 'empleados' && styles.tabActive]} onPress={() => setTab('empleados')}>
          <Text style={[styles.tabText, tab === 'empleados' && styles.tabTextActive]}>Gestión Empleados</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, tab === 'historial' && styles.tabActive]} onPress={() => setTab('historial')}>
          <Text style={[styles.tabText, tab === 'historial' && styles.tabTextActive]}>Historial Global</Text>
        </TouchableOpacity>
      </View>

      {loading && <ActivityIndicator size="large" color={BRAND.colors.accent} style={{ marginTop: 20 }} />}

      {tab === 'empleados' && !editingUser && !showAddForm && (
        <View style={{flex: 1}}>
          <TouchableOpacity style={[styles.btnFull, { marginHorizontal: 16, marginTop: 10, backgroundColor: BRAND.colors.primary }]} onPress={() => setShowAddForm(true)}>
            <Text style={styles.btnText}>➕ Crear Nuevo Empleado</Text>
          </TouchableOpacity>
          <FlatList
            data={users}
            keyExtractor={i => i.id}
            renderItem={renderEmpleado}
            contentContainerStyle={styles.list}
            refreshing={loading}
            onRefresh={loadUsers}
            ListEmptyComponent={!loading && <Text style={styles.empty}>No hay empleados.</Text>}
          />
        </View>
      )}

      {tab === 'empleados' && showAddForm && (
        <View style={styles.editForm}>
          <Text style={styles.editTitle}>Crear Nuevo Empleado</Text>
          <Text style={styles.label}>Correo Electrónico *</Text>
          <TextInput style={styles.input} value={newUserEmail} onChangeText={setNewUserEmail} autoCapitalize="none" keyboardType="email-address" placeholder="empleado@empresa.com" />
          <Text style={styles.label}>Contraseña *</Text>
          <TextInput style={styles.input} value={newUserPassword} onChangeText={setNewUserPassword} secureTextEntry placeholder="Mínimo 6 caracteres" />
          
          <TouchableOpacity style={[styles.btnFull, {backgroundColor: BRAND.colors.primary}]} onPress={createUser}>
            <Text style={styles.btnText}>Crear Empleado</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.btnFull, {backgroundColor: '#555', marginTop: 10}]} onPress={() => { setShowAddForm(false); setNewUserEmail(''); setNewUserPassword(''); }}>
            <Text style={styles.btnText}>Cancelar</Text>
          </TouchableOpacity>
        </View>
      )}

      {tab === 'empleados' && editingUser && (
        <View style={styles.editForm}>
          <Text style={styles.editTitle}>Editando a: {editingUser.email}</Text>
          <Text style={styles.label}>Nuevo Correo (opcional)</Text>
          <TextInput style={styles.input} value={newEmail} onChangeText={setNewEmail} autoCapitalize="none" />
          <Text style={styles.label}>Nueva Contraseña (opcional)</Text>
          <TextInput style={styles.input} value={newPassword} onChangeText={setNewPassword} secureTextEntry placeholder="Deja en blanco para no cambiar" />
          
          <TouchableOpacity style={styles.btnFull} onPress={updateUser}>
            <Text style={styles.btnText}>Guardar Cambios</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.btnFull, {backgroundColor: '#555', marginTop: 10}]} onPress={() => setEditingUser(null)}>
            <Text style={styles.btnText}>Cancelar</Text>
          </TouchableOpacity>
        </View>
      )}

      {tab === 'historial' && (
        <View style={{flex: 1}}>
          <TextInput 
            style={[styles.input, {marginHorizontal: 16, marginTop: 10}]} 
            placeholder="Buscar por cliente o ID de técnico..." 
            value={searchReport} 
            onChangeText={setSearchReport} 
          />
          <FlatList
            data={filteredReports}
            keyExtractor={i => i.id?.toString() || Math.random().toString()}
            renderItem={renderReporte}
            contentContainerStyle={styles.list}
            refreshing={loading}
            onRefresh={loadAllReports}
            ListEmptyComponent={!loading && <Text style={styles.empty}>No hay reportes.</Text>}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BRAND.colors.bg },
  header: { backgroundColor: BRAND.colors.danger, padding: 16, flexDirection: 'row', alignItems: 'center' },
  headerTitle: { color: BRAND.colors.ink, fontSize: 20, fontFamily: BRAND.fonts.title },
  tabContainer: { flexDirection: 'row', backgroundColor: BRAND.colors.card },
  tab: { flex: 1, padding: 15, alignItems: 'center', borderBottomWidth: 3, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: BRAND.colors.danger },
  tabText: { color: BRAND.colors.textMuted, fontFamily: BRAND.fonts.semi },
  tabTextActive: { color: BRAND.colors.danger },
  list: { padding: 16, paddingBottom: 100 },
  card: { backgroundColor: BRAND.colors.card, padding: 15, borderRadius: BRAND.radius.md, marginBottom: 12, borderWidth: 1, borderColor: BRAND.colors.border },
  cardTitle: { color: BRAND.colors.text, fontSize: 16, fontFamily: BRAND.fonts.semi },
  cardSub: { color: BRAND.colors.textMuted, fontSize: 12, marginTop: 4, fontFamily: BRAND.fonts.body },
  btnSmall: { backgroundColor: BRAND.colors.danger, padding: 8, borderRadius: BRAND.radius.md, alignSelf: 'flex-start', marginTop: 10 },
  btnFull: { backgroundColor: BRAND.colors.danger, padding: 15, borderRadius: BRAND.radius.md, alignItems: 'center', marginTop: 10 },
  btnText: { color: BRAND.colors.ink, fontFamily: BRAND.fonts.semi },
  empty: { textAlign: 'center', color: BRAND.colors.textMuted, marginTop: 20 },
  editForm: { padding: 20, backgroundColor: BRAND.colors.card, margin: 16, borderRadius: BRAND.radius.lg },
  editTitle: { color: BRAND.colors.text, fontSize: 18, fontFamily: BRAND.fonts.semi, marginBottom: 15 },
  label: { color: BRAND.colors.textMuted, fontSize: 12, marginBottom: 5 },
  input: { backgroundColor: BRAND.colors.bgAlt, color: BRAND.colors.text, padding: 12, borderRadius: BRAND.radius.md, marginBottom: 15, borderWidth: 1, borderColor: BRAND.colors.border },
});
