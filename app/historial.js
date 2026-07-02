import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator, Alert, FlatList, StyleSheet,
  Text,
  TextInput,
  TouchableOpacity, View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BRAND } from '../constants/theme';
import { countImagesInReport, listBackups, saveWithSpaceCheck } from '../utils/backup';

export default function Historial() {
  const { cliente } = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const [reportes, setReportes] = useState([]);
  const [allReportes, setAllReportes] = useState([]);
  const [backupIds, setBackupIds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtroFecha, setFiltroFecha] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('');
  const router = useRouter();

  const normalize = (value) => (value || '').toString().trim().toLowerCase();
  const getClientName = (item) => {
    return (
      item?.cliente ||
      item?.cliente_nombre ||
      item?.client ||
      item?.g_cliente ||
      item?.g_contacto ||
      item?.g_cont ||
      item?.g_predio ||
      ''
    );
  };

  const filtrarPorCliente = (data) => {
    if (!cliente) return data;
    const objetivo = normalize(cliente);
    return data.filter((item) => {
      const nombre = normalize(getClientName(item));
      if (!nombre || !objetivo) return false;
      return nombre === objetivo || nombre.includes(objetivo) || objetivo.includes(nombre);
    });
  };

  // Nueva función para filtrar solo por fecha y tipo
  const filtrarReportes = (data) => {
    let filtrados = data;
    if (filtroFecha) {
      filtrados = filtrados.filter(item => {
        const fecha = item.g_fecha || item.fecha || '';
        return fecha.includes(filtroFecha);
      });
    }
    if (filtroTipo) {
      filtrados = filtrados.filter(item => {
        const tipo = item.tipo || '';
        return tipo.toLowerCase().includes(filtroTipo.toLowerCase());
      });
    }
    return filtrados;
  };

  const mergeReports = (localList, backupList) => {
    const merged = new Map();
    for (const item of backupList) {
      const id = item?.id;
      if (id == null) continue;
      merged.set(id, { ...item, _fromBackup: true });
    }
    for (const item of localList) {
      const id = item?.id;
      if (id == null) continue;
      const existing = merged.get(id);
      if (existing) {
        const localCount = countImagesInReport(item);
        const backupCount = countImagesInReport(existing);
        if (backupCount > localCount) {
          continue;
        }
      }
      merged.set(id, { ...item, _fromBackup: false });
    }
    return Array.from(merged.values());
  };

  const stripBackupFlags = (items) => items.map(({ _fromBackup, _raw, ...rest }) => rest);

  // Cargar reportes al entrar en la pantalla
  useFocusEffect(
    useCallback(() => {
      cargarReportes();
    }, [cliente])
  );

  const cargarReportes = async () => {
    setLoading(true);
    try {
      const jsonValue = await AsyncStorage.getItem('mis_reportes');
      let data = [];
      try {
        data = jsonValue != null ? JSON.parse(jsonValue) : [];
      } catch (parseErr) {
        data = [];
        await AsyncStorage.removeItem('mis_reportes');
      }
      const lista = Array.isArray(data) ? data : [];
      const backups = await listBackups();
      const backupsList = Array.isArray(backups) ? backups : [];
      const merged = mergeReports(lista, backupsList);
      const cleaned = stripBackupFlags(merged);
      await saveWithSpaceCheck('mis_reportes', JSON.stringify(cleaned));
      setBackupIds(backupsList.map(item => String(item?.id)).filter(Boolean));
      setAllReportes(cleaned);
      // Aplica filtro inicial
      setReportes(filtrarReportes(filtrarPorCliente(merged)));
    } catch (e) {
      console.error("Error cargando reportes:", e);
      Alert.alert("Error", "No se pudo cargar el historial.");
    } finally {
      setLoading(false);
    }
  };

  const eliminarReporte = async (item) => {
    const id = item?.id;
    const isBackup = backupIds.includes(String(id));
    if (isBackup) {
      return Alert.alert(
        'No disponible',
        'Este reporte viene de backups. Para eliminarlo usa la pantalla de Backups.'
      );
    }
    Alert.alert(
      "Eliminar Reporte",
      "¿Estás seguro? Esta acción no se puede deshacer.",
      [
        { text: "Cancelar", style: "cancel" },
        { 
          text: "Eliminar",
          style: "destructive",
          onPress: async () => {
            try {
              const nuevosReportes = allReportes.filter(item => item.id !== id);
              await saveWithSpaceCheck('mis_reportes', JSON.stringify(nuevosReportes));
              setAllReportes(nuevosReportes);
              const backups = await listBackups();
              const merged = mergeReports(nuevosReportes, Array.isArray(backups) ? backups : []);
              setReportes(filtrarReportes(filtrarPorCliente(merged)));
            } catch (e) {
              Alert.alert("Error", "No se pudo eliminar el reporte.");
            }
          }
        }
      ]
    );
  };

  // Función genérica para navegar y evitar repetición de lógica
  const navegarAReporte = async (item, modo) => {
    try {
      const report = item?.data && typeof item.data === 'object' ? item.data : item;
      // Guardamos los datos temporalmente en AsyncStorage con una clave temporal
      await saveWithSpaceCheck('reporte_temporal', JSON.stringify(report));
      
      // Determinamos la ruta según el tipo de reporte
      let pathname = '/reporte_alarma'; // Por defecto
      
      if (report?.tipo === 'Hidrantes') {
        pathname = '/reportehidrantes';
      } else if (report?.tipo === 'Bombas') {
        pathname = '/ReportesBombas';
      }
      
      // Navegamos pasando solo el ID y modo
      router.push({
        pathname: pathname,
        params: { 
          idOriginal: report?.id || '',
          modo: modo,
          cliente: report?.cliente || 'Sin Nombre',
          tipo: report?.tipo || 'alarma'
        }
      });
    } catch (e) {
      Alert.alert("Error", "No se pudo abrir el reporte.");
    }
  };

  const renderItem = ({ item }) => (
    <View style={styles.card}>
      <View style={styles.cardInfo}>
        <Text style={styles.cardTitle} numberOfLines={1}>
          {item.cliente || "Cliente Sin Nombre"}
        </Text>
        <Text style={styles.cardSub}>
          {item.g_fecha || item.fecha || 'Sin fecha'} - {item.g_predio || item.predio || 'Sin predio'}
        </Text>
      </View>
      
      <View style={styles.cardActions}>
        <TouchableOpacity 
          style={[styles.btn, styles.btnEdit]} 
          onPress={() => navegarAReporte(item, 'editar')}
        >
          <Text style={styles.btnText}>Editar</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.btn, styles.btnClone]} 
          onPress={() => navegarAReporte(item, 'clonar')}
        >
          <Text style={styles.btnText}>Clonar</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.btn, styles.btnDelete]} 
          onPress={() => eliminarReporte(item)}
        >
          <Text style={styles.btnText}>X</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      <View style={styles.bgOrbA} />
      <View style={styles.bgOrbB} />
      <Text style={styles.header}>Historial de Reportes</Text>
      {cliente ? (
        <Text style={styles.subHeader}>Cliente: {cliente}</Text>
      ) : null}

      {/* Filtros visuales */}
      <View style={{ marginBottom: 16 }}>
        <Text style={{ fontSize: 14, color: BRAND.colors.textMuted, marginBottom: 4 }}>Filtrar por fecha:</Text>
        <TextInput
          style={{ borderWidth: 1, borderColor: BRAND.colors.border, borderRadius: 8, padding: 8, marginBottom: 8, color: BRAND.colors.text }}
          placeholder="Ejemplo: 26/2/2026"
          value={filtroFecha}
          onChangeText={setFiltroFecha}
        />
        <Text style={{ fontSize: 14, color: BRAND.colors.textMuted, marginBottom: 4 }}>Filtrar por tipo de reporte:</Text>
        <TextInput
          style={{ borderWidth: 1, borderColor: BRAND.colors.border, borderRadius: 8, padding: 8, marginBottom: 8, color: BRAND.colors.text }}
          placeholder="Ejemplo: alarma, hidrantes, bombas"
          value={filtroTipo}
          onChangeText={setFiltroTipo}
        />
        <TouchableOpacity
          style={{ backgroundColor: BRAND.colors.accent, borderRadius: 8, padding: 10, alignItems: 'center', marginTop: 4 }}
          onPress={() => {
            setReportes(filtrarReportes(filtrarPorCliente(allReportes)));
          }}
        >
          <Text style={{ color: BRAND.colors.ink, fontFamily: BRAND.fonts.semi }}>Aplicar filtros</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={BRAND.colors.accentStrong} style={{ marginTop: 50 }} />
      ) : (
        <FlatList
          data={reportes}
          keyExtractor={item => item.id?.toString() || Math.random().toString()}
          renderItem={renderItem}
          contentContainerStyle={{ paddingBottom: 100 + Math.max(insets.bottom, 0) }}
          ListEmptyComponent={<Text style={styles.empty}>No hay reportes guardados.</Text>}
        />
      )}

      <TouchableOpacity 
        style={styles.fab} 
        onPress={() => router.push({ pathname: '/reporte_alarma', params: { modo: 'nuevo' } })}
      >
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BRAND.colors.bg, paddingHorizontal: 15, paddingTop: 60 },
  header: { fontSize: 26, fontFamily: BRAND.fonts.title, marginBottom: 20, color: BRAND.colors.text, letterSpacing: 0.6 },
  subHeader: { fontSize: 14, color: BRAND.colors.textMuted, marginTop: -12, marginBottom: 16, fontFamily: BRAND.fonts.body },
  empty: { textAlign: 'center', marginTop: 50, color: BRAND.colors.textMuted, fontSize: 16, fontFamily: BRAND.fonts.body },
  card: { 
    backgroundColor: BRAND.colors.card, padding: 15, borderRadius: BRAND.radius.lg, marginBottom: 12,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    borderWidth: 1, borderColor: BRAND.colors.border
  },
  cardInfo: { flex: 1, marginRight: 10 },
  cardTitle: { fontFamily: BRAND.fonts.semi, fontSize: 17, color: BRAND.colors.text },
  cardSub: { fontSize: 13, color: BRAND.colors.textMuted, marginTop: 4, fontFamily: BRAND.fonts.body },
  cardActions: { flexDirection: 'row', alignItems: 'center' },
  btn: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: BRAND.radius.md, marginLeft: 6 },
  btnEdit: { backgroundColor: BRAND.colors.accent },
  btnClone: { backgroundColor: BRAND.colors.success },
  btnDelete: { backgroundColor: BRAND.colors.danger },
  btnText: { color: BRAND.colors.ink, fontSize: 11, fontFamily: BRAND.fonts.semi, textTransform: 'uppercase' },
  fab: {
    position: 'absolute', bottom: 30, right: 25, width: 65, height: 65, borderRadius: 32.5,
    backgroundColor: BRAND.colors.accentStrong, justifyContent: 'center', alignItems: 'center', 
    borderWidth: 1, borderColor: BRAND.colors.border
  },
  fabText: { color: BRAND.colors.ink, fontSize: 35, fontFamily: BRAND.fonts.semi },
  bgOrbA: { position: 'absolute', width: 220, height: 220, borderRadius: 110, backgroundColor: 'rgba(70,241,255,0.16)', top: -70, right: -60, opacity: 0.6 },
  bgOrbB: { position: 'absolute', width: 210, height: 210, borderRadius: 105, backgroundColor: 'rgba(199,163,49,0.18)', bottom: -60, left: -40, opacity: 0.6 }
});