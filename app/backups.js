import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BRAND } from '../constants/theme';
import { getSafeMisReportes, cleanupLocalStorage, deleteBackupById, diagnoseSupabase, downloadReportAssets, getLocalStorageSize, listBackups, optimizeReportForStorage, sanitizeReportsForStorage, saveWithSpaceCheck } from '../utils/backup';

export default function BackupsScreen() {
  const insets = useSafeAreaInsets();
  const [backups, setBackups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [storageSize, setStorageSize] = useState({ mb: '0' });
  const [restoringId, setRestoringId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [diagnosing, setDiagnosing] = useState(false);

  const handleDiagnose = async () => {
    setDiagnosing(true);
    try {
      const result = await diagnoseSupabase();
      Alert.alert(
        'Diagnóstico de Supabase',
        `📡 Red: ${result.netinfo}\n\n` +
        `🔌 Inicialización: ${result.supabaseInit}\n\n` +
        `🗄️ Base de Datos: ${result.dbConnection}\n\n` +
        `👤 Sesión de Usuario: ${result.authSession}\n\n` +
        `📂 Almacenamiento (Storage): ${result.storageAccess}` +
        (result.details ? `\n\n⚠️ Detalles: ${result.details}` : '')
      );
    } catch (e) {
      Alert.alert('Error', 'No se pudo realizar el diagnóstico: ' + e.message);
    } finally {
      setDiagnosing(false);
    }
  };

  const load = async () => {
    setLoading(true);
    try {
      const items = await listBackups({ includeAll: true });
      setBackups(items || []);
      const size = await getLocalStorageSize();
      setStorageSize(size);
    } catch (e) {
      console.warn(e);
      Alert.alert('Error', 'No se pudieron obtener los backups.');
    } finally { setLoading(false); }
  };

  useFocusEffect(useCallback(() => { load(); }, []));

  const restoreOne = async (report) => {
    setRestoringId(String(report?.id));
    try {
      let historial = await getSafeMisReportes();
      historial = sanitizeReportsForStorage(historial, { keepLocal: true });

      const incoming = report?.data && typeof report.data === 'object' ? report.data : report;
      const downloadResult = await downloadReportAssets({
        ...incoming,
        id: incoming?.id ?? report?.id,
        cliente: incoming?.cliente ?? report?.cliente ?? report?.client,
        tipo: incoming?.tipo ?? report?.tipo
      });
      const hydrated = downloadResult?.report || incoming;
      const failures = Array.isArray(downloadResult?.failures) ? downloadResult.failures : [];

      const optimizedIncoming = optimizeReportForStorage(hydrated, { keepLocal: true });

      const idx = historial.findIndex(r => String(r.id) === String(optimizedIncoming.id));
      if (idx >= 0) {
        optimizedIncoming.id = Date.now();
        optimizedIncoming.ultimoCambio = new Date().toLocaleString();
        historial.push(optimizedIncoming);
      } else {
        historial.push(optimizedIncoming);
      }
      await saveWithSpaceCheck('mis_reportes', JSON.stringify(historial));
      if (failures.length > 0) {
        Alert.alert(
          'Restaurado con advertencias',
          `Reporte ${optimizedIncoming.cliente || optimizedIncoming.id} restaurado. No se pudieron descargar ${failures.length} imagen(es). Puedes reintentar la restauracion.`
        );
      } else {
        Alert.alert('Restaurado', `Reporte ${optimizedIncoming.cliente || optimizedIncoming.id} restaurado a almacenamiento local.`);
      }
    } catch (e) {
      console.warn(e);
      Alert.alert('Error', 'No se pudo restaurar el reporte.');
    } finally {
      setRestoringId(null);
    }
  };

  const handleCleanupStorage = async () => {
    Alert.alert(
      'Limpiar almacenamiento',
      '¿Deseas eliminar borradores vacíos y datos temporales? Esto liberará espacio en el teléfono.',
      [
        { text: 'Cancelar', onPress: () => {} },
        {
          text: 'Limpiar',
          onPress: async () => {
            try {
              const result = await cleanupLocalStorage();
              await load();
              Alert.alert(
                'Almacenamiento limpio',
                `Se eliminaron ${result.removed} borradores vacíos.\nEspacio liberado: ${(storageSize.mb - (await getLocalStorageSize()).mb).toFixed(2)} MB`
              );
            } catch (e) {
              Alert.alert('Error', 'No se pudo limpiar el almacenamiento: ' + e.message);
            }
          }
        }
      ]
    );
  };

  const deleteOne = async (report) => {
    const name = report?.cliente || report?.cliente_nombre || report?.client || 'Sin Cliente';
    Alert.alert(
      'Eliminar backup',
      `¿Eliminar el backup de ${name}? Esta accion no se puede deshacer.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            const id = report?._raw?.id ?? report?.id;
            if (!id) return Alert.alert('Error', 'No se encontro el id del backup.');
            setDeletingId(String(id));
            try {
              await deleteBackupById(id);
              await load();
              Alert.alert('Eliminado', 'Backup eliminado correctamente.');
            } catch (e) {
              Alert.alert('Error', 'No se pudo eliminar el backup.');
            } finally {
              setDeletingId(null);
            }
          }
        }
      ]
    );
  };

  const renderItem = ({ item }) => (
    <View style={styles.card}>
      <View style={{flex:1}}>
        <Text style={styles.title}>{item.cliente || item.cliente_nombre || item.client || 'Sin Cliente'}</Text>
        <Text style={styles.sub}>{item.tipo || 'Sin tipo'} • {item.ultimoCambio || item.lastBackup || ''}</Text>
        {item._conflictOf ? (
          <Text style={styles.conflict}>Duplicado de #{item._conflictOf}</Text>
        ) : null}
      </View>
      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.btn, restoringId === String(item.id) && styles.btnDisabled]}
          onPress={() => restoreOne(item)}
          disabled={restoringId === String(item.id) || deletingId === String(item.id)}
        >
          {restoringId === String(item.id) ? (
            <View style={styles.btnRow}>
              <ActivityIndicator color="#fff" size="small" />
              <Text style={styles.btnText}>Restaurando...</Text>
            </View>
          ) : (
            <Text style={styles.btnText}>Restaurar</Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.btnDelete, deletingId === String(item.id) && styles.btnDisabled]}
          onPress={() => deleteOne(item)}
          disabled={deletingId === String(item.id) || restoringId === String(item.id)}
        >
          {deletingId === String(item.id) ? (
            <View style={styles.btnRow}>
              <ActivityIndicator color="#fff" size="small" />
              <Text style={styles.btnText}>Eliminando...</Text>
            </View>
          ) : (
            <Text style={styles.btnText}>Eliminar</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      <View style={styles.headerSection}>
        <View style={{flex:1}}>
          <Text style={styles.header}>Backups en la nube (todos)</Text>
          <Text style={styles.storageInfo}>Almacenamiento local: {storageSize.mb} MB</Text>
        </View>
        <View style={{flexDirection: 'row', gap: 6}}>
          <TouchableOpacity style={styles.cleanBtn} onPress={handleCleanupStorage}>
            <Text style={styles.cleanBtnText}>Limpiar</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.cleanBtn, {borderColor: BRAND.colors.accent}]} onPress={handleDiagnose} disabled={diagnosing}>
            {diagnosing ? <ActivityIndicator size="small" color={BRAND.colors.accentStrong} /> : <Text style={styles.cleanBtnText}>Diagnóstico</Text>}
          </TouchableOpacity>
        </View>
      </View>
      <FlatList
        data={backups}
        keyExtractor={i => String(i.id) + (i.lastBackup||'')}
        renderItem={renderItem}
        ListEmptyComponent={<Text style={styles.empty}>No hay backups</Text>}
        refreshing={loading}
        onRefresh={load}
        contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 24) }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex:1, padding:12, backgroundColor: BRAND.colors.bg },
  headerSection: { flexDirection:'row', alignItems:'center', marginBottom:16, gap:12 },
  header: { fontFamily: BRAND.fonts.title, fontSize:18, color: BRAND.colors.text, letterSpacing: 0.4 },
  storageInfo: { color: BRAND.colors.textMuted, fontSize:12, marginTop:4, fontFamily: BRAND.fonts.body },
  card: { flexDirection:'row', padding:12, borderRadius: BRAND.radius.md, backgroundColor: BRAND.colors.card, marginBottom:8, alignItems:'center', borderWidth: 1, borderColor: BRAND.colors.border },
  title: { fontFamily: BRAND.fonts.semi, color: BRAND.colors.text },
  sub: { color: BRAND.colors.textMuted, fontSize:12, fontFamily: BRAND.fonts.body },
  conflict: { color: BRAND.colors.accentStrong, fontSize:11, marginTop:2, fontFamily: BRAND.fonts.body },
  actions: { flexDirection:'row', gap:8 },
  btn: { backgroundColor: BRAND.colors.accent, padding:8, borderRadius: BRAND.radius.md },
  btnDelete: { backgroundColor: BRAND.colors.danger, padding:8, borderRadius: BRAND.radius.md },
  btnDisabled: { backgroundColor: BRAND.colors.bgAlt },
  btnRow: { flexDirection:'row', alignItems:'center', gap:6 },
  btnText: { color: BRAND.colors.ink, fontFamily: BRAND.fonts.semi },
  cleanBtn: { backgroundColor: BRAND.colors.cardAlt, padding:10, paddingHorizontal:16, borderRadius: BRAND.radius.md, borderWidth: 1, borderColor: BRAND.colors.border },
  cleanBtnText: { color: BRAND.colors.accentStrong, fontFamily: BRAND.fonts.semi, fontSize:12 },
  empty: { textAlign:'center', marginTop:20, color: BRAND.colors.textMuted, fontFamily: BRAND.fonts.body }
});

