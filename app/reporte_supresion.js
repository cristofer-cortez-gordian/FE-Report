import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
let SignatureScreen;
if (require('react-native').Platform.OS !== 'web') {
  SignatureScreen = require('react-native-signature-canvas').default;
} else {
  SignatureScreen = () => require('react-native').createElement(
    require('react-native').View,
    { style: { height: 200, justifyContent: 'center', alignItems: 'center', backgroundColor: '#eee' } },
    require('react-native').createElement(require('react-native').Text, null, "Firma digital no disponible en web")
  );
}
import { BRAND } from '../constants/theme';

import { useLocalSearchParams } from 'expo-router';
import { downloadReportAssets, enqueueBackup, getSafeMisReportes, imageUriToDataUrl, migrateReportPhotoUris, optimizeReportForStorage, persistPhotoUri, persistSignatureDataUrl, reuploadReportAssets, sanitizeReportsForStorage, savePhotoToGallery, saveUserSnapshot, saveWithSpaceCheck, signatureUriToDataUrl } from '../utils/backup';
import { generateAndSharePdfFromExcel } from '../utils/excelPdfService';
import { buildExactPdfHeader, PDF_EXACT_HEADER_STYLES, PDF_PRINT_SAFE_STYLES } from '../utils/pdfHeader';
import { printHtmlToPdf, sharePdfUri } from '../utils/pdfExport';

const BASE_INPUT_PROPS = {
  blurOnSubmit: false,
  returnKeyType: 'default',
  placeholderTextColor: BRAND.colors.textMuted
};
const TABLE_PAGE_SIZE = 200;
const initialSections = [
  {
    title: 'General',
    data: [
      // Estos son campos de ejemplo, puedes añadir más según necesites
      { key: 'h_cliente', label: 'Cliente' },
      { key: 'h_fecha', label: 'Fecha' },
      { key: 'h_tecnico', label: 'Técnico' },
    ],
  },
  {
    title: 'Supresión',
    data: [
      { id: 'SP-1', desc: 'El área de riesgo se encuentra libre de obstrucciones.', estado: '', lectura: '', imagen: null },
      { id: 'SP-2', desc: 'La cobertura de los detectores es la correcta.', estado: '', lectura: '', imagen: null },
      { id: 'SP-3', desc: 'Todos los detectores están supervisados por el tablero.', estado: '', lectura: '', imagen: null },
      { id: 'SP-4', desc: 'La condición y ubicación de las boquillas es la correcta.', estado: '', lectura: '', imagen: null },
      { id: 'SP-5', desc: 'Las boquillas se encuentran libres de obstrucciones.', estado: '', lectura: '', imagen: null },
      { id: 'SP-6', desc: 'Existen áreas de riesgo sin cobertura.', estado: '', lectura: '', imagen: null },
      { id: 'SP-7', desc: 'Las estaciones manuales y la de aborto son accesibles y están a la salida del riesgo.', estado: '', lectura: '', imagen: null },
      { id: 'SP-8', desc: 'El área cuenta con avisos que indiquen que está protegido con un sistema de extinción a base de gas.', estado: '', lectura: '', imagen: null },
      { id: 'SP-9', desc: 'El riesgo se encuentra cerrado herméticamente de forma que no existan fugas considerables en caso de descarga.', estado: '', lectura: '', imagen: null },
      { id: 'SP-10', desc: 'La tubería de descarga se encuentra bien soportada.', estado: '', lectura: '', imagen: null },
      { id: 'SP-11', desc: 'Los tanques se encuentran en buenas condiciones.', estado: '', lectura: '', imagen: null },
      { id: 'SP-12', desc: 'Los tanques se encuentran bien anclados y en un área accesible.', estado: '', lectura: '', imagen: null },
      { id: 'SP-13', desc: 'Los tanques cuentan con placas de datos indicando peso en vacío y llenado.', estado: '', lectura: '', imagen: null },
      { id: 'SP-14', desc: 'El peso de los tanques es el adecuado.', estado: '', lectura: '', imagen: null },
      { id: 'SP-15', desc: 'Las condiciones de las mangueras de descarga son buenas.', estado: '', lectura: '', imagen: null },
      { id: 'SP-16', desc: 'El sistema cuenta con mecanismo de disparo manual en buenas condiciones.', estado: '', lectura: '', imagen: null },
      { id: 'SP-17', desc: 'Al retirar un detector de su base, lo reporta en el tablero.', estado: '', lectura: '', imagen: null },
      { id: 'SP-18', desc: 'El tablero opera al desconectar la energía de C.A.', estado: '', lectura: '', imagen: null },
      { id: 'SP-19', desc: 'El suministro de C.A. a la fuente es correcto.', estado: '', lectura: '', imagen: null },
      { id: 'SP-20', desc: 'El cargador de baterías funciona correctamente.', estado: '', lectura: '', imagen: null },
      { id: 'SP-21', desc: 'Se encuentra supervisada la alimentación de C.A. hacia los módulos de control.', estado: '', lectura: '', imagen: null },
      { id: 'SP-22', desc: 'Al alarmar un detector el tablero lo reporta.', estado: '', lectura: '', imagen: null },
      { id: 'SP-23', desc: 'Todas las alarmas audiovisuales operan.', estado: '', lectura: '', imagen: null },
      { id: 'SP-24', desc: 'Todas las alarmas sonoras funcionan.', estado: '', lectura: '', imagen: null },
      { id: 'SP-25', desc: 'Todas las teclas de Alarm Silence & Reset operan.', estado: '', lectura: '', imagen: null },
      { id: 'SP-26', desc: 'El sistema opera en condiciones pre-alarma.', estado: '', lectura: '', imagen: null },
      { id: 'SP-27', desc: 'Al activar un segundo detector o realizar zona cruzada se activa el ciclo descarga.', estado: '', lectura: '', imagen: null },
      { id: 'SP-28', desc: 'El tiempo de descarga es correcto.', estado: '', lectura: '', imagen: null },
      { id: 'SP-29', desc: 'Al activar la estación manual, se energizan los solenoides.', estado: '', lectura: '', imagen: null },
      { id: 'SP-30', desc: 'Los solenoides se activan y restablecen.', estado: '', lectura: '', imagen: null },
      { id: 'SP-31', desc: 'La extracción y la inyección de aire, se detiene en caso de tener condiciones de alarma.', estado: '', lectura: '', imagen: null },
      { id: 'SP-32', desc: 'Los relevadores auxiliares operan correctamente.', estado: '', lectura: '', imagen: null },
      { id: 'SP-33', desc: 'Las señales remotas operan correctamente.', estado: '', lectura: '', imagen: null },
      { id: 'SP-34', desc: 'Las válvulas seleccionadoras y los interruptores de presión operan adecuadamente.', estado: '', lectura: '', imagen: null },
      { id: 'SP-35', desc: 'Queda operando el sistema normalmente una vez que ha sido restablecido.', estado: '', lectura: '', imagen: null },
    ],
  },
];

const normalizeSupresionTable = (rows) => {
  const supresionSection = initialSections.find(s => s.title === 'Supresión');
  if (!supresionSection) return [];

  const defaultRows = supresionSection.data;
  const list = Array.isArray(rows) ? rows : [];
  const byId = new Map();
  list.forEach((row) => {
    if (row?.id) byId.set(String(row.id).trim(), row);
  });

  return defaultRows.map((def, index) => {
    const match = byId.get(def.id) || list[index] || {};
    return {
      ...def,
      estado: match.estado || def.estado,
      lectura: match.lectura ?? def.lectura,
      imagen: match.imagen ?? def.imagen
    };
  });
};

const normalizeLoadedData = (data) => {
  const base = data || {};
  return {
    ...base,
    evidencias: base.evidencias || { evi1: null, evi2: null, evi3: null, evi4: null },
    firma_cliente: base.firma_cliente ?? null,
    firma_tecnico: base.firma_tecnico ?? null,
    table_supresion: normalizeSupresionTable(base.table_supresion || [...(base.table_ig || []), ...(base.table_md || [])]),
  };
};

function ReporteSupresion() {
  // Obtener parámetros de navegación (cliente, modo, idOriginal)
  const { cliente, modo, idOriginal, logoCliente } = useLocalSearchParams();

  // Estado de carga
  const [loading, setLoading] = useState(true);
  // Estado de guardado
  const [saving, setSaving] = useState(false);
  // Modales para firmas
  const [sigModal, setSigModal] = useState({ visible: false, target: null });
  const signatureRef = useRef();
  const resolvedIdRef = useRef(null);
  const insets = useSafeAreaInsets();

  const [activeTab, setActiveTab] = useState('GENERAL');
  const [tablePages, setTablePages] = useState({});

  const [formData, setFormData] = useState({
    h_fecha: new Date().toLocaleDateString('es-MX'),
    h_ejecutivo: '',
    h_email_ejecutivo: '',
    h_cel: '',
    h_tel_oficina: '',
    h_tecnico: '',
    h_sistema: 'SISTEMA DE SUPRESIÓN',
    h_cliente: cliente || "CLIENTE",
    logo_cliente: logoCliente || null,
    h_contacto: '',
    h_departamento_supervisor: '',
    h_responsable_depto: '',
    h_tel: '',
    h_email: '',
    h_predio: '',
    h_direccion: '',
    h_hora_inicio: '',
    h_hora_final: '',
    sucursal: 'Matriz Toluquilla',

    table_supresion: initialSections.find(s => s.title === 'Supresión')?.data || [],

    evidencias: { evi1: null, evi2: null, evi3: null, evi4: null },

    f_cli_nombre: '',
    f_eng_nombre: '',
    observaciones_no: '',
    firma_cliente: null,
    firma_tecnico: null
  });

  const saveHydratedToLocal = async (report) => {
    try {
      if (!report || !report.id) return;
      let historial = await getSafeMisReportes();
      historial = sanitizeReportsForStorage(historial, { keepLocal: true });
      const optimized = optimizeReportForStorage(report, { keepLocal: true });
      const idx = historial.findIndex(r => String(r.id) === String(optimized.id));
      if (idx >= 0) historial[idx] = optimized;
      else historial.push(optimized);
      await saveWithSpaceCheck('mis_reportes', JSON.stringify(historial));
    } catch (e) {
      console.warn('saveHydratedToLocal failed (supresion)', e);
    }
  };


  useEffect(() => {
    const load = async () => {
      try {
        const datosTemporales = await AsyncStorage.getItem('reporte_temporal');

        if (datosTemporales) {
          const datos = JSON.parse(datosTemporales);
          await AsyncStorage.removeItem('reporte_temporal');

          const normalized = normalizeLoadedData(datos);

          const migrated = await migrateReportPhotoUris(normalized, normalized?.id || idOriginal);
          const downloadResult = await downloadReportAssets(migrated);
          const hydrated = downloadResult?.report || migrated;
          if (modo === 'clonar') {
            const cloned = {
              ...hydrated,
              id: Date.now(),
              h_fecha: new Date().toLocaleDateString('es-MX'),
              f_cli_nombre: '',
              f_eng_nombre: '',
              firma_cliente: null,
              firma_tecnico: null,
              sucursal: hydrated?.sucursal || 'Matriz Toluquilla'
            };
            setFormData(cloned);
            await saveHydratedToLocal(cloned);
            Alert.alert("Borrador creado", "Borrador creado automaticamente al clonar.");
          } else {
            setFormData(hydrated);
            if (modo === 'editar') {
              await saveHydratedToLocal(hydrated);
            }
          }
        } else {
          // Fallback: intenta cargar del cache local
          const saved = await AsyncStorage.getItem(`@rep_${cliente}`);
          if (saved) {
            const parsedData = JSON.parse(saved);
            const normalized = normalizeLoadedData(parsedData);

            const migrated = await migrateReportPhotoUris(normalized, normalized?.id || idOriginal);
            const downloadResult = await downloadReportAssets(migrated);
            const hydrated = downloadResult?.report || migrated;
            if (modo === 'clonar') {
              const cloned = {
                ...hydrated,
                id: Date.now(),
                h_fecha: new Date().toLocaleDateString('es-MX'),
                f_cli_nombre: '',
                f_eng_nombre: '',
                firma_cliente: null,
                firma_tecnico: null,
                sucursal: hydrated?.sucursal || 'Matriz Toluquilla'
              };
              setFormData(cloned);
              await saveHydratedToLocal(cloned);
              Alert.alert("Borrador creado", "Borrador creado automaticamente al clonar.");
            } else {
              setFormData(hydrated);
              if (modo === 'editar') {
                await saveHydratedToLocal(hydrated);
              }
            }
          }
        }
      } catch (e) {
        console.error("Error al cargar:", e);
      }
      setLoading(false);
    };
    load();
  }, []);

  // Si se crea un nuevo reporte, jalar automáticamente el nombre del cliente
  useEffect(() => {
    if (cliente && modo !== 'editar' && modo !== 'clonar') {
      setFormData(prev => ({
        ...prev,
        h_cliente: cliente,
        g_cliente: cliente
      }));
    }
  }, [cliente, modo]);

  // FUNCIÓN PARA TOMAR FOTO (SOLO CÁMARA)
  const takePhoto = async (targetType, index = null, tableKey = null) => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert("Error", "Se necesita permiso de cámara");
      return;
    }

    let result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.5,
      base64: false,
    });

    if (!result.canceled) {
      const reportKey = (modo === 'editar' && idOriginal) ? idOriginal : Date.now();
      await savePhotoToGallery(result.assets[0].uri);
      const uri = await persistPhotoUri(result.assets[0].uri, reportKey, `${targetType || tableKey}_${index ?? 'evi'}`);
      if (tableKey) {
        const newTable = [...formData[tableKey]];
        newTable[index].imagen = uri;
        setFormData({ ...formData, [tableKey]: newTable });
      } else if (targetType.startsWith('evi')) {
        setFormData({ ...formData, evidencias: { ...formData.evidencias, [targetType]: uri } });
      }
    }
  };

  const pickLogo = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert("Error", "Se necesita permiso de la galería");
      return;
    }
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.8,
    });
    if (!result.canceled) {
      const reportKey = (modo === 'editar' && idOriginal) ? idOriginal : Date.now();
      const uri = await persistPhotoUri(result.assets[0].uri, reportKey, 'logo_cliente');
      setFormData({ ...formData, logo_cliente: uri });
    }
  };

  const saveSignature = async (signature) => {
    const reportId = (modo === 'editar' && idOriginal) ? idOriginal : Date.now();
    const target = sigModal.target || 'firma';
    const stored = await persistSignatureDataUrl(signature, reportId, target);
    setFormData(prev => ({
      ...prev,
      [target === 'cliente' ? 'firma_cliente' : 'firma_tecnico']: stored
    }));
    setSigModal({ visible: false, target: null });
  };

  // Siempre retorna un id válido (usa idOriginal, formData.id, o genera uno nuevo)
  const resolveReportId = () => {
    // If we already resolved an ID this session, always return the same one
    if (resolvedIdRef.current != null) return resolvedIdRef.current;

    let id;
    if (modo === 'editar') {
      const raw = idOriginal ?? formData?.id;
      id = raw ? raw : Date.now();
    } else {
      id = Date.now();
    }
    resolvedIdRef.current = id;
    return id;
  };

  // Función auxiliar para preparar el objeto a guardar
  const prepararDatosParaGuardar = () => {
    const nombreCliente = cliente || formData.g_cont || formData.g_depto;
    if (!nombreCliente) return null;

    // Siempre asegura que id esté presente y nunca undefined
    let id = resolveReportId();
    if (!id || typeof id === 'undefined') {
      id = Date.now();
    }

    return {
      ...formData,
      cliente: nombreCliente,
      tipo: 'Supresion',
      id,
      ultimoCambio: new Date().toISOString()
    };
  };

  // Guardar en Historial (agregar a mis_reportes)
  const guardarEnHistorial = async () => {
    const reporteAGuardar = prepararDatosParaGuardar();
    if (!reporteAGuardar) {
      return Alert.alert("Faltan datos", "Para guardar, escribe al menos el nombre del cliente o el contacto.");
    }

    try {
      setSaving(true);
      let historial = await getSafeMisReportes();
      historial = sanitizeReportsForStorage(historial, { keepLocal: true });

      // Optimizar el reporte antes de guardar (reduce tamaño drasticamente)
      const reporteOptimizado = optimizeReportForStorage(reporteAGuardar, { keepLocal: true });

      if (modo === 'editar') {
        const reportId = resolveReportId();
        const index = historial.findIndex(r => String(r.id) === String(reportId));
        if (index !== -1) {
          historial[index] = reporteOptimizado;
        } else {
          historial.push(reporteOptimizado);
        }
      } else {
        historial.push(reporteOptimizado);
      }

      await saveWithSpaceCheck('mis_reportes', JSON.stringify(historial));
      try { await saveUserSnapshot(); } catch (e) { }
      enqueueBackup(reporteAGuardar).catch(e => console.warn('Backup queue failed (supresion):', e));
      Alert.alert("Guardado", "El reporte se guardó en el historial correctamente.");

    } catch (e) {
      Alert.alert("Error", "No se pudo guardar: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  const generarPDF = async () => {

    const reporteAGuardar = prepararDatosParaGuardar();
    if (!reporteAGuardar) {
      return Alert.alert("Faltan datos", "Para guardar, escribe al menos el nombre del cliente o el contacto.");
    }

    setSaving(true);

    try {
      let historial = await getSafeMisReportes();
      historial = sanitizeReportsForStorage(historial, { keepLocal: true });

      const reporteOptimizado = optimizeReportForStorage(reporteAGuardar, { keepLocal: true });

      if (modo === 'editar') {
        const reportId = resolveReportId();
        const index = historial.findIndex(r => String(r.id) === String(reportId));
        if (index !== -1) {
          historial[index] = reporteOptimizado;
        } else {
          historial.push(reporteOptimizado);
        }
      } else {
        historial.push(reporteOptimizado);
      }

      await saveWithSpaceCheck('mis_reportes', JSON.stringify(historial));
      try { await saveUserSnapshot(); } catch (e) { }

      enqueueBackup(reporteAGuardar).catch(e => console.warn('Backup queue failed (supresion pdf):', e));
      const reporteConImagenesEnLaNube = reporteAGuardar;

      const firmaCliente = await signatureUriToDataUrl(reporteConImagenesEnLaNube.firma_cliente);
      const firmaTecnico = await signatureUriToDataUrl(reporteConImagenesEnLaNube.firma_tecnico);

      const evidencias = {
        evi1: await imageUriToDataUrl(reporteConImagenesEnLaNube.evidencias?.evi1, { maxWidth: 700, compress: 0.45 }),
        evi2: await imageUriToDataUrl(reporteConImagenesEnLaNube.evidencias?.evi2, { maxWidth: 700, compress: 0.45 }),
        evi3: await imageUriToDataUrl(reporteConImagenesEnLaNube.evidencias?.evi3, { maxWidth: 700, compress: 0.45 }),
        evi4: await imageUriToDataUrl(reporteConImagenesEnLaNube.evidencias?.evi4, { maxWidth: 700, compress: 0.45 })
      };

      const convertTable = async (rows) => {
        const list = Array.isArray(rows) ? rows : [];
        const converted = [];
        for (const row of list) {
          converted.push({
            ...row,
            imagen: await imageUriToDataUrl(row?.imagen, { maxWidth: 200, compress: 0.4 })
          });
        }
        return converted;
      };

      const tableSupresion = await convertTable(reporteConImagenesEnLaNube.table_supresion);

      const logoClienteBase64 = reporteConImagenesEnLaNube.logo_cliente ? await imageUriToDataUrl(reporteConImagenesEnLaNube.logo_cliente, { maxWidth: 300, compress: 0.7 }) : null;

      const headerHtml = await buildExactPdfHeader({
        title: 'REPORTE DE MANTENIMIENTO SISTEMA DE SUPRESIÓN',
        logoCliente: logoClienteBase64,
        sucursal: reporteConImagenesEnLaNube.sucursal,
        meta: `${reporteConImagenesEnLaNube.h_fecha} | ${reporteConImagenesEnLaNube.h_cliente || '-'}`,
        fields: {
          fecha: reporteConImagenesEnLaNube.h_fecha,
          ejecutivo: reporteConImagenesEnLaNube.h_ejecutivo,
          emailEjecutivo: reporteConImagenesEnLaNube.h_email_ejecutivo,
          cel: reporteConImagenesEnLaNube.h_cel,
          telOficina: reporteConImagenesEnLaNube.h_tel_oficina,
          tecnico: reporteConImagenesEnLaNube.h_tecnico || reporteConImagenesEnLaNube.f_eng_nombre,
          sistema: reporteConImagenesEnLaNube.h_sistema,
          cliente: reporteConImagenesEnLaNube.h_cliente,
          contacto: reporteConImagenesEnLaNube.h_contacto,
          departamentoSupervisor: reporteConImagenesEnLaNube.h_departamento_supervisor,
          telCliente: reporteConImagenesEnLaNube.h_tel,
          emailCliente: reporteConImagenesEnLaNube.h_email,
          predio: reporteConImagenesEnLaNube.h_predio,
          direccion: reporteConImagenesEnLaNube.h_direccion,
          horaInicio: reporteConImagenesEnLaNube.h_hora_inicio,
          horaFinal: reporteConImagenesEnLaNube.h_hora_final,
          responsableDepto: reporteConImagenesEnLaNube.h_responsable_depto
        }
      });

      const renderPaginatedRows = (rows, headerTitle) => {
        if (!rows || rows.length === 0) return '';
        // Paginación manual exacta porque Android WebView ignora page-break-inside: avoid
        // Página 1: 10 filas (por el espacio que ocupa el header)
        // Siguientes: 19 filas por página
        const FIRST_PAGE_ROWS = 10;
        const NEXT_PAGE_ROWS = 19;

        const chunks = [];
        chunks.push(rows.slice(0, FIRST_PAGE_ROWS));
        let i = FIRST_PAGE_ROWS;
        while (i < rows.length) {
          chunks.push(rows.slice(i, i + NEXT_PAGE_ROWS));
          i += NEXT_PAGE_ROWS;
        }

        const theadHtml = (chunkIdx) => `
          <thead>
            <tr>
              <th style="width:10%; background:#0070c0; color:#000; border:1px solid #000;">CÓDIGO</th>
              <th style="width:45%; background:#0070c0; color:#000; border:1px solid #000;">${headerTitle} ${chunks.length > 1 && chunkIdx > 0 ? '(Continuación)' : ''}</th>
              <th style="width:10%; background:#0070c0; color:#000; border:1px solid #000;">SÍ/NO</th>
              <th style="width:15%; background:#0070c0; color:#000; border:1px solid #000;">LECTURA / OBSERVACIÓN</th>
              <th style="width:20%; background:#0070c0; color:#000; border:1px solid #000;">IMAGEN</th>
            </tr>
          </thead>
        `;

        return chunks.map((chunk, idx) => `
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 0px; table-layout: fixed;">
            ${theadHtml(idx)}
            <tbody>
              ${chunk.map(row => `
                <tr style="height: 50px;">
                  <td style="font-weight:bold; width:10%; text-align:center; border:1px solid #000; word-wrap: break-word;">${row.id}</td>
                  <td style="width:45%; border:1px solid #000; word-wrap: break-word; padding: 2px 4px;">${row.desc || '-'}</td>
                  <td style="width:10%; text-align:center; font-weight:bold; border:1px solid #000;">${row.estado || ''}</td>
                  <td style="width:15%; text-align:center; border:1px solid #000; word-wrap: break-word;">${row.lectura || ''}</td>
                  <td style="width:20%; text-align:center; padding: 2px; border:1px solid #000;">${row.imagen ? `<img src="${row.imagen}" style="max-width:100px;height:55px;object-fit:contain;"/>` : ''}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          <div style="page-break-after: always;"></div>
        `).join('');
      };

      const supresionHtml = renderPaginatedRows(tableSupresion, 'REGISTRO DE INSPECCIÓN');

      const htmlContent = `
      <html>
        <head>
          <style>
            ${PDF_PRINT_SAFE_STYLES}
            body { font-family: Arial, sans-serif; font-size: 10px; color: #000; padding: 0; }
            @page { margin: 5mm 5mm 5mm 5mm !important; }
            ${PDF_EXACT_HEADER_STYLES}
            h3 { margin: 6px 0 2px; color: #111827; font-size: 11px; page-break-after: avoid; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 4px; page-break-inside: auto; }
            thead { display: table-header-group; }
            tbody { display: table-row-group; }
            tr { page-break-inside: avoid; break-inside: avoid; page-break-after: auto; }
            td { page-break-inside: avoid; break-inside: avoid; }
            th, td { border: 1px solid #000; padding: 2px 4px; vertical-align: middle; font-size: 9px; }
            th { background: #0070c0; color: #000; font-weight: bold; text-align: center; }
            .grid td { border: 1px solid #000; text-align: center; padding: 6px; }
            .report-footer { margin-top: 10px; page-break-inside: avoid; border: 2px solid #000; }
            .signatures-table { width: 100%; page-break-inside: avoid; border-collapse: collapse; border: none; }
            .sig-cell { border: none; padding: 0px; height: 80px; }
            .sig-img { height: 80px; max-width: 200px; object-fit: contain; }
          </style>
        </head>
        <body>
          ${headerHtml}
          ${supresionHtml}

          <table style="border: 2px solid #000; margin-top: 10px; margin-bottom: 0px;">
            <tr>
              <td colspan="2" style="border:none; padding: 4px; font-weight:bold; font-size:10px;">
                Sistema de suprecion ecaro 25 funcionando correctamente antes y despues de mantenimiento quedo sistema restablecido y en sistema normal
              </td>
            </tr>
            <tr>
              <td colspan="2" style="border:none; padding: 4px; font-size:10px; border-bottom: 1px solid #000;">
                Panel de cada bomba queda en automatico despues de las pruebas<br/>
                ${formData.observaciones_no ? formData.observaciones_no.replace(/\\n/g, '<br/>') : '<div style="border-bottom:1px solid #000; height:15px; width:100%;"></div><div style="border-bottom:1px solid #000; height:15px; width:100%;"></div><div style="border-bottom:1px solid #000; height:15px; width:100%;"></div><div style="height:15px; width:100%;"></div>'}
              </td>
            </tr>
            <tr>
              <td colspan="2" style="border:none; padding: 4px; font-weight:bold; text-align:center; font-size:10px;">
                fotos de los tableros al final del servicio
              </td>
            </tr>
            <tr>
              <td style="border:none; text-align:center; padding: 2px; width:50%;">
                ${evidencias.evi1 ? `<img src="${evidencias.evi1}" style="max-width:180px;height:120px;object-fit:cover;"/>` : ''}
              </td>
              <td style="border:none; text-align:center; padding: 2px; width:50%;">
                ${evidencias.evi2 ? `<img src="${evidencias.evi2}" style="max-width:180px;height:120px;object-fit:cover;"/>` : ''}
              </td>
            </tr>
            <tr>
              <td style="border:none; text-align:center; padding: 2px; width:50%;">
                ${evidencias.evi3 ? `<img src="${evidencias.evi3}" style="max-width:180px;height:120px;object-fit:cover;"/>` : ''}
              </td>
              <td style="border:none; text-align:center; padding: 2px; width:50%;">
                ${evidencias.evi4 ? `<img src="${evidencias.evi4}" style="max-width:180px;height:120px;object-fit:cover;"/>` : ''}
              </td>
            </tr>
            <tr>
              <td colspan="2" style="border-top: 1px solid #000; padding: 6px; font-weight:bold; text-align:center; font-size:10px;">
                ESTAS PRUEBAS FUERON REALIZADAS DE ACUERDO A LOS ESTÁNDARES NFPA; ASI COMO DEL FABRICANTE.
              </td>
            </tr>
          </table>

          <table class="signatures-table" style="border: 2px solid #000; border-top: none;">
            <tr>
              <td class="sig-cell" style="border:none; text-align:center; vertical-align:bottom; padding-bottom:5px; width:50%;">
                <div style="height:45px;">${firmaCliente ? `<img src="${firmaCliente}" class="sig-img"/>` : ''}</div>
                <div style="border-top:1px solid #000; width:100%; text-align:center; font-size:8px; padding-top:2px;">Ing. Samantha Dominguez</div>
                <div style="font-weight:bold; font-size:10px;">Por Parte Del Cliente</div>
              </td>
              <td class="sig-cell" style="border-left:1px solid #000; border-right:none; border-bottom:none; border-top:none; text-align:center; vertical-align:bottom; width:50%; padding:0;">
                <div style="height:45px;">${firmaTecnico ? `<img src="${firmaTecnico}" class="sig-img"/>` : ''}</div>
                <div style="border-top:1px solid #000; width:100%; text-align:center; font-size:8px; padding-top:2px;">Adrian Alberto Madrigal Pimentel</div>
                <div style="font-weight:bold; font-size:10px;">Por Parte De <span style="color: red;">FIRE</span> ENGINEERS</div>
              </td>
            </tr>
          </table>
        </body>
      </html>
      `;

      const { uri } = await printHtmlToPdf({ html: htmlContent, fileName: `supresion-${formData.id || Date.now()}.pdf` });
      await sharePdfUri(uri);
      Alert.alert("Listo", "PDF compartido correctamente");
    } catch (error) {
      Alert.alert("Error", error.message);
    } finally {
      setSaving(false);
    }
  };

  const generarPDFExcel = async () => {
    const reporteAGuardar = prepararDatosParaGuardar();
    if (!reporteAGuardar) {
      return Alert.alert('Faltan datos', 'Para generar PDF desde Excel, escribe al menos el cliente o contacto.');
    }

    try {
      setSaving(true);
      await generateAndSharePdfFromExcel({
        reportData: reporteAGuardar,
        templateKey: 'bombas',
        fileName: `bombas-${reporteAGuardar.id}`
      });
      enqueueBackup(reporteAGuardar).catch(e => {});
      Alert.alert('Listo', 'PDF (Excel) compartido correctamente');
    } catch (e) {
      Alert.alert('Error Excel->PDF', `${e.message}\n\nPuedes usar el boton GENERAR PDF normal.`);
    } finally {
      setSaving(false);
    }
  };

  const reSubirFotos = async () => {
    const reporteAGuardar = prepararDatosParaGuardar();
    if (!reporteAGuardar) {
      return Alert.alert("Faltan datos", "Se requiere nombre del cliente para continuar.");
    }
    try {
      setSaving(true);
      const result = await reuploadReportAssets(reporteAGuardar);
      const total = result?.totalLocal ?? 0;
      const uploaded = result?.uploadedCount ?? 0;
      const remaining = result?.remainingLocal ?? 0;

      // Actualizar el historial local con las URLs remotas recibidas
      if (result?.report) {
        try {
          let historial = await getSafeMisReportes();
          historial = sanitizeReportsForStorage(historial, { keepLocal: true });
          const updatedReport = optimizeReportForStorage(result.report, { keepLocal: true });
          const reportId = resolveReportId();
          const idx = historial.findIndex(r => String(r.id) === String(reportId));
          if (idx >= 0) historial[idx] = updatedReport;
          else historial.push(updatedReport);
          await saveWithSpaceCheck('mis_reportes', JSON.stringify(historial));
        } catch (saveErr) {
          console.warn('reSubirFotos: failed to update local history (supresion)', saveErr);
        }
      }

      if (total === 0) {
        Alert.alert("Listo", "No se encontraron fotos locales para subir.");
      } else if (remaining > 0) {
        Alert.alert("Parcial", `Fotos subidas: ${uploaded} de ${total}.\nQuedan ${remaining} fotos locales.`);
      } else {
        Alert.alert("Listo", `✅ Fotos subidas: ${uploaded} de ${total}. Datos sincronizados con Supabase.`);
      }
    } catch (e) {
      enqueueBackup(reporteAGuardar).catch(queueErr => {});
      Alert.alert("En cola", "Las fotos se re-subiran cuando haya internet.");
    } finally {
      setSaving(false);
    }
  };

  const TabButton = ({ title }) => (
    <TouchableOpacity onPress={() => setActiveTab(title)} style={[styles.tabButton, activeTab === title && styles.tabButtonActive]}>
      <Text style={[styles.tabButtonText, activeTab === title && styles.tabButtonTextActive]}>{title}</Text>
    </TouchableOpacity>
  );

  const Container = Platform.OS === 'ios' ? KeyboardAvoidingView : View;
  const containerProps = Platform.OS === 'ios' ? { behavior: 'padding' } : {};

  const getTablePage = (tableKey) => tablePages[tableKey] || 1;
  const getVisibleTableRows = (tableKey) => (formData[tableKey] || []).slice(0, getTablePage(tableKey) * TABLE_PAGE_SIZE);
  const canLoadMoreTableRows = (tableKey) => (formData[tableKey]?.length || 0) > getTablePage(tableKey) * TABLE_PAGE_SIZE;
  const loadMoreTableRows = (tableKey) => {
    setTablePages((prev) => ({ ...prev, [tableKey]: (prev[tableKey] || 1) + 1 }));
  };

  const renderTable = (tableKey, header, options = {}) => {
    const { fixed = false, addLabel = 'AGREGAR FILA' } = options;
    const visibleRows = getVisibleTableRows(tableKey);
    const rowsWithAdd = fixed
      ? visibleRows
      : (visibleRows.length === 0
        ? [{ __add: true, __key: `__add__${tableKey}` }]
        : (() => {
          const next = [...visibleRows];
          next.splice(Math.max(visibleRows.length - 1, 0), 0, { __add: true, __key: `__add__${tableKey}` });
          return next;
        })());

    return (
      <View style={styles.tableContainer}>
        <View style={styles.tableHeader}>
          <Text style={[styles.hText, { flex: 0.5 }]}>ID</Text>
          <Text style={[styles.hText, { flex: 1.5 }]}>{header}</Text>
          <Text style={[styles.hText, { flex: 0.8 }]}>Estado</Text>
          <Text style={[styles.hText, { flex: 0.8 }]}>Lectura</Text>
          <Text style={[styles.hText, { flex: 1.2 }]}>Imagen</Text>
        </View>
        {rowsWithAdd.map((item, index) => {
          if (item.__add) {
            return (
              <View key={item.__key} style={{ paddingVertical: 10 }}>
                <TouchableOpacity style={styles.btnAdd} onPress={() => {
                  const nextList = [...formData[tableKey], { id: '', desc: '', estado: 'SI', lectura: '', imagen: null }];
                  setFormData({ ...formData, [tableKey]: nextList });
                  const pagesNeeded = Math.ceil(nextList.length / TABLE_PAGE_SIZE) || 1;
                  setTablePages((prev) => {
                    const current = prev[tableKey] || 1;
                    return pagesNeeded > current ? { ...prev, [tableKey]: pagesNeeded } : prev;
                  });
                }}>
                  <Text style={styles.btnAddText}>{addLabel}</Text>
                </TouchableOpacity>
              </View>
            );
          }
          const realIndex = formData[tableKey].indexOf(item);
          const idx = realIndex >= 0 ? realIndex : index;
          return (
            <View key={`row-${tableKey}-${idx}`} style={styles.tableRow}>
              <TextInput
                style={[styles.cell, { flex: 0.5 }, fixed && styles.cellLocked]}
                value={item.id}
                editable={!fixed}
                onChangeText={t => {
                  const res = [...formData[tableKey]]; res[idx].id = t; setFormData({ ...formData, [tableKey]: res });
                }}
                {...BASE_INPUT_PROPS}
              />
              <TextInput
                style={[styles.cell, { flex: 1.5 }, fixed && styles.cellLocked, fixed && styles.cellQuestion]}
                value={item.desc}
                editable={!fixed}
                multiline={fixed}
                onChangeText={t => {
                  const res = [...formData[tableKey]]; res[idx].desc = t; setFormData({ ...formData, [tableKey]: res });
                }}
                {...BASE_INPUT_PROPS}
              />
              <TouchableOpacity style={styles.pickerEstado} onPress={() => {
                  const res = [...formData[tableKey]];
                  res[idx].estado = item.estado === 'SI' ? 'NO' : item.estado === 'NO' ? 'N/A' : 'SI';
                  setFormData({ ...formData, [tableKey]: res });
                }}>
                  <Text style={{ textAlign: 'center', fontSize: 10, fontWeight: 'bold', color: BRAND.colors.text }}>{item.estado} ▾</Text>
              </TouchableOpacity>
              <TextInput
                style={[styles.cell, { flex: 0.8 }]}
                value={item.lectura}
                onChangeText={t => {
                  const res = [...formData[tableKey]]; res[idx].lectura = t; setFormData({ ...formData, [tableKey]: res });
                }}
                {...BASE_INPUT_PROPS}
              />
              <TouchableOpacity style={styles.imageCell} onPress={() => takePhoto(null, idx, tableKey)}>
                {item.imagen ? (
                  <Image source={{ uri: item.imagen }} style={styles.imagePreview} onError={() => { }} />
                ) : (
                  <Text style={styles.imagePlaceholderText}>FOTO</Text>
                )}
              </TouchableOpacity>
            </View>
          );
        })}
        {canLoadMoreTableRows(tableKey) && (
          <TouchableOpacity style={styles.btnLoadMore} onPress={() => loadMoreTableRows(tableKey)}>
            <Text style={styles.btnLoadMoreText}>CARGAR 200 MAS</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  if (loading) return <ActivityIndicator size="large" color={BRAND.colors.accentStrong} style={{ flex: 1 }} />;

  return (
    <Container
      {...containerProps}
      style={[styles.container, { paddingBottom: insets.bottom }]}
    >
      <View style={styles.headerRed}>
        <Text style={styles.headerTitle}>Reporte: {cliente || 'Cuarto de Bombas'}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsScroll}>
          <TabButton title="GENERAL" /><TabButton title="SUPRESIÓN" /><TabButton title="FIRMAS" />
        </ScrollView>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 24) }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="none"
      >
        {activeTab === 'GENERAL' && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>1. INFORMACIÓN GENERAL DEL REPORTE</Text>
            <Text style={{ fontSize: 10, color: BRAND.colors.textMuted, marginBottom: 10 }}>
            </Text>

            <Text style={styles.cardTitle}>Sucursal</Text>
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 15 }}>
              <TouchableOpacity
                style={{ flex: 1, padding: 10, borderRadius: 5, backgroundColor: formData.sucursal === 'Matriz Toluquilla' ? BRAND.colors.accent : BRAND.colors.bgAlt, alignItems: 'center' }}
                onPress={() => setFormData({ ...formData, sucursal: 'Matriz Toluquilla' })}>
                <Text style={{ color: formData.sucursal === 'Matriz Toluquilla' ? 'white' : BRAND.colors.text, fontWeight: 'bold', fontSize: 12 }}>Matriz Toluquilla</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{ flex: 1, padding: 10, borderRadius: 5, backgroundColor: formData.sucursal === 'Centro' ? BRAND.colors.accent : BRAND.colors.bgAlt, alignItems: 'center' }}
                onPress={() => setFormData({ ...formData, sucursal: 'Centro' })}>
                <Text style={{ color: formData.sucursal === 'Centro' ? 'white' : BRAND.colors.text, fontWeight: 'bold', fontSize: 12 }}>Sucursal Centro</Text>
              </TouchableOpacity>
            </View>

            <View style={{ marginBottom: 15, alignItems: 'center' }}>
              <Text style={styles.label}>Logo del cliente</Text>
              <TouchableOpacity style={[styles.btnSecondary, { paddingHorizontal: 20, paddingVertical: 8 }]} onPress={pickLogo}>
                <Text style={styles.btnSecondaryText}>{formData.logo_cliente ? 'Cambiar logo' : 'Seleccionar logo'}</Text>
              </TouchableOpacity>
              {formData.logo_cliente && <Image source={{ uri: formData.logo_cliente }} style={{ width: 120, height: 60, marginTop: 10, resizeMode: 'contain' }} />}
            </View>

            <Text style={styles.cardTitle}>Datos del cliente</Text>
            <View style={styles.row}>
              <InputField label="Cliente / razón social" value={formData.h_cliente} onChangeText={(t) => setFormData(prev => ({ ...prev, h_cliente: t, g_cliente: t }))} />
              <InputField label="Contacto del cliente" value={formData.h_contacto} onChangeText={(t) => setFormData(prev => ({ ...prev, h_contacto: t, g_cont: t }))} />
            </View>
            <View style={styles.row}>
              <InputField label="Teléfono del cliente" value={formData.h_tel} onChangeText={(t) => setFormData(prev => ({ ...prev, h_tel: t, g_tel: t }))} keyboard="phone-pad" />
              <InputField label="Correo del cliente" value={formData.h_email} onChangeText={(t) => setFormData(prev => ({ ...prev, h_email: t, g_mail: t }))} keyboard="email-address" />
            </View>
            <View style={styles.row}>
              <InputField label="Predio / ubicación del cliente" value={formData.h_predio} onChangeText={(t) => setFormData(prev => ({ ...prev, h_predio: t }))} />
              <InputField label="Dirección del sitio" value={formData.h_direccion} onChangeText={(t) => setFormData(prev => ({ ...prev, h_direccion: t, g_dir: t }))} />
            </View>

            <Text style={styles.cardTitle}>Datos de la empresa que presta el servicio</Text>
            <View style={styles.row}>
              <InputField label="Ejecutivo / representante" value={formData.h_ejecutivo} onChangeText={(t) => setFormData(prev => ({ ...prev, h_ejecutivo: t }))} />
              <InputField label="E-mail del ejecutivo" value={formData.h_email_ejecutivo} onChangeText={(t) => setFormData(prev => ({ ...prev, h_email_ejecutivo: t }))} keyboard="email-address" />
            </View>
            <View style={styles.row}>
              <InputField label="Celular de la empresa" value={formData.h_cel} onChangeText={(t) => setFormData(prev => ({ ...prev, h_cel: t }))} keyboard="phone-pad" />
              <InputField label="Teléfono de oficina" value={formData.h_tel_oficina} onChangeText={(t) => setFormData(prev => ({ ...prev, h_tel_oficina: t }))} keyboard="phone-pad" />
            </View>
            <View style={styles.row}>
              <InputField label="Técnico" value={formData.h_tecnico} onChangeText={(t) => setFormData(prev => ({ ...prev, h_tecnico: t, f_eng_nombre: t }))} />
              <InputField label="Departamento supervisor" value={formData.h_departamento_supervisor} onChangeText={(t) => setFormData(prev => ({ ...prev, h_departamento_supervisor: t, g_depto: t }))} />
            </View>
            <InputField label="Responsable del departamento" value={formData.h_responsable_depto} onChangeText={(t) => setFormData(prev => ({ ...prev, h_responsable_depto: t }))} />

            <Text style={styles.cardTitle}>Datos del servicio</Text>
            <View style={styles.row}>
              <InputField label="Fecha" value={formData.h_fecha} onChangeText={(t) => setFormData(prev => ({ ...prev, h_fecha: t, g_fecha: t }))} />
              <InputField label="Sistema" value={formData.h_sistema} onChangeText={(t) => setFormData(prev => ({ ...prev, h_sistema: t }))} />
            </View>
            <View style={styles.row}>
              <InputField label="Hora de inicio" value={formData.h_hora_inicio} onChangeText={(t) => setFormData(prev => ({ ...prev, h_hora_inicio: t }))} />
              <InputField label="Hora final" value={formData.h_hora_final} onChangeText={(t) => setFormData(prev => ({ ...prev, h_hora_final: t }))} />
            </View>
          </View>
        )}

        {activeTab === 'SUPRESIÓN' && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>2. INSPECCIÓN SISTEMA DE SUPRESIÓN</Text>
            {renderTable('table_supresion', 'Inspección General Sistema de Supresión', { fixed: true, header: 'Inspeccion General Sistema de Supresión' })}
          </View>
        )}

        {activeTab === 'FIRMAS' && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>7. GALERÍA DE EVIDENCIAS Y FIRMAS</Text>

            <Text style={styles.firmasHeader}>Evidencia Fotográfica Final</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 20 }}>
              {['evi1', 'evi2', 'evi3', 'evi4'].map((k) => (
                <TouchableOpacity key={k} style={styles.eviBtn} onPress={() => takePhoto(k)}>
                  {formData.evidencias[k]
                    ? <Image source={{ uri: formData.evidencias[k] }} style={styles.eviPreview} />
                    : <Text style={styles.eviText}>+ FOTO</Text>}
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.firmasHeader}>Observaciones (Si aplica "NO")</Text>
            <TextInput
              style={[styles.input, { height: 80, textAlignVertical: 'top', marginBottom: 20 }]}
              placeholder="Especificar claramente los puntos donde la respuesta fue NO..."
              placeholderTextColor={BRAND.colors.textMuted}
              multiline={true}
              value={formData.observaciones_no}
              onChangeText={t => setFormData({ ...formData, observaciones_no: t })}
            />

            <View style={styles.firmasContainer}>
              <Text style={styles.firmasHeader}>Firmas Digitales</Text>

              <InputField
                label="Nombre de quien firma (Cliente)"
                value={formData.f_cli_nombre}
                onChangeText={(t) => setFormData({ ...formData, f_cli_nombre: t })}
              />

              {/* FIRMA CLIENTE */}
              <Text style={styles.signatureLabel}>Firma del Cliente:</Text>
              <TouchableOpacity style={styles.signatureBox} onPress={() => setSigModal({ visible: true, target: 'cliente' })}>
                {formData.firma_cliente ? <Text style={styles.signedText}>CLIENTE HA FIRMADO ✓</Text> : <Text style={styles.signPrompt}>Toca para firmar (Cliente)</Text>}
              </TouchableOpacity>

              {/* FIRMA TÉCNICO */}
              <Text style={styles.signatureLabel}>Firma Técnico (Fire Engineers):</Text>
              <TextInput
                style={styles.inputFirmaNombre}
                placeholder="Nombre Técnico"
                placeholderTextColor={BRAND.colors.textMuted}
                value={formData.f_eng_nombre}
                onChangeText={t => setFormData({ ...formData, f_eng_nombre: t })}
                {...BASE_INPUT_PROPS}
              />
              <TouchableOpacity style={styles.signatureBox} onPress={() => setSigModal({ visible: true, target: 'tecnico' })}>
                {formData.firma_tecnico ? <Text style={styles.signedText}>TÉCNICO HA FIRMADO ✓</Text> : <Text style={styles.signPrompt}>Toca para firmar (Técnico)</Text>}
              </TouchableOpacity>

              <TouchableOpacity style={styles.btnSecondary} onPress={reSubirFotos} disabled={saving}>
                <Text style={styles.btnSecondaryText}>{saving ? "☁️ SINCRONIZANDO..." : "☁️ FORZAR SINCRONIZACIÓN"}</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.btnSecondary} onPress={guardarEnHistorial} disabled={saving}>
                <Text style={styles.btnSecondaryText}>{saving ? "GUARDANDO..." : "GUARDAR BORRADOR"}</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.btnPrimary} 
                onPress={generarPDF} 
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color={BRAND.colors.ink} />
                ) : (
                  <Text style={styles.btnPrimaryText}>GENERAR PDF</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>

      {/* --- MODAL DE FIRMAS AVANZADO (FULL SCREEN & BOTONES NATIVOS) --- */}
      <Modal visible={sigModal.visible} animationType="slide" onRequestClose={() => setSigModal({ visible: false, target: null })}>
        {sigModal.visible && (
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Firmando: {sigModal.target === 'cliente' ? 'Cliente' : 'Técnico'}</Text>
            </View>

            <View style={styles.signatureArea}>
              <SignatureScreen
                ref={signatureRef}
                onOK={saveSignature}
                onEmpty={() => Alert.alert('Aviso', 'Por favor firma antes de guardar')}
                webStyle={`
                      .m-signature-pad {box-shadow: none; border: none; } 
                      .m-signature-pad--body {border: none;}
                      .m-signature-pad--footer {display: none; margin: 0px;}
                      body,html {width: 100%; height: 100%;}
                      `}
                autoClear={true}
                imageType="image/png"
              />
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity style={[styles.modalBtn, styles.btnGray]} onPress={() => signatureRef.current.clearSignature()}>
                <Text style={styles.modalBtnText}>Borrar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, styles.btnBlueModal]} onPress={() => signatureRef.current.readSignature()}>
                <Text style={styles.modalBtnText}>Guardar Firma</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={{ alignSelf: 'center', marginTop: 10 }} onPress={() => setSigModal({ visible: false, target: null })}>
              <Text style={{ color: BRAND.colors.text, fontWeight: 'bold' }}>CANCELAR</Text>
            </TouchableOpacity>
          </View>
        )}
      </Modal>
    </Container>
  );
}

const InputField = ({ label, value, onChangeText, keyboard = "default" }) => (
  <View style={styles.inputWrapper}>
    <Text style={styles.label}>{label}</Text>
    <TextInput
      style={styles.input}
      value={value}
      onChangeText={onChangeText}
      placeholderTextColor={BRAND.colors.textMuted}
      keyboardType={keyboard}
      {...BASE_INPUT_PROPS}
    />
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BRAND.colors.bg },
  headerRed: { backgroundColor: BRAND.colors.cardAlt, paddingTop: 50, paddingHorizontal: 15, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: BRAND.colors.border },
  headerTitle: { color: BRAND.colors.text, fontSize: 18, fontFamily: BRAND.fonts.title, marginBottom: 10 },
  tabsScroll: { flexDirection: 'row', backgroundColor: BRAND.colors.bgAlt, paddingHorizontal: 10, borderBottomWidth: 1, borderBottomColor: BRAND.colors.border },
  tabButton: { paddingHorizontal: 15, paddingVertical: 12 },
  tabButtonActive: { borderBottomWidth: 3, borderBottomColor: BRAND.colors.accent },
  tabButtonText: { fontSize: 11, color: BRAND.colors.textMuted, fontFamily: BRAND.fonts.body },
  tabButtonTextActive: { color: BRAND.colors.accentStrong, fontFamily: BRAND.fonts.semi },
  content: { flex: 1, padding: 10 },
  card: { backgroundColor: BRAND.colors.card, padding: 15, borderRadius: BRAND.radius.lg, marginBottom: 15, borderWidth: 1, borderColor: BRAND.colors.border },
  cardTitle: { fontFamily: BRAND.fonts.semi, fontSize: 14, color: BRAND.colors.accentStrong, marginBottom: 10 },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 10, marginBottom: 5 },
  inputWrapper: { flex: 1 },
  label: { fontSize: 10, color: BRAND.colors.textMuted, marginBottom: 5, fontFamily: BRAND.fonts.semi },
  input: { borderWidth: 1, borderColor: BRAND.colors.border, borderRadius: BRAND.radius.md, padding: 8, fontSize: 12, backgroundColor: BRAND.colors.bgAlt, color: BRAND.colors.text, fontFamily: BRAND.fonts.body },
  tableContainer: { marginTop: 10 },
  tableHeader: { flexDirection: 'row', backgroundColor: BRAND.colors.cardAlt, padding: 8, borderRadius: BRAND.radius.md, borderWidth: 1, borderColor: BRAND.colors.border },
  hText: { fontSize: 9, color: BRAND.colors.accentStrong, fontFamily: BRAND.fonts.semi, textAlign: 'center' },
  tableRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: BRAND.colors.border },
  cell: { borderWidth: 1, borderColor: BRAND.colors.border, padding: 6, fontSize: 10, borderRadius: BRAND.radius.md, marginHorizontal: 2, height: 38, backgroundColor: BRAND.colors.bgAlt, color: BRAND.colors.text, fontFamily: BRAND.fonts.body },
  cellLocked: { backgroundColor: BRAND.colors.cardAlt, color: BRAND.colors.textMuted },
  cellQuestion: { height: 60, textAlignVertical: 'top' },
  pickerEstado: { flex: 0.8, borderWidth: 1, borderColor: BRAND.colors.border, borderRadius: BRAND.radius.md, height: 38, justifyContent: 'center', backgroundColor: BRAND.colors.bgAlt },
  imageCell: { flex: 1.2, height: 70, justifyContent: 'center', borderRadius: BRAND.radius.sm, marginHorizontal: 2, backgroundColor: BRAND.colors.bgAlt, borderWidth: 1, borderColor: BRAND.colors.border, overflow: 'hidden' },
  imagePreview: { width: '100%', height: '100%', borderRadius: BRAND.radius.sm },
  imagePlaceholderText: { color: BRAND.colors.textMuted, fontSize: 8, textAlign: 'center', fontFamily: BRAND.fonts.semi },
  btnAdd: { backgroundColor: BRAND.colors.accent, padding: 10, borderRadius: BRAND.radius.md, marginTop: 10 },
  btnAddText: { color: BRAND.colors.ink, textAlign: 'center', fontFamily: BRAND.fonts.semi, fontSize: 12 },
  btnLoadMore: { backgroundColor: BRAND.colors.bgAlt, padding: 10, borderRadius: BRAND.radius.md, marginTop: 10, borderWidth: 1, borderColor: BRAND.colors.border },
  btnLoadMoreText: { color: BRAND.colors.text, textAlign: 'center', fontFamily: BRAND.fonts.semi, fontSize: 12 },
  eviBtn: { width: 70, height: 70, borderStyle: 'dashed', borderWidth: 1, borderColor: BRAND.colors.border, margin: 5, borderRadius: BRAND.radius.sm, alignItems: 'center', justifyContent: 'center', backgroundColor: BRAND.colors.bgAlt, overflow: 'hidden' },
  eviPreview: { width: '100%', height: '100%', borderRadius: BRAND.radius.sm },
  eviText: { fontSize: 9, fontFamily: BRAND.fonts.semi, color: BRAND.colors.textMuted, textAlign: 'center' },
  firmasContainer: { marginTop: 20 },
  firmasHeader: { color: BRAND.colors.accentStrong, fontFamily: BRAND.fonts.semi, fontSize: 14, marginBottom: 15 },
  signatureLabel: { fontSize: 11, fontFamily: BRAND.fonts.semi, color: BRAND.colors.text, marginTop: 10 },
  inputFirmaNombre: { borderWidth: 1, borderColor: BRAND.colors.border, padding: 10, borderRadius: BRAND.radius.md, marginTop: 5, fontSize: 12, backgroundColor: BRAND.colors.bgAlt, color: BRAND.colors.text, fontFamily: BRAND.fonts.body },
  signatureBox: { height: 150, borderWidth: 1, borderColor: BRAND.colors.border, borderStyle: 'dashed', borderRadius: BRAND.radius.md, marginTop: 5, justifyContent: 'center', alignItems: 'center', backgroundColor: BRAND.colors.bgAlt },
  signPrompt: { color: BRAND.colors.textMuted, fontFamily: BRAND.fonts.body },
  signedText: { color: BRAND.colors.accentStrong, fontFamily: BRAND.fonts.semi },
  btnSecondary: { backgroundColor: BRAND.colors.cardAlt, padding: 15, borderRadius: BRAND.radius.md, marginTop: 15, borderWidth: 1, borderColor: BRAND.colors.border },
  btnPrimary: { backgroundColor: BRAND.colors.accent, padding: 15, borderRadius: BRAND.radius.md, marginTop: 10 },
  btnPrimaryText: { color: BRAND.colors.ink, textAlign: 'center', fontFamily: BRAND.fonts.semi, fontSize: 14 },
  btnSecondaryText: { color: BRAND.colors.text, textAlign: 'center', fontFamily: BRAND.fonts.semi, fontSize: 14 },

  modalContainer: { flex: 1, backgroundColor: 'rgba(8,10,16,0.95)', paddingTop: 50 },
  modalHeader: { backgroundColor: BRAND.colors.cardAlt, padding: 15, borderTopLeftRadius: BRAND.radius.md, borderTopRightRadius: BRAND.radius.md, marginHorizontal: 10, alignItems: 'center', borderWidth: 1, borderColor: BRAND.colors.border },
  modalTitle: { fontFamily: BRAND.fonts.semi, fontSize: 16, color: BRAND.colors.text },
  signatureArea: { flex: 1, backgroundColor: BRAND.colors.bgAlt, marginHorizontal: 10 },
  modalButtons: { flexDirection: 'row', justifyContent: 'space-around', backgroundColor: BRAND.colors.cardAlt, padding: 10, marginHorizontal: 10, borderBottomLeftRadius: BRAND.radius.md, borderBottomRightRadius: BRAND.radius.md, borderWidth: 1, borderColor: BRAND.colors.border },
  modalBtn: { padding: 12, borderRadius: BRAND.radius.md, width: '45%', alignItems: 'center' },
  btnGray: { backgroundColor: BRAND.colors.bgAlt },
  btnBlueModal: { backgroundColor: BRAND.colors.accent },
  modalBtnText: { color: BRAND.colors.text, fontFamily: BRAND.fonts.semi, fontSize: 12 },
  btnCloseModal: { marginTop: 15, padding: 12, alignItems: 'center', backgroundColor: BRAND.colors.bgAlt, marginHorizontal: 15, borderRadius: BRAND.radius.md, borderWidth: 1, borderColor: BRAND.colors.border }
});

export default ReporteSupresion;
