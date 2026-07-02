import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Image, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BRAND } from '../constants/theme';
import supabase from '../supabase';
import { migrateLocalReportsToUser, restoreUserSnapshot, saveUserSnapshot } from '../utils/backup';

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [nombre, setNombre] = useState('');
  const [logo, setLogo] = useState(null);
  const [clientes, setClientes] = useState([]);
  const [clienteSel, setClienteSel] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [usuario, setUsuario] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const [editandoId, setEditandoId] = useState(null);

  // Cargar datos al iniciar
  useEffect(() => {
    verificarSesion();
    cargarClientes();
  }, []);

  const verificarSesion = async () => {
    const sesion = await AsyncStorage.getItem('@user_session');
    if (!sesion) {
      const { data } = await supabase.auth.getUser();
      const email = data?.user?.email || '';
      if (email) {
        await AsyncStorage.setItem('@user_session', email);
        setUsuario(email);
        setIsSyncing(true);
        try {
          await restoreUserSnapshot();
          await migrateLocalReportsToUser();
        } finally { setIsSyncing(false); }
        return;
      }
      router.replace('/'); 
    } else {
      setUsuario(sesion);
    }
  };

  const cargarClientes = async () => {
    try {
      const datos = await AsyncStorage.getItem('@lista_clientes');
      if (datos) setClientes(JSON.parse(datos));
    } catch (e) {
      console.log("Error cargando clientes");
    }
  };

  const guardarClientesEnDisco = async (nuevaLista) => {
    try {
      await AsyncStorage.setItem('@lista_clientes', JSON.stringify(nuevaLista));
      await saveUserSnapshot();
    } catch (e) {
      Alert.alert("Error", "No se pudo guardar localmente");
    }
  };

  const seleccionarImagen = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false, quality: 0.8,
      base64: false,
    });
    if (!result.canceled) setLogo(result.assets[0].uri);
  };

  const agregarCliente = () => {
    if (!nombre.trim()) return Alert.alert("Error", "Escribe el nombre del cliente");
    
    let nuevaLista = [...clientes];
    if (editandoId) {
      const index = nuevaLista.findIndex(c => c.id === editandoId);
      if (index !== -1) {
        nuevaLista[index] = { ...nuevaLista[index], nombre, logo };
      }
      setEditandoId(null);
    } else {
      const nuevo = { 
        id: Date.now().toString(), 
        nombre, 
        logo, 
        fecha: new Date().toLocaleDateString() 
      };
      nuevaLista.push(nuevo);
    }
    
    setClientes(nuevaLista);
    guardarClientesEnDisco(nuevaLista); // Persistencia offline
    
    setNombre(''); 
    setLogo(null);
  };

  const cancelarEdicion = () => {
    setEditandoId(null);
    setNombre('');
    setLogo(null);
  };

  const clientesFiltrados = clientes.filter(c => 
    c.nombre.toLowerCase().includes(busqueda.toLowerCase())
  );

  const eliminarCliente = (clienteId) => {
    if (!clienteId) return;
    Alert.alert('Eliminar cliente', 'Se borrara este cliente de la lista.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: async () => {
          const nuevaLista = clientes.filter((c) => c.id !== clienteId);
          setClientes(nuevaLista);
          await guardarClientesEnDisco(nuevaLista);
          setModalVisible(false);
          setClienteSel(null);
        }
      }
    ]);
  };

  const migrarReportes = async () => {
    setIsSyncing(true);
    try {
      const result = await migrateLocalReportsToUser({ force: true });
      const queued = result?.queued || 0;
      Alert.alert('Migración', `Reportes en cola: ${queued}. Se sincronizan al estar en línea.`);
    } catch (e) {
      Alert.alert('Error', 'No se pudo migrar los reportes.');
    } finally {
      setIsSyncing(false);
    }
  };

  const cerrarSesion = () => {
    Alert.alert("Cerrar Sesión", "¿Deseas salir del sistema?", [
      { text: "Cancelar", style: "cancel" },
      { text: "Salir", style: "destructive", onPress: async () => {
          try { await saveUserSnapshot(); } catch (e) {}
          try { await supabase.auth.signOut(); } catch (e) {}
          await AsyncStorage.removeItem('@user_session');
          router.replace('/'); 
      }}
    ]);
  };

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}
    >
      <View style={styles.bgOrbA} />
      <View style={styles.bgOrbB} />
      {/* HEADER CON PERFIL */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={styles.headerTitle}>FE-Report</Text>
          <TouchableOpacity style={styles.profileBtn} onPress={cerrarSesion}>
             <Text style={styles.profileInitial}>{usuario.charAt(0).toUpperCase()}</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.userSub}>Sesión: {usuario}</Text>
        {isSyncing ? <Text style={styles.syncText}>Sincronizando...</Text> : null}
        <View style={styles.actionRow}>
          {usuario?.toLowerCase() === 'fireadminengineers@gmail.com' && (
            <TouchableOpacity style={[styles.actionBtn, {marginLeft:8, backgroundColor: BRAND.colors.danger}]} onPress={() => router.push('/admin')}>
              <Text style={styles.actionText}>⚙️ Admin</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={[styles.actionBtn, {marginLeft:8}]} onPress={() => router.push('/backups')}>
            <Text style={styles.actionText}>Backups</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionBtn, {marginLeft:8}]} onPress={migrarReportes}>
            <Text style={styles.actionText}>Migrar ahora</Text>
          </TouchableOpacity>
        </View>
      </View>
      
      <ScrollView contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 24) }}>
        {/* FORMULARIO DE REGISTRO / EDICIÓN */}
        <View style={styles.card}>
          <Text style={styles.cardT}>{editandoId ? 'Editando Cliente' : 'Registro de Cliente'}</Text>
          <TextInput 
            style={styles.input} 
            placeholder="Nombre Empresa" 
            value={nombre} 
            onChangeText={setNombre} 
            placeholderTextColor="#999"
          />
          <TouchableOpacity style={styles.picker} onPress={seleccionarImagen}>
            {logo ? <Image source={{ uri: logo }} style={styles.img} resizeMode="contain" onError={() => setLogo(null)} /> : <Text style={{color: BRAND.colors.textMuted}}>📷 Toca para seleccionar Logo</Text>}
          </TouchableOpacity>
          <TouchableOpacity style={styles.btn} onPress={agregarCliente}>
            <Text style={styles.btnT}>{editandoId ? 'Actualizar Cliente' : 'Guardar Cliente'}</Text>
          </TouchableOpacity>
          {editandoId && (
            <TouchableOpacity style={[styles.btn, { backgroundColor: BRAND.colors.cardAlt, marginTop: 10, borderWidth: 1, borderColor: BRAND.colors.border }]} onPress={cancelarEdicion}>
              <Text style={[styles.btnT, { color: BRAND.colors.text }]}>Cancelar Edición</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* BUSCADOR */}
        <View style={{ marginHorizontal: 16, marginBottom: 12 }}>
          <TextInput
            style={[styles.input, { marginBottom: 0 }]}
            placeholder="🔍 Buscar cliente..."
            value={busqueda}
            onChangeText={setBusqueda}
            placeholderTextColor="#999"
          />
        </View>

        {/* LISTADO DE CLIENTES */}
        {clientesFiltrados.map(item => (
          <TouchableOpacity 
            key={item.id} 
            style={styles.item} 
            onPress={() => { setClienteSel(item); setModalVisible(true); }}
          >
            {item.logo ? (
              <Image source={{ uri: item.logo }} style={styles.itemImg} onError={() => {}} />
            ) : (
              <View style={[styles.itemImg, {justifyContent:'center',alignItems:'center'}]}>
                <Text style={{color:'#888'}}>Sin logo</Text>
              </View>
            )}
            <View>
              <Text style={styles.itemN}>{item.nombre}</Text>
              <Text style={styles.itemF}>Creado: {item.fecha}</Text>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* --- MODAL DE OPCIONES (RESTAURADO) --- */}
      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.mO}>
          <View style={styles.mC}>
            <Text style={styles.mT}>{clienteSel?.nombre || 'Cargando...'}</Text>
            
            {/* OPCIÓN 1: ALARMAS */}
            <TouchableOpacity style={styles.mB} onPress={() => { 
              setModalVisible(false); 
              router.push({ pathname: '/reporte_alarma', params: { cliente: clienteSel?.nombre, logoCliente: clienteSel?.logo } }); 
            }}>
              <Text style={styles.mBText}>🚨 Nuevo Reporte de Alarma</Text>
            </TouchableOpacity>

            {/* OPCIÓN 2: BOMBAS */}
            <TouchableOpacity style={styles.mB} onPress={() => { 
              setModalVisible(false); 
              router.push({ pathname: '/ReportesBombas', params: { cliente: clienteSel?.nombre, logoCliente: clienteSel?.logo } }); 
            }}>
              <Text style={styles.mBText}>⛽ Nuevo Reporte de Bombas</Text>
            </TouchableOpacity>

            {/* OPCIÓN 3: HIDRANTES */}
            <TouchableOpacity style={styles.mB} onPress={() => { 
              setModalVisible(false); 
              router.push({ pathname: '/reportehidrantes', params: { cliente: clienteSel?.nombre, logoCliente: clienteSel?.logo } }); 
            }}>
              <Text style={styles.mBText}>💧 Nuevo Reporte de Hidrantes</Text>
            </TouchableOpacity>

            {/* OPCIÓN 4: SUPRESIÓN */}
            <TouchableOpacity style={styles.mB} onPress={() => { 
              setModalVisible(false); 
              router.push({ pathname: '/reporte_supresion', params: { cliente: clienteSel?.nombre, logoCliente: clienteSel?.logo } }); 
            }}>
              <Text style={styles.mBText}>🔥 Nuevo Reporte de Supresión</Text>
            </TouchableOpacity>

            {/* OPCIÓN 5: HISTORIAL */}
            <TouchableOpacity style={styles.mB} onPress={() => {
                setModalVisible(false);
                router.push({ pathname: '/historial', params: { cliente: clienteSel?.nombre } });
              }}
            >
              <Text style={styles.mBText}>📂 Ver Historial</Text>
            </TouchableOpacity>

            {/* OPCIÓN 6: EDITAR */}
            <TouchableOpacity style={styles.mB} onPress={() => {
              setModalVisible(false);
              setNombre(clienteSel?.nombre || '');
              setLogo(clienteSel?.logo || null);
              setEditandoId(clienteSel?.id || null);
            }}>
              <Text style={[styles.mBText, {fontWeight: 'bold', color: BRAND.colors.accentStrong}]}>✏️ Editar cliente</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.mB} onPress={() => eliminarCliente(clienteSel?.id)}>
              <Text style={{color: BRAND.colors.danger, fontWeight: 'bold'}}>🗑️ Eliminar cliente</Text>
            </TouchableOpacity>

            {/* CANCELAR */}
            <TouchableOpacity style={[styles.mB, {borderBottomWidth: 0}]} onPress={() => setModalVisible(false)}>
              <Text style={{color: BRAND.colors.danger, fontWeight: 'bold'}}>Cerrar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BRAND.colors.bg },
  header: { backgroundColor: BRAND.colors.cardAlt, paddingTop: 50, paddingBottom: 20, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: BRAND.colors.border },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle: { color: BRAND.colors.text, fontSize: 26, fontFamily: BRAND.fonts.title, letterSpacing: 0.6 },
  userSub: { color: BRAND.colors.textMuted, fontSize: 12, marginTop: 5, fontFamily: BRAND.fonts.body },
  profileBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: BRAND.colors.bgAlt, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: BRAND.colors.border },
  profileInitial: { color: BRAND.colors.accentStrong, fontFamily: BRAND.fonts.semi, fontSize: 18 },
  card: { backgroundColor: BRAND.colors.card, margin: 16, padding: 20, borderRadius: BRAND.radius.lg, borderWidth: 1, borderColor: BRAND.colors.border },
  cardT: { fontSize: 18, fontFamily: BRAND.fonts.semi, marginBottom: 15, color: BRAND.colors.text },
  input: { backgroundColor: BRAND.colors.bgAlt, padding: 12, borderRadius: BRAND.radius.md, marginBottom: 15, color: BRAND.colors.text, borderWidth: 1, borderColor: BRAND.colors.border, fontFamily: BRAND.fonts.body },
  picker: { width: '100%', height: 100, backgroundColor: BRAND.colors.bgAlt, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginBottom: 15, borderWidth: 1, borderColor: BRAND.colors.border, overflow: 'hidden' },
  img: { width: '100%', height: '100%', borderRadius: 10 },
  btn: { backgroundColor: BRAND.colors.accent, padding: 14, borderRadius: BRAND.radius.md, alignItems: 'center' },
  btnT: { color: BRAND.colors.ink, fontFamily: BRAND.fonts.semi, letterSpacing: 0.4 },
  item: { flexDirection: 'row', backgroundColor: BRAND.colors.cardAlt, marginHorizontal: 16, marginBottom: 12, padding: 16, borderRadius: BRAND.radius.lg, alignItems: 'center', borderWidth: 1, borderColor: BRAND.colors.border },
  itemImg: { width: 48, height: 48, borderRadius: 16, backgroundColor: BRAND.colors.bgAlt, marginRight: 15, borderWidth: 1, borderColor: BRAND.colors.border },
  itemN: { fontSize: 16, fontFamily: BRAND.fonts.semi, color: BRAND.colors.text },
  itemF: { fontSize: 12, color: BRAND.colors.textMuted, fontFamily: BRAND.fonts.body },
  mO: { flex: 1, backgroundColor: 'rgba(6,8,15,0.78)', justifyContent: 'center', alignItems: 'center' },
  mC: { backgroundColor: BRAND.colors.card, width: '85%', padding: 24, borderRadius: BRAND.radius.lg, borderWidth: 1, borderColor: BRAND.colors.border },
  mT: { fontSize: 20, fontFamily: BRAND.fonts.title, marginBottom: 18, textAlign: 'center', color: BRAND.colors.accentStrong },
  mB: { paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: BRAND.colors.border, alignItems: 'center' },
  mBText: { fontSize: 15, fontFamily: BRAND.fonts.body, color: BRAND.colors.text },
  actionRow: { flexDirection: 'row', marginTop: 12 },
  actionBtn: { backgroundColor: BRAND.colors.bgAlt, paddingVertical: 8, paddingHorizontal: 12, borderRadius: BRAND.radius.md, borderWidth: 1, borderColor: BRAND.colors.border },
  actionText: { color: BRAND.colors.accentStrong, fontFamily: BRAND.fonts.semi },
  syncText: { color: BRAND.colors.accentStrong, fontSize: 12, marginTop: 6, fontFamily: BRAND.fonts.body },
  bgOrbA: { position: 'absolute', width: 240, height: 240, borderRadius: 120, backgroundColor: 'rgba(70,241,255,0.16)', top: -90, right: -60, opacity: 0.6 },
  bgOrbB: { position: 'absolute', width: 230, height: 230, borderRadius: 115, backgroundColor: 'rgba(199,163,49,0.18)', bottom: -70, left: -40, opacity: 0.6 }
});