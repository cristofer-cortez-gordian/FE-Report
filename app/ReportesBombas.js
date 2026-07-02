import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
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
import { downloadReportAssets, enqueueBackup, imageUriToDataUrl, migrateReportPhotoUris, optimizeReportForStorage, persistPhotoUri, persistSignatureDataUrl, reuploadReportAssets, sanitizeReportsForStorage, savePhotoToGallery, saveUserSnapshot, saveWithSpaceCheck, signatureUriToDataUrl } from '../utils/backup';
import { buildExactPdfHeader, PDF_EXACT_HEADER_STYLES, PDF_PRINT_SAFE_STYLES } from '../utils/pdfHeader';
import { printHtmlToPdf, sharePdfUri } from '../utils/pdfExport';

const BASE_INPUT_PROPS = {
  blurOnSubmit: false,
  returnKeyType: 'default'
};

export default function ReporteCuartoBombasTabs() {
  const { cliente, idOriginal, modo } = useLocalSearchParams();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState('GENERAL');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const TABLE_PAGE_SIZE = 200;
  const [tablePages, setTablePages] = useState({ table_ig: 1, table_md: 1, table_me: 1, table_mj: 1 });

  const DEFAULT_IG_ROWS = [
    {
      id: 'IG-1',
      desc: 'Cuarto de bombas cuenta con iluminacion adecuada?',
      estado: 'SI',
      lectura: '',
      imagen: null
    },
    {
      id: 'IG-2',
      desc: 'El cuarto de bombas esta libre de algun tipo de liquido derramado?',
      estado: 'SI',
      lectura: '',
      imagen: null
    },
    {
      id: 'IG-3',
      desc: 'Las tuberias estan libres de dano fisico, fuga, acoplamientos ajustados, soporteria suelta o alguna condicion anormal?',
      estado: 'SI',
      lectura: '',
      imagen: null
    },
    {
      id: 'IG-4',
      desc: 'Las valvulas de sistema contra incendios cuentan con candado?',
      estado: 'SI',
      lectura: '',
      imagen: null
    },
    {
      id: 'IG-5',
      desc: 'Es correcto el nivel de la cisterna o tanque de agua?',
      estado: 'SI',
      lectura: '',
      imagen: null
    },
    {
      id: 'IG-6',
      desc: 'Cual es la presion en la red contra incendio?',
      estado: 'SI',
      lectura: '',
      imagen: null
    },
    {
      id: 'IG-7',
      desc: 'La base del motor Diesel, electrico y bomba jockey tiene base adecuada y correctamente anclada?',
      estado: 'SI',
      lectura: '',
      imagen: null
    }
  ];

  const DEFAULT_MD_ROWS = [
    { id: 'MD-1', desc: 'Valvulas de control de la linea de succion fijas abiertas:', estado: 'SI', lectura: '', imagen: null },
    { id: 'MD-2', desc: 'Valvulas de control de la linea de descarga fijas abiertas:', estado: 'SI', lectura: '', imagen: null },
    { id: 'MD-3', desc: 'Valvulas de control de la linea de retorno fijas cerradas:', estado: 'SI', lectura: '', imagen: null },
    { id: 'MD-4', desc: 'El panel de control del motor Diesel, marca algun problema?', estado: 'SI', lectura: '', imagen: null },
    { id: 'MD-5', desc: 'Todas las terminales y conexiones del panel de control del motor diesel estan debidamente conectadas:', estado: 'SI', lectura: '', imagen: null },
    { id: 'MD-6', desc: 'El voltaje de corriente alterna es el correcto? Anotar valor', estado: 'SI', lectura: '', imagen: null },
    { id: 'MD-7', desc: 'El panel de control tiene cables sueltos:', estado: 'SI', lectura: '', imagen: null },
    { id: 'MD-8', desc: 'Limpiar panel de control:', estado: 'SI', lectura: '', imagen: null },
    { id: 'MD-9', desc: 'La presion que marca el panel de control es igual a la presion que marca el manometro:', estado: 'SI', lectura: '', imagen: null },
    { id: 'MD-10', desc: 'El cargador de baterias funciona adecuadamente:', estado: 'SI', lectura: '', imagen: null },
    { id: 'MD-11', desc: 'Bateria 1 completamente cargada. (anotar valor)', estado: 'SI', lectura: '', imagen: null },
    { id: 'MD-12', desc: 'Bateria 2 completamente cargada. (anotar valor)', estado: 'SI', lectura: '', imagen: null },
    { id: 'MD-13', desc: 'Terminales de baterias limpio', estado: 'SI', lectura: '', imagen: null },
    { id: 'MD-14', desc: 'Nivel de electrolitos en baterias normal:', estado: 'SI', lectura: '', imagen: null },
    { id: 'MD-15', desc: 'La linea del combustible esta libre de fugas y danos?', estado: 'SI', lectura: '', imagen: null },
    { id: 'MD-16', desc: 'Tanque diesel tiene un minimo 3/4 de lleno:', estado: 'SI', lectura: '', imagen: null },
    { id: 'MD-17', desc: 'La valvula del combustible se encuentra abierta?.', estado: 'SI', lectura: '', imagen: null },
    { id: 'MD-18', desc: 'Hora antes del arranque y despues del arranque', estado: 'SI', lectura: '', imagen: null },
    { id: 'MD-19', desc: 'Las valvulas de la linea de enfriamiento estan en su posicion adecuada?', estado: 'SI', lectura: '', imagen: null },
    { id: 'MD-20', desc: 'Nivel de aceite en el motor diesel es el correcto', estado: 'SI', lectura: '', imagen: null },
    { id: 'MD-21', desc: 'Nivel de agua con anticongelante del motor diesel lleno:', estado: 'SI', lectura: '', imagen: null },
    { id: 'MD-22', desc: 'Precalentador funciona correctamente', estado: 'SI', lectura: '', imagen: null },
    { id: 'MD-23', desc: 'La temperatura del motor antes del arranque es la adecuada (30 a 50 C?).', estado: 'SI', lectura: '', imagen: null },
    { id: 'MD-24', desc: 'Se encuentra el estopero lubricado antes del arranque?', estado: 'SI', lectura: '', imagen: null },
    { id: 'MD-25', desc: 'El motor a diesel funciona en automatico:', estado: 'SI', lectura: '', imagen: null },
    { id: 'MD-26', desc: 'Presion de arranque PSI:', estado: 'SI', lectura: '', imagen: null },
    { id: 'MD-27', desc: 'Presion de paro PSI:', estado: 'SI', lectura: '', imagen: null },
    { id: 'MD-28A', desc: 'Arrancar el motor en primer marcha 15 minutos. (Si solo tiene una marcha debera de completar los 30 minutos)', estado: 'SI', lectura: '', imagen: null },
    { id: 'MD-28B', desc: 'Arrancar el motor en segunda marcha 15 minutos:', estado: 'SI', lectura: '', imagen: null },
    { id: 'MD-29', desc: 'Presion de aceite PSI.', estado: 'SI', lectura: '', imagen: null },
    { id: 'MD-30', desc: 'Revoluciones por Minuto', estado: 'SI', lectura: '', imagen: null },
    { id: 'MD-31', desc: 'Temperatura inicial del motor', estado: 'SI', lectura: '', imagen: null },
    { id: 'MD-32', desc: 'Temperatura final del motor:', estado: 'SI', lectura: '', imagen: null },
    { id: 'MD-33', desc: 'El sistema se encuentra libre de vibraciones o ruido inusual.', estado: 'SI', lectura: '', imagen: null },
    { id: 'MD-34', desc: 'El tubo de escape de emisiones se encuentra en buen estado.', estado: 'SI', lectura: '', imagen: null }
  ];

  const DEFAULT_MJ_ROWS = [
    { id: 'MJ-1', desc: 'Valvulas de control de la linea de succion fijas abiertas:', estado: 'SI', lectura: '', imagen: null },
    { id: 'MJ-2', desc: 'Valvulas de control de la linea de descarga fijas abiertas:', estado: 'SI', lectura: '', imagen: null },
    { id: 'MJ-3', desc: 'Valvulas de control de la linea de retorno fijas cerradas:', estado: 'SI', lectura: '', imagen: null },
    { id: 'MJ-4', desc: 'El panel de control del Bomba Jockey, marca algun problema?', estado: 'SI', lectura: '', imagen: null },
    { id: 'MJ-5', desc: 'Todas la terminales y conexiones estan debidamente conectadas:', estado: 'SI', lectura: '', imagen: null },
    { id: 'MJ-6', desc: 'El panel de control tiene cables sueltos:', estado: 'SI', lectura: '', imagen: null },
    { id: 'MJ-7', desc: 'Cuenta con valvula eliminadora de aire (Critico Bomba Vertical)?.', estado: 'SI', lectura: '', imagen: null },
    { id: 'MJ-8', desc: 'Es correcto el voltaje de entrada del interruptor termomagnetico?', estado: 'SI', lectura: '', imagen: null },
    { id: 'MJ-9', desc: 'Voltaje L1-L2.', estado: 'SI', lectura: '', imagen: null },
    { id: 'MJ-10', desc: 'Voltaje L1-L3.', estado: 'SI', lectura: '', imagen: null },
    { id: 'MJ-11', desc: 'Voltaje L2-L3.', estado: 'SI', lectura: '', imagen: null },
    { id: 'MJ-12', desc: 'Es correcto el voltaje de salida del interruptor termomagnetico?', estado: 'SI', lectura: '', imagen: null },
    { id: 'MJ-13', desc: 'Voltaje L1-L2.', estado: 'SI', lectura: '', imagen: null },
    { id: 'MJ-14', desc: 'Voltaje L1-L3.', estado: 'SI', lectura: '', imagen: null },
    { id: 'MJ-15', desc: 'Voltaje L2-L3.', estado: 'SI', lectura: '', imagen: null },
    { id: 'MJ-16', desc: 'Es correcto el voltaje de alimentacion en el contactor de arranque?.', estado: 'SI', lectura: '', imagen: null },
    { id: 'MJ-17', desc: 'Voltaje L1-L2.', estado: 'SI', lectura: '', imagen: null },
    { id: 'MJ-18', desc: 'Voltaje L1-L3.', estado: 'SI', lectura: '', imagen: null },
    { id: 'MJ-19', desc: 'Voltaje L2-L3.', estado: 'SI', lectura: '', imagen: null },
    { id: 'MJ-20', desc: 'La Bomba Jockey funciona en automatico:', estado: 'SI', lectura: '', imagen: null },
    { id: 'MJ-21', desc: 'Presion de arranque PSI:', estado: 'SI', lectura: '', imagen: null },
    { id: 'MJ-22', desc: 'Presion de paro PSI:', estado: 'SI', lectura: '', imagen: null },
    { id: 'MJ-23', desc: 'El sistema se encuentra libre de vibraciones o ruido inusual.', estado: 'SI', lectura: '', imagen: null }
  ];

  const normalizeIgTable = (rows) => {
    const list = Array.isArray(rows) ? rows : [];
    const byId = new Map();
    list.forEach((row) => {
      if (row?.id) byId.set(String(row.id).trim(), row);
    });
    return DEFAULT_IG_ROWS.map((def, index) => {
      const match = byId.get(def.id) || list[index] || {};
      return {
        ...def,
        estado: match.estado || def.estado,
        lectura: match.lectura ?? def.lectura,
        imagen: match.imagen ?? def.imagen
      };
    });
  };

  const normalizeMdTable = (rows) => {
    const list = Array.isArray(rows) ? rows : [];
    const byId = new Map();
    list.forEach((row) => {
      if (row?.id) byId.set(String(row.id).trim(), row);
    });
    return DEFAULT_MD_ROWS.map((def, index) => {
      const match = byId.get(def.id) || list[index] || {};
      return {
        ...def,
        estado: match.estado || def.estado,
        lectura: match.lectura ?? def.lectura,
        imagen: match.imagen ?? def.imagen
      };
    });
  };

  const DEFAULT_ME_ROWS = [
    { id: 'ME-1', desc: 'Válvulas de control de la linea de succión fijas abiertas:', estado: 'SI', lectura: '', imagen: null },
    { id: 'ME-2', desc: 'Válvulas de control de la linea de descarga fijas abiertas:', estado: 'SI', lectura: '', imagen: null },
    { id: 'ME-3', desc: 'Válvulas de control de la linea de retorno fijas cerradas:', estado: 'SI', lectura: '', imagen: null },
    { id: 'ME-4', desc: 'Sello mecanico funciona correctamente', estado: 'SI', lectura: '', imagen: null },
    { id: 'ME-5', desc: '¿El panel de control del motor eléctrico, marca algún problema?', estado: 'SI', lectura: '', imagen: null },
    { id: 'ME-6', desc: 'Todas las terminales y conexiones están debidamente conectadas:', estado: 'SI', lectura: '', imagen: null },
    { id: 'ME-7', desc: 'El panel de control tiene cables sueltos:', estado: 'SI', lectura: '', imagen: null },
    { id: 'ME-8', desc: '¿Cuenta con válvula eliminadora de aire (Crítico Bomba Vertical)?', estado: 'SI', lectura: '', imagen: null },
    { id: 'ME-9', desc: '¿Es correcto el voltaje de entrada del interruptor termomagnético?', estado: 'SI', lectura: '', imagen: null },
    { id: 'ME-10', desc: 'Voltaje L1-L2.', estado: 'SI', lectura: '', imagen: null },
    { id: 'ME-11', desc: 'Voltaje L1-L3.', estado: 'SI', lectura: '', imagen: null },
    { id: 'ME-12', desc: 'Voltaje L2-L3.', estado: 'SI', lectura: '', imagen: null },
    { id: 'ME-13', desc: '¿Es correcto el voltaje de salida del interruptor termomagnético?', estado: 'SI', lectura: '', imagen: null },
    { id: 'ME-14', desc: 'Voltaje L1-L2.', estado: 'SI', lectura: '', imagen: null },
    { id: 'ME-15', desc: 'Voltaje L1-L3.', estado: 'SI', lectura: '', imagen: null },
    { id: 'ME-16', desc: 'Voltaje L2-L3.', estado: 'SI', lectura: '', imagen: null },
    { id: 'ME-17', desc: '¿Es correcto el voltaje de alimentación en el contactor de arranque?', estado: 'SI', lectura: '', imagen: null },
    { id: 'ME-18', desc: 'Voltaje L1-L2.', estado: 'SI', lectura: '', imagen: null },
    { id: 'ME-19', desc: 'Voltaje L1-L3.', estado: 'SI', lectura: '', imagen: null },
    { id: 'ME-20', desc: 'Voltaje L2-L3.', estado: 'SI', lectura: '', imagen: null },
    { id: 'ME-21', desc: 'El motor eléctrico funciona en automático:', estado: 'SI', lectura: '', imagen: null },
    { id: 'ME-22', desc: 'Presión de arranque PSI:', estado: 'SI', lectura: '', imagen: null },
    { id: 'ME-23', desc: 'Presión de paro PSI:', estado: 'SI', lectura: '', imagen: null },
    { id: 'ME-24', desc: 'Arrancar el motor 20 minutos.', estado: 'SI', lectura: '', imagen: null },
    { id: 'ME-25', desc: 'El sistema se encuentra libre de vibraciones o ruido inusual.', estado: 'SI', lectura: '', imagen: null }
  ];

  const normalizeMeTable = (rows) => {
    const list = Array.isArray(rows) ? rows : [];
    const byId = new Map();
    list.forEach((row) => {
      if (row?.id) byId.set(String(row.id).trim(), row);
    });
    return DEFAULT_ME_ROWS.map((def, index) => {
      const match = byId.get(def.id) || list[index] || {};
      return {
        ...def,
        estado: match.estado || def.estado,
        lectura: match.lectura ?? def.lectura,
        imagen: match.imagen ?? def.imagen
      };
    });
  };

  const normalizeMjTable = (rows) => {
    const list = Array.isArray(rows) ? rows : [];
    const byId = new Map();
    list.forEach((row) => {
      if (row?.id) byId.set(String(row.id).trim(), row);
    });
    return DEFAULT_MJ_ROWS.map((def, index) => {
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
    
    let cuartos = base.cuartos || [];
    if (cuartos.length === 0) {
      cuartos = [ { table_ig: normalizeIgTable(base.table_ig) } ];
    } else {
      cuartos = cuartos.map(c => ({ table_ig: normalizeIgTable(c.table_ig) }));
    }

    let motores_diesel = base.motores_diesel || [];
    if (motores_diesel.length === 0) {
      motores_diesel = [ {
        md_tab_m: base.md_tab_m || '', md_tab_s: base.md_tab_s || '',
        md_bom_m: base.md_bom_m || '', md_bom_s: base.md_bom_s || '',
        md_mot_m: base.md_mot_m || '', md_mot_s: base.md_mot_s || '',
        table_md: normalizeMdTable(base.table_md)
      } ];
    } else {
      motores_diesel = motores_diesel.map(m => ({ ...m, table_md: normalizeMdTable(m.table_md) }));
    }

    let motores_electricos = base.motores_electricos || [];
    if (motores_electricos.length === 0) {
      motores_electricos = [ {
        me_tab_m: base.me_tab_m || '', me_tab_s: base.me_tab_s || '',
        me_bom_m: base.me_bom_m || '', me_bom_s: base.me_bom_s || '',
        me_mot_m: base.me_mot_m || '', me_mot_s: base.me_mot_s || '',
        table_me: normalizeMeTable(base.table_me)
      } ];
    } else {
      motores_electricos = motores_electricos.map(m => ({ ...m, table_me: normalizeMeTable(m.table_me) }));
    }

    let bombas_jockey = base.bombas_jockey || [];
    if (bombas_jockey.length === 0) {
      bombas_jockey = [ {
        mj_tab_m: base.mj_tab_m || '', mj_tab_s: base.mj_tab_s || '',
        mj_bom_m: base.mj_bom_m || '', mj_bom_s: base.mj_bom_s || '',
        mj_mot_m: base.mj_mot_m || '', mj_mot_s: base.mj_mot_s || '',
        table_mj: normalizeMjTable(base.table_mj)
      } ];
    } else {
      bombas_jockey = bombas_jockey.map(m => ({ ...m, table_mj: normalizeMjTable(m.table_mj) }));
    }

    return {
      ...base,
      evidencias: base.evidencias || { evi1: null, evi2: null, evi3: null, evi4: null },
      firma_cliente: base.firma_cliente ?? null,
      firma_tecnico: base.firma_tecnico ?? null,
      cuartos,
      motores_diesel,
      motores_electricos,
      bombas_jockey
    };
  };
  
  // Modales para firmas
  const [sigModal, setSigModal] = useState({ visible: false, target: null });
  const signatureRef = useRef();

  const [formData, setFormData] = useState({
    h_fecha: new Date().toLocaleDateString('es-MX'),
    h_ejecutivo: '',
    h_email_ejecutivo: '',
    h_cel: '',
    h_tel_oficina: '',
    h_tecnico: '',
    h_sistema: 'MANTENIMIENTO A CUARTO DE BOMBAS',
    h_cliente: cliente || "HERSHEYS DE MEXICO",
    h_contacto: '',
    sucursal: 'Matriz Toluquilla',
    logo_cliente: null,
    h_departamento_supervisor: '',
    h_tel: '',
    h_email: '',
    h_predio: '',
    h_direccion: '',

    g_fecha: new Date().toLocaleDateString('es-MX'),
    g_cliente: cliente || "HERSHEYS DE MEXICO",
    g_dir: '', g_cont: '', g_tel: '', g_mail: '', g_depto: '', g_resp: '',
    empresa_nombre: '',
    empresa_direccion: '',
    empresa_representante: '',
    empresa_telefono: '',
    empresa_correo: '',
    empresa_especialista: '',
    
    cuartos: [ { table_ig: DEFAULT_IG_ROWS } ],
    motores_diesel: [ { md_tab_m: '', md_tab_s: '', md_bom_m: '', md_bom_s: '', md_mot_m: '', md_mot_s: '', table_md: DEFAULT_MD_ROWS } ],
    motores_electricos: [ { me_tab_m: '', me_tab_s: '', me_bom_m: '', me_bom_s: '', me_mot_m: '', me_mot_s: '', table_me: DEFAULT_ME_ROWS } ],
    bombas_jockey: [ { mj_tab_m: '', mj_tab_s: '', mj_bom_m: '', mj_bom_s: '', mj_mot_m: '', mj_mot_s: '', table_mj: DEFAULT_MJ_ROWS } ],
    
    evidencias: { evi1: null, evi2: null, evi3: null, evi4: null },
    
    f_cli_nombre: '', 
    f_eng_nombre: '',
    firma_cliente: null,
    firma_tecnico: null,
    g_observaciones: ''
  });

  const seleccionarLogoCliente = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permission.status !== 'granted') {
      Alert.alert('Permiso denegado', 'Se necesita acceso a la galeria.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.9,
      base64: false
    });

    if (!result.canceled) {
      const reportKey = resolveReportId();
      const storedUri = await persistPhotoUri(result.assets[0].uri, reportKey, 'logo_cliente');
      setFormData({ ...formData, logo_cliente: storedUri });
    }
  };

  const saveHydratedToLocal = async (report) => {
    try {
      if (!report || !report.id) return;
      const jsonValue = await AsyncStorage.getItem('mis_reportes');
      let historial = [];
      try {
        historial = jsonValue != null ? JSON.parse(jsonValue) : [];
      } catch (parseErr) {
        historial = [];
      }
      historial = sanitizeReportsForStorage(historial, { keepLocal: true });
      const optimized = optimizeReportForStorage(report, { keepLocal: true });
      const idx = historial.findIndex(r => String(r.id) === String(optimized.id));
      if (idx >= 0) historial[idx] = optimized;
      else historial.push(optimized);
      await saveWithSpaceCheck('mis_reportes', JSON.stringify(historial));
    } catch (e) {
      console.warn('saveHydratedToLocal failed (bombas)', e);
    }
  };

  // --- CORRECCIÓN 1: CARGA SEGURA DE DATOS ---
  useEffect(() => {
    const load = async () => {
      try {
        // Primero intenta cargar desde reporte temporal (cuando se edita/clona)
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
              g_fecha: new Date().toLocaleDateString('es-MX'),
              f_cli_nombre: '',
              f_eng_nombre: '',
              firma_cliente: null,
              firma_tecnico: null
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
                g_fecha: new Date().toLocaleDateString('es-MX'),
                f_cli_nombre: '',
                f_eng_nombre: '',
                firma_cliente: null,
                firma_tecnico: null
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

  // FUNCIÓN PARA TOMAR FOTO (SOLO CÁMARA)
  const takePhoto = async (targetType, arrayName = null, arrayIndex = null, tableKey = null, index = null) => {
    // Sin límite de imágenes: se permite agregar todas las necesarias
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
      const reportKey = resolveReportId();
      await savePhotoToGallery(result.assets[0].uri);
      const uri = await persistPhotoUri(result.assets[0].uri, reportKey, `${targetType || tableKey}_${index ?? 'evi'}_${arrayIndex ?? ''}`);
      
      if (arrayName && arrayIndex !== null && tableKey && index !== null) {
        const newArray = [...formData[arrayName]];
        const newObj = { ...newArray[arrayIndex] };
        const newTable = [...newObj[tableKey]];
        newTable[index].imagen = uri;
        newObj[tableKey] = newTable;
        newArray[arrayIndex] = newObj;
        setFormData({ ...formData, [arrayName]: newArray });
      } else if (targetType && targetType.startsWith('evi')) {
        setFormData({ ...formData, evidencias: { ...formData.evidencias, [targetType]: uri } });
      }
    }
  };

  const saveSignature = async (signature) => {
    const reportId = resolveReportId();
    const target = sigModal.target || 'firma';
    const stored = await persistSignatureDataUrl(signature, reportId, target);
    setFormData(prev => ({
      ...prev,
      [target === 'cliente' ? 'firma_cliente' : 'firma_tecnico']: stored
    }));
    setSigModal({ visible: false, target: null });
  };

  const resolveReportId = () => {
    if (modo === 'editar') {
      const raw = idOriginal ?? formData?.id;
      return raw ? raw : Date.now();
    }
    return Date.now();
  };

  // Función auxiliar para preparar el objeto a guardar
  const prepararDatosParaGuardar = () => {
    const nombreCliente = cliente || formData.g_cont || formData.g_depto;
    if (!nombreCliente) return null;

    return {
      ...formData,
      cliente: nombreCliente, 
      tipo: 'Bombas',
      g_fecha: formData.g_fecha,
      g_predio: formData.g_dir || formData.g_cliente || formData.g_depto,
      id: resolveReportId(), 
      ultimoCambio: new Date().toLocaleString()
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
      const jsonValue = await AsyncStorage.getItem('mis_reportes');
      let historial = [];
      try {
        historial = jsonValue != null ? JSON.parse(jsonValue) : [];
      } catch (parseErr) {
        historial = [];
      }
      historial = sanitizeReportsForStorage(historial, { keepLocal: true });

      // Optimizar el reporte antes de guardar (reduce tamaño drasticamente)
      const reporteOptimizado = optimizeReportForStorage(reporteAGuardar, { keepLocal: true });

      const reportId = resolveReportId();
      const index = historial.findIndex(r => String(r.id) === String(reportId));
      if (index !== -1) {
          historial[index] = reporteOptimizado;
      } else {
          historial.push(reporteOptimizado);
      }
      
      await saveWithSpaceCheck('mis_reportes', JSON.stringify(historial));
      try { await saveUserSnapshot(); } catch (e) {}
      enqueueBackup(reporteAGuardar).catch(e => console.warn('Backup queue failed (bombas):', e));
      Alert.alert("Guardado", "El reporte se guardó en el historial correctamente.");

    } catch (e) {
      Alert.alert("Error", "No se pudo guardar: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  const generarPDF = async () => {
    if (!formData.firma_cliente || !formData.firma_tecnico) {
      return Alert.alert("Faltan Firmas", "Por favor asegúrate de firmar (Cliente y Técnico) antes de generar el PDF.");
    }

    const reporteAGuardar = prepararDatosParaGuardar();
    if (!reporteAGuardar) {
      return Alert.alert("Faltan datos", "Para guardar, escribe al menos el nombre del cliente o el contacto.");
    }

    setSaving(true);

    try {
      const jsonValue = await AsyncStorage.getItem('mis_reportes');
      let historial = [];
      try {
        historial = jsonValue != null ? JSON.parse(jsonValue) : [];
      } catch (parseErr) {
        historial = [];
      }
      historial = sanitizeReportsForStorage(historial, { keepLocal: true });

      const reporteOptimizado = optimizeReportForStorage(reporteAGuardar, { keepLocal: true });

      const reportId = resolveReportId();
      const index = historial.findIndex(r => String(r.id) === String(reportId));
      if (index !== -1) {
          historial[index] = reporteOptimizado;
      } else {
          historial.push(reporteOptimizado);
      }

      await saveWithSpaceCheck('mis_reportes', JSON.stringify(historial));
      try { await saveUserSnapshot(); } catch (e) {}
      enqueueBackup(reporteAGuardar).catch(e => console.warn('Backup queue failed (bombas pdf):', e));

      const firmaCliente = await signatureUriToDataUrl(formData.firma_cliente);
      const firmaTecnico = await signatureUriToDataUrl(formData.firma_tecnico);

      const evidencias = {
        evi1: await imageUriToDataUrl(formData.evidencias?.evi1, { maxWidth: 700, compress: 0.45 }),
        evi2: await imageUriToDataUrl(formData.evidencias?.evi2, { maxWidth: 700, compress: 0.45 }),
        evi3: await imageUriToDataUrl(formData.evidencias?.evi3, { maxWidth: 700, compress: 0.45 }),
        evi4: await imageUriToDataUrl(formData.evidencias?.evi4, { maxWidth: 700, compress: 0.45 })
      };

      const convertTable = async (rows) => {
        const list = Array.isArray(rows) ? rows : [];
        const converted = [];
        for (const row of list) {
          converted.push({
            ...row,
            imagen: await imageUriToDataUrl(row?.imagen, { maxWidth: 700, compress: 0.45 })
          });
        }
        return converted;
      };

      // Las tablas ahora se convierten iterando sobre los arreglos en formData

      const clienteLogoData = formData.logo_cliente ? await imageUriToDataUrl(formData.logo_cliente, { maxWidth: 700, compress: 0.9 }) : null;

      const headerHtml = await buildExactPdfHeader({
        title: 'REPORTE DE MANTENIMIENTO CUARTO DE BOMBAS',
        logoCliente: clienteLogoData,
        sucursal: formData.sucursal,
        meta: `${formData.h_fecha || formData.g_fecha} | ${formData.h_cliente || formData.g_cliente || '-'}`,
        fields: {
          fecha: formData.h_fecha || formData.g_fecha,
          ejecutivo: formData.h_ejecutivo,
          emailEjecutivo: formData.h_email_ejecutivo,
          cel: formData.h_cel,
          telOficina: formData.h_tel_oficina,
          tecnico: formData.h_tecnico || formData.f_eng_nombre,
          sistema: formData.h_sistema,
          cliente: formData.h_cliente || formData.g_cliente,
          contacto: formData.h_contacto || formData.g_cont,
          departamentoSupervisor: formData.h_departamento_supervisor || formData.g_depto,
          telCliente: formData.h_tel || formData.g_tel,
          emailCliente: formData.h_email || formData.g_mail,
          predio: formData.h_predio,
          direccion: formData.h_direccion || formData.g_dir,
          horaInicio: formData.h_hora_inicio || '',
          horaFinal: formData.h_hora_final || '',
          responsableDepto: formData.h_responsable_depto || ''
        }
      });

      // IDs cuyas descripciones aparecen en color naranja en el reporte de referencia
      const ORANGE_IDS = new Set([
        'MD-6','MD-7','MD-8','MD-10','MD-11','MD-12','MD-13','MD-14',
        'MD-15','MD-17','MD-18','MD-20','MD-21','MD-22','MD-26','MD-27',
        'MD-29','MD-30','MD-31','MD-32','MD-33',
        'MJ-6','MJ-9','MJ-10','MJ-11','MJ-13','MJ-14','MJ-15',
        'MJ-17','MJ-18','MJ-19','MJ-20','MJ-21','MJ-22','MJ-23'
      ]);

      const renderTableRows = (rows) => rows.map((row) => {
        const estado = (row.estado || '').toUpperCase();
        const isSI = estado === 'SI';
        const isNO = estado === 'NO';
        const isNA = estado === 'N/A' || estado === 'NA';
        const imgHtml = row.imagen
          ? `<img src="${row.imagen}" style="width:100%;height:48px;object-fit:cover;display:block;margin:0;"/>`
          : '';
        return `
          <tr>
            <td class="td-id">${row.id || ''}</td>
            <td class="td-desc" style="color:#000;">${row.desc || ''}</td>
            <td class="td-check">${isSI ? 'X' : ''}</td>
            <td class="td-check">${isNO ? 'X' : ''}</td>
            <td class="td-check">${isNA ? 'X' : ''}</td>
            <td class="td-lectura">${row.lectura || ''}</td>
            <td class="td-img">${imgHtml}</td>
          </tr>`;
      }).join('');

      const obsLines = (formData.g_observaciones || '').trim();
      const obsHtml = obsLines
        ? obsLines.split('\n').map(l => `<div class="obs-line">${l || '&nbsp;'}</div>`).join('')
        : '<div class="obs-line">&nbsp;</div><div class="obs-line">&nbsp;</div><div class="obs-line">&nbsp;</div><div class="obs-line">&nbsp;</div>';

      const INSP_COLS = `<colgroup>
        <col style="width:7%"><col style="width:40%">
        <col style="width:6%"><col style="width:6%"><col style="width:6%">
        <col style="width:15%"><col style="width:20%">
      </colgroup>`;
      // Columnas de tabla de info (tablero/bomba/motor)
      const INFO_COLS = `<colgroup>
        <col style="width:30%"><col style="width:40%">
        <col style="width:10%"><col style="width:20%">
      </colgroup>`;

      // Fila de encabezado de sección de inspección
      const inspHdr = (label) => `<tr class="insp-section-hdr">
        <td colspan="2" style="text-align:center;">${label}</td>
        <td>SI</td><td>NO</td><td>N/A</td><td>Lectura</td><td>Imagen</td>
      </tr>`;

      // Tabla de info con encabezado azul + filas de marca/serie
      const infoTable = (hdr, tm, ts, bm, bs, mm, ms) => `
        <table class="info-table" style="margin-bottom:0; border-bottom: none;">
          ${INFO_COLS}
          <tr class="insp-section-hdr"><td colspan="4" style="text-align:center;">${hdr}</td></tr>
        </table>
        <table class="info-table" style="margin-bottom:4px; border-top: none;">
          ${INFO_COLS}
          <tr>
            <td class="info-lbl" style="text-align:right;">Marca y modelo del tablero:</td>
            <td class="info-val">${tm || ''}</td>
            <td class="info-slbl" style="text-align:right;">serie:</td>
            <td class="info-sval">${ts || ''}</td>
          </tr>
          <tr>
            <td class="info-lbl" style="text-align:right;">Marca y modelo de la bomba:</td>
            <td class="info-val">${bm || ''}</td>
            <td class="info-slbl" style="text-align:right;">serie:</td>
            <td class="info-sval">${bs || ''}</td>
          </tr>
          <tr>
            <td class="info-lbl" style="text-align:right;">Marca y modelo del motor:</td>
            <td class="info-val">${mm || ''}</td>
            <td class="info-slbl" style="text-align:right;">serie:</td>
            <td class="info-sval">${ms || ''}</td>
          </tr>
        </table>`;

      const htmlContent = `
      <html>
        <head>
          <meta charset="utf-8"/>
          <style>
            ${PDF_PRINT_SAFE_STYLES}
            body { font-family: Calibri, 'Segoe UI', Arial, sans-serif; font-size: 10px; color: #111; margin: 0; padding: 0;
                   -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            ${PDF_EXACT_HEADER_STYLES}

            /* ── Page break ── */
            .pg { page-break-before: always; break-before: page; }

            /* ── Inspection tables ── */
            .insp-table { width: 100%; border-collapse: collapse; font-size: 10px; border: 4px solid #000; margin-bottom: 4px; }
            .insp-table td { border: 1px solid #000; padding: 10px 4px; vertical-align: middle; }
            .insp-section-hdr td { background-color: #0070c0 !important; color: #fff !important;
              font-weight: bold; border: 1px solid #000 !important;
              text-align: center; padding: 8px 4px; }
            .sig-cell { border: none; padding: 0px; height: 60px; }
            .td-id  { text-align: center; font-weight: bold; font-size: 9px; white-space: nowrap; }
            .td-desc { text-align: left; line-height: 1.35; padding-left: 6px; }
            .td-check { text-align: center; font-weight: bold; font-style: italic; font-size: 13px; }
            .td-lectura { text-align: center; font-weight: bold; }
            .td-img { text-align: center; padding: 0 !important; vertical-align: middle; }

            /* ── Info tables ── */
            .info-table { width: 100%; border-collapse: collapse; font-size: 10px; border: 4px solid #000; margin-bottom: 4px;}
            .info-table td { border: 1px solid #000; padding: 6px 6px; vertical-align: middle; }
            .info-lbl  { background-color: #fff !important; font-weight: normal; color: #000; }
            .info-val  { background-color: #fff !important; text-align: center; }
            .info-slbl { background-color: #fff !important; font-weight: normal; color: #000; }
            .info-sval { background-color: #fff !important; text-align: center; }

            /* ── Observations ── */
            .obs-box   { border: 2px solid #000; padding: 6px 8px; margin: 0; min-height: 52px; border-top: none; }
            .obs-label { font-size: 10px; color: #000; margin-bottom: 4px; font-weight: bold; }
            .obs-line  { border-bottom: 1px solid #000; min-height: 18px; line-height: 18px;
                         padding-bottom: 2px; margin-bottom: 2px; font-size: 10px; font-weight: bold; text-align: left; }

            /* ── Fotos ── */
            .fotos-box   { border: 2px solid #000; padding: 6px 8px; margin: 0; border-top: none; text-align: center; }
            .fotos-title { text-align: center; font-size: 10px; color: #000; font-weight: bold; margin: 0 0 5px 0; text-transform: uppercase; }
            .foto-grid   { width: 100%; border-collapse: collapse; margin: 0; }
            .foto-grid td{ width: 33.3%; text-align: center; vertical-align: middle; padding: 5px; }
            .foto-img    { width: 100%; max-height: 120px; object-fit: cover; }

            /* ── NFPA footer ── */
            .nfpa-footer { text-align: center; font-weight: bold; font-size: 10px;
                           border: 2px solid #000; padding: 6px; margin: 0; border-top: none; }

            /* ── Signatures ── */
            .sig-outer { width: 100%; border-collapse: collapse; margin: 0; font-size: 10px; border: 2px solid #000; border-top: none; }
            .sig-outer td { border: 1px solid #000; padding: 4px; vertical-align: middle; text-align: center; }
            .sig-role  { font-weight: normal; color: #000; text-align: right; padding-right: 10px; }
            .sig-img   { display: inline-block; margin: 0 auto; height: 80px; max-width: 200px; object-fit: contain; }
          </style>
        </head>
        <body>

          ${headerHtml}
          ${(await Promise.all(formData.cuartos.map(async (c, i) => {
            const t = await convertTable(c.table_ig);
            return `
              ${i > 0 ? '<div class="pg"></div>' : ''}
              <table class="insp-table" style="margin-top:4px; page-break-inside: auto;">
                ${INSP_COLS}
                <thead>${inspHdr(`Inspección General Cuarto de bombas #${i+1}`)}</thead>
                <tbody>${renderTableRows(t)}</tbody>
              </table>
            `;
          }))).join('')}

          ${(await Promise.all(formData.motores_diesel.map(async (m, i) => {
            const t = await convertTable(m.table_md);
            return `
              <div class="pg"></div>
              ${infoTable(`Información General Motor Diésel #${i+1}`, m.md_tab_m||'', m.md_tab_s||'', m.md_bom_m||'', m.md_bom_s||'', m.md_mot_m||'', m.md_mot_s||'')}
              <table class="insp-table" style="page-break-inside: auto;">
                ${INSP_COLS}
                <thead>${inspHdr(`Inspección Motor Diésel #${i+1}`)}</thead>
                <tbody>${renderTableRows(t)}</tbody>
              </table>
            `;
          }))).join('')}

          ${(await Promise.all(formData.motores_electricos.map(async (m, i) => {
            const t = await convertTable(m.table_me);
            return `
              <div class="pg"></div>
              ${infoTable(`Información General Motor Eléctrico #${i+1}`, m.me_tab_m||'', m.me_tab_s||'', m.me_bom_m||'', m.me_bom_s||'', m.me_mot_m||'', m.me_mot_s||'')}
              <table class="insp-table" style="page-break-inside: auto;">
                ${INSP_COLS}
                <thead>${inspHdr(`Inspección Motor Eléctrico #${i+1}`)}</thead>
                <tbody>${renderTableRows(t)}</tbody>
              </table>
            `;
          }))).join('')}

          ${(await Promise.all(formData.bombas_jockey.map(async (m, i) => {
            const t = await convertTable(m.table_mj);
            return `
              <div class="pg"></div>
              ${infoTable(`Información General Bomba Jockey #${i+1}`, m.mj_tab_m||'', m.mj_tab_s||'', m.mj_bom_m||'', m.mj_bom_s||'', m.mj_mot_m||'', m.mj_mot_s||'')}
              <table class="insp-table" style="margin-bottom:0; page-break-inside: auto;">
                ${INSP_COLS}
                <thead>${inspHdr(`Inspección Bomba Jockey #${i+1}`)}</thead>
                <tbody>${renderTableRows(t)}</tbody>
              </table>
            `;
          }))).join('')}

          <!-- Observaciones -->
          <div class="obs-box">
            <div class="obs-label">Especificar claramente los puntos donde la respuesta fue NO y se deba considerar una condición insegura o que el sistema no funciona correctamente:</div>
            <div>${obsHtml}</div>
          </div>

          <!-- Fotos de tableros -->
          <div class="fotos-box">
            <table class="foto-grid">
              <tr>
                <td>${evidencias.evi1 ? `<img src="${evidencias.evi1}" class="foto-img"/>` : '&nbsp;'}</td>
                <td>
                  <div class="fotos-title">fotos de los tableros al final del servicio</div>
                </td>
                <td>${evidencias.evi2 ? `<img src="${evidencias.evi2}" class="foto-img"/>` : '&nbsp;'}</td>
              </tr>
            </table>
          </div>

          <!-- Nota NFPA -->
          <div class="nfpa-footer">ESTAS PRUEBAS FUERON REALIZADAS DE ACUERDO A LOS ESTÁNDARES NFPA; ASI COMO DEL FABRICANTE.</div>

          <!-- Firmas -->
          <table class="sig-outer">
            <colgroup><col style="width:30%"><col style="width:40%"><col style="width:30%"></colgroup>
            <tr>
              <td rowspan="2" style="text-align:right; padding-right:10px;">por parte de cliente recibe:</td>
              <td style="text-align:center; font-weight:bold; height:25px; border-bottom:1px solid #000;">${formData.f_cli_nombre || ''}</td>
              <td style="text-align:center; height:25px; border-bottom:1px solid #000;">
                ${firmaCliente ? `<img src="${firmaCliente}" class="sig-img"/>` : ''}
              </td>
            </tr>
            <tr>
              <td style="text-align:center; font-weight:bold; font-size:9px;">Nombre</td>
              <td style="text-align:center; font-weight:bold; font-size:9px;">firma</td>
            </tr>
            <tr>
              <td rowspan="2" style="text-align:right; padding-right:10px;">por parte de Fire Engineers:</td>
              <td style="text-align:center; font-weight:bold; height:25px; border-bottom:1px solid #000;">${formData.f_eng_nombre || ''}</td>
              <td style="text-align:center; height:25px; border-bottom:1px solid #000;">
                ${firmaTecnico ? `<img src="${firmaTecnico}" class="sig-img"/>` : ''}
              </td>
            </tr>
            <tr>
              <td style="text-align:center; font-weight:bold; font-size:9px;">Nombre</td>
              <td style="text-align:center; font-weight:bold; font-size:9px;">firma</td>
            </tr>
          </table>

        </body>
      </html>
      `;

      const { uri } = await printHtmlToPdf({ html: htmlContent, fileName: `bombas-${formData.id || Date.now()}.pdf` });
      await sharePdfUri(uri);
      Alert.alert("Listo", "PDF compartido correctamente");
    } catch (error) {
      Alert.alert("Error", error.message);
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
          const jsonValue = await AsyncStorage.getItem('mis_reportes');
          let historial = [];
          try { historial = jsonValue ? JSON.parse(jsonValue) : []; } catch (_) { historial = []; }
          historial = sanitizeReportsForStorage(historial, { keepLocal: true });
          const updatedReport = optimizeReportForStorage(result.report, { keepLocal: true });
          const reportId = resolveReportId();
          const idx = historial.findIndex(r => String(r.id) === String(reportId));
          if (idx >= 0) historial[idx] = updatedReport;
          else historial.push(updatedReport);
          await saveWithSpaceCheck('mis_reportes', JSON.stringify(historial));
        } catch (saveErr) {
          console.warn('reSubirFotos: failed to update local history', saveErr);
        }
      }

      if (total === 0) {
        Alert.alert("Listo", "No se encontraron fotos locales para subir.");
      } else if (remaining > 0) {
        Alert.alert("Parcial", `Fotos subidas: ${uploaded} de ${total}.\nQuedan ${remaining} fotos locales.`);
      } else {
        Alert.alert("Listo", `\u2705 Fotos subidas: ${uploaded} de ${total}. Datos sincronizados con Supabase.`);
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

  const getTablePage = (arrayName, arrayIndex, tableKey) => {
    const key = `${arrayName}_${arrayIndex}_${tableKey}`;
    return tablePages[key] || 1;
  };
  
  const getVisibleTableRows = (arrayName, arrayIndex, tableKey) => {
    const arr = formData[arrayName] || [];
    if (!arr[arrayIndex]) return [];
    return (arr[arrayIndex][tableKey] || []).slice(0, getTablePage(arrayName, arrayIndex, tableKey) * TABLE_PAGE_SIZE);
  };
  
  const renderTable = (arrayName, arrayIndex, tableKey, addLabel, options = {}) => {
    const { fixed = false, header = 'Inspeccion General' } = options;
    const visibleRows = getVisibleTableRows(arrayName, arrayIndex, tableKey);
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
          <Text style={[styles.hText, {flex: 0.5}]}>ID</Text>
          <Text style={[styles.hText, {flex: 1.5}]}>{header}</Text>
          <Text style={[styles.hText, {flex: 0.8}]}>Estado</Text>
          <Text style={[styles.hText, {flex: 0.8}]}>Lectura</Text>
          <Text style={[styles.hText, {flex: 1.2}]}>Imagen</Text>
        </View>
        {rowsWithAdd.map((item, index) => {
          if (item.__add) return null; // Add logic if not fixed
          
          const fullTable = formData[arrayName][arrayIndex][tableKey];
          const realIndex = fullTable.indexOf(item);
          const idx = realIndex >= 0 ? realIndex : index;
          return (
            <View key={`row-${tableKey}-${idx}`} style={styles.tableRow}>
              <TextInput
                style={[styles.cell, {flex: 0.5}, fixed && styles.cellLocked]}
                value={item.id}
                editable={!fixed}
                onChangeText={t => {
                  const newArray = [...formData[arrayName]];
                  newArray[arrayIndex][tableKey][idx].id = t;
                  setFormData({...formData, [arrayName]: newArray});
                }}
                {...BASE_INPUT_PROPS}
              />
              <TextInput
                style={[styles.cell, {flex: 1.5}, fixed && styles.cellLocked, fixed && styles.cellQuestion]}
                value={item.desc}
                editable={!fixed}
                multiline={fixed}
                onChangeText={t => {
                  const newArray = [...formData[arrayName]];
                  newArray[arrayIndex][tableKey][idx].desc = t;
                  setFormData({...formData, [arrayName]: newArray});
                }}
                {...BASE_INPUT_PROPS}
              />
              <TouchableOpacity
                style={[
                  styles.pickerEstado,
                  item.estado === 'SI'  ? styles.estadoSI :
                  item.estado === 'NO'  ? styles.estadoNO :
                  item.estado === 'N/A' ? styles.estadoNA : styles.estadoDefault
                ]}
                onPress={() => {
                  const newArray = [...formData[arrayName]];
                  newArray[arrayIndex][tableKey][idx].estado = item.estado === 'SI' ? 'NO' : item.estado === 'NO' ? 'N/A' : 'SI';
                  setFormData({...formData, [arrayName]: newArray});
                }}>
                  <Text style={{textAlign: 'center', fontSize: 12, fontWeight:'bold', color: '#fff'}}>{item.estado || 'SI'} ▾</Text>
              </TouchableOpacity>
              <TextInput
                style={[styles.cell, {flex: 0.8}]}
                value={item.lectura}
                onChangeText={t => {
                  const newArray = [...formData[arrayName]];
                  newArray[arrayIndex][tableKey][idx].lectura = t;
                  setFormData({...formData, [arrayName]: newArray});
                }}
                {...BASE_INPUT_PROPS}
              />
              <TouchableOpacity style={styles.imageCell} onPress={() => takePhoto(null, arrayName, arrayIndex, tableKey, idx)}>
                {item.imagen ? (
                  <Image source={{ uri: item.imagen }} style={styles.imagePreview} onError={() => {}} />
                ) : (
                  <Text style={styles.imagePlaceholderText}>FOTO</Text>
                )}
              </TouchableOpacity>
            </View>
          );
        })}
      </View>
    );
  };

  const addDevice = (arrayName, defaultData) => {
    setFormData(prev => ({
      ...prev,
      [arrayName]: [...prev[arrayName], defaultData]
    }));
  };

  const removeDevice = (arrayName, index) => {
    Alert.alert("Eliminar", "¿Estás seguro de eliminar este dispositivo?", [
      { text: "Cancelar", style: "cancel" },
      { text: "Eliminar", onPress: () => {
          setFormData(prev => {
            const arr = [...prev[arrayName]];
            arr.splice(index, 1);
            return { ...prev, [arrayName]: arr };
          });
        }
      }
    ]);
  };

  if (loading) return <ActivityIndicator size="large" color={BRAND.colors.accentStrong} style={{flex:1}} />;

  return (
    <Container
      {...containerProps}
      style={[styles.container, { paddingBottom: insets.bottom }]}
    >
      <View style={styles.headerRed}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.btnBack}>
            <Text style={styles.btnBackText}>← ATRÁS</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Reporte: {cliente || 'Cuarto de Bombas'}</Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsScroll}>
          <TabButton title="GENERAL" /><TabButton title="CUARTO" /><TabButton title="DIESEL" /><TabButton title="ELÉCTRICO" /><TabButton title="JOCKEY" /><TabButton title="FIRMAS" />
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

            <Text style={styles.cardTitle}>Logo del cliente (opcional)</Text>
            <TouchableOpacity style={styles.logoPicker} onPress={seleccionarLogoCliente}>
              {formData.logo_cliente
                ? <Image source={{ uri: formData.logo_cliente }} style={styles.logoPreview} resizeMode="contain" onError={() => { }} />
                : <Text style={styles.logoPickerText}>TOQUE PARA CARGAR LOGO DEL CLIENTE</Text>}
            </TouchableOpacity>

            <Text style={styles.cardTitle}>Datos del cliente</Text>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}><InputRow label="Cliente / razón social" val={formData.h_cliente || ''} setVal={t => setFormData({ ...formData, h_cliente: t, g_cliente: t, cliente_nombre: t })} /></View>
              <View style={{ flex: 1 }}><InputRow label="Contacto del cliente" val={formData.h_contacto || ''} setVal={t => setFormData({ ...formData, h_contacto: t, g_cont: t, cliente_contacto: t })} /></View>
            </View>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}><InputRow label="Teléfono del cliente" val={formData.h_tel || ''} setVal={t => setFormData({ ...formData, h_tel: t, g_tel: t, cliente_telefono: t })} kbd="phone-pad" /></View>
              <View style={{ flex: 1 }}><InputRow label="Correo del cliente" val={formData.h_email || ''} setVal={t => setFormData({ ...formData, h_email: t, g_mail: t, cliente_correo: t })} kbd="email-address" /></View>
            </View>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}><InputRow label="Predio / ubicación del cliente" val={formData.h_predio || ''} setVal={t => setFormData({ ...formData, h_predio: t, predio: t })} /></View>
              <View style={{ flex: 1 }}><InputRow label="Dirección del sitio" val={formData.h_direccion || ''} setVal={t => setFormData({ ...formData, h_direccion: t, g_dir: t, cliente_direccion: t })} /></View>
            </View>

            <Text style={styles.cardTitle}>Datos de la empresa que presta el servicio</Text>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}><InputRow label="Ejecutivo / representante" val={formData.h_ejecutivo || formData.empresa_representante || ''} setVal={t => setFormData({ ...formData, h_ejecutivo: t, empresa_representante: t })} /></View>
              <View style={{ flex: 1 }}><InputRow label="E-mail del ejecutivo" val={formData.h_email_ejecutivo || formData.empresa_correo || ''} setVal={t => setFormData({ ...formData, h_email_ejecutivo: t, empresa_correo: t })} kbd="email-address" /></View>
            </View>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}><InputRow label="Celular de la empresa" val={formData.h_cel || ''} setVal={t => setFormData({ ...formData, h_cel: t })} kbd="phone-pad" /></View>
              <View style={{ flex: 1 }}><InputRow label="Teléfono de oficina" val={formData.h_tel_oficina || formData.empresa_telefono || ''} setVal={t => setFormData({ ...formData, h_tel_oficina: t, empresa_telefono: t })} kbd="phone-pad" /></View>
            </View>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}><InputRow label="Técnico" val={formData.h_tecnico || formData.empresa_especialista || ''} setVal={t => setFormData({ ...formData, h_tecnico: t, f_eng_nombre: t, empresa_especialista: t })} /></View>
              <View style={{ flex: 1 }}><InputRow label="Departamento supervisor" val={formData.h_departamento_supervisor || formData.aviso_departamento || ''} setVal={t => setFormData({ ...formData, h_departamento_supervisor: t, aviso_departamento: t })} /></View>
            </View>

            <Text style={styles.cardTitle}>Datos del servicio</Text>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}><InputRow label="Fecha" val={formData.h_fecha || ''} setVal={t => setFormData({ ...formData, h_fecha: t, g_fecha: t, fecha: t })} /></View>
              <View style={{ flex: 1 }}><InputRow label="Sistema" val={formData.h_sistema || 'MANTENIMIENTO A CUARTO DE BOMBAS'} setVal={t => setFormData({ ...formData, h_sistema: t })} /></View>
            </View>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}><InputRow label="Hora de inicio" val={formData.h_hora_inicio || ''} setVal={t => setFormData({ ...formData, h_hora_inicio: t })} /></View>
              <View style={{ flex: 1 }}><InputRow label="Hora final" val={formData.h_hora_final || ''} setVal={t => setFormData({ ...formData, h_hora_final: t })} /></View>
            </View>
            <InputRow label="Nombre del Responsable del departamento" val={formData.h_responsable_depto || formData.aviso_responsable || ''} setVal={t => setFormData({ ...formData, h_responsable_depto: t, aviso_responsable: t })} />
          </View>
        )}

        {activeTab === 'CUARTO' && (
          <View>
            {formData.cuartos.map((cuarto, idx) => (
              <View key={`cuarto-${idx}`} style={styles.card}>
                <View style={[styles.row, { alignItems: 'center', marginBottom: 10 }]}>
                  <Text style={[styles.cardTitle, { marginBottom: 0 }]}>2. INSPECCIÓN CUARTO DE BOMBAS #{idx + 1}</Text>
                  {formData.cuartos.length > 1 && (
                    <TouchableOpacity onPress={() => removeDevice('cuartos', idx)}>
                      <Text style={{ color: 'red', fontSize: 12, fontWeight: 'bold' }}>ELIMINAR</Text>
                    </TouchableOpacity>
                  )}
                </View>
                {renderTable('cuartos', idx, 'table_ig', 'Inspección General Cuarto de bombas', { fixed: true, header: 'Inspeccion General Cuarto de bombas' })}
              </View>
            ))}
            <TouchableOpacity style={styles.btnAdd} onPress={() => addDevice('cuartos', { table_ig: DEFAULT_IG_ROWS })}>
              <Text style={styles.btnAddText}>+ AGREGAR CUARTO DE BOMBAS</Text>
            </TouchableOpacity>
          </View>
        )}

        {activeTab === 'DIESEL' && (
          <View>
            {formData.motores_diesel.map((motor, idx) => (
              <View key={`md-${idx}`} style={{ marginBottom: 20 }}>
                <View style={styles.card}>
                  <View style={[styles.row, { alignItems: 'center', marginBottom: 10 }]}>
                    <Text style={[styles.cardTitle, { marginBottom: 0 }]}>3. INFORMACION GENERAL MOTOR DIESEL #{idx + 1}</Text>
                    {formData.motores_diesel.length > 1 && (
                      <TouchableOpacity onPress={() => removeDevice('motores_diesel', idx)}>
                        <Text style={{ color: 'red', fontSize: 12, fontWeight: 'bold' }}>ELIMINAR</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                  <View style={styles.row}>
                    <InputField label="Marca y modelo del tablero" value={motor.md_tab_m} onChangeText={(t) => {
                      const arr = [...formData.motores_diesel]; arr[idx].md_tab_m = t; setFormData({ ...formData, motores_diesel: arr });
                    }} />
                    <InputField label="Serie" value={motor.md_tab_s} onChangeText={(t) => {
                      const arr = [...formData.motores_diesel]; arr[idx].md_tab_s = t; setFormData({ ...formData, motores_diesel: arr });
                    }} />
                  </View>
                  <View style={styles.row}>
                    <InputField label="Marca y modelo de la bomba" value={motor.md_bom_m} onChangeText={(t) => {
                      const arr = [...formData.motores_diesel]; arr[idx].md_bom_m = t; setFormData({ ...formData, motores_diesel: arr });
                    }} />
                    <InputField label="Serie" value={motor.md_bom_s} onChangeText={(t) => {
                      const arr = [...formData.motores_diesel]; arr[idx].md_bom_s = t; setFormData({ ...formData, motores_diesel: arr });
                    }} />
                  </View>
                  <View style={styles.row}>
                    <InputField label="Marca y modelo del motor" value={motor.md_mot_m} onChangeText={(t) => {
                      const arr = [...formData.motores_diesel]; arr[idx].md_mot_m = t; setFormData({ ...formData, motores_diesel: arr });
                    }} />
                    <InputField label="Serie" value={motor.md_mot_s} onChangeText={(t) => {
                      const arr = [...formData.motores_diesel]; arr[idx].md_mot_s = t; setFormData({ ...formData, motores_diesel: arr });
                    }} />
                  </View>
                </View>
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>4. MOTOR DIESEL #{idx + 1}: INSPECCION</Text>
                  {renderTable('motores_diesel', idx, 'table_md', '', { fixed: true, header: 'Inspeccion Motor Diesel' })}
                </View>
              </View>
            ))}
            <TouchableOpacity style={styles.btnAdd} onPress={() => addDevice('motores_diesel', { md_tab_m: '', md_tab_s: '', md_bom_m: '', md_bom_s: '', md_mot_m: '', md_mot_s: '', table_md: DEFAULT_MD_ROWS })}>
              <Text style={styles.btnAddText}>+ AGREGAR MOTOR DIÉSEL</Text>
            </TouchableOpacity>
          </View>
        )}

        {activeTab === 'ELÉCTRICO' && (
          <View>
            {formData.motores_electricos.map((motor, idx) => (
              <View key={`me-${idx}`} style={{ marginBottom: 20 }}>
                <View style={styles.card}>
                  <View style={[styles.row, { alignItems: 'center', marginBottom: 10 }]}>
                    <Text style={[styles.cardTitle, { marginBottom: 0 }]}>4A. INFORMACION GENERAL MOTOR ELECTRICO #{idx + 1}</Text>
                    {formData.motores_electricos.length > 1 && (
                      <TouchableOpacity onPress={() => removeDevice('motores_electricos', idx)}>
                        <Text style={{ color: 'red', fontSize: 12, fontWeight: 'bold' }}>ELIMINAR</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                  <View style={styles.row}>
                    <InputField label="Marca y modelo del tablero" value={motor.me_tab_m} onChangeText={(t) => {
                      const arr = [...formData.motores_electricos]; arr[idx].me_tab_m = t; setFormData({ ...formData, motores_electricos: arr });
                    }} />
                    <InputField label="Serie" value={motor.me_tab_s} onChangeText={(t) => {
                      const arr = [...formData.motores_electricos]; arr[idx].me_tab_s = t; setFormData({ ...formData, motores_electricos: arr });
                    }} />
                  </View>
                  <View style={styles.row}>
                    <InputField label="Marca y modelo de la bomba" value={motor.me_bom_m} onChangeText={(t) => {
                      const arr = [...formData.motores_electricos]; arr[idx].me_bom_m = t; setFormData({ ...formData, motores_electricos: arr });
                    }} />
                    <InputField label="Serie" value={motor.me_bom_s} onChangeText={(t) => {
                      const arr = [...formData.motores_electricos]; arr[idx].me_bom_s = t; setFormData({ ...formData, motores_electricos: arr });
                    }} />
                  </View>
                  <View style={styles.row}>
                    <InputField label="Marca y modelo del motor" value={motor.me_mot_m} onChangeText={(t) => {
                      const arr = [...formData.motores_electricos]; arr[idx].me_mot_m = t; setFormData({ ...formData, motores_electricos: arr });
                    }} />
                    <InputField label="Serie" value={motor.me_mot_s} onChangeText={(t) => {
                      const arr = [...formData.motores_electricos]; arr[idx].me_mot_s = t; setFormData({ ...formData, motores_electricos: arr });
                    }} />
                  </View>
                </View>
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>4B. MOTOR ELECTRICO #{idx + 1}: INSPECCION</Text>
                  {renderTable('motores_electricos', idx, 'table_me', '', { fixed: true, header: 'Inspeccion Motor Electrico' })}
                </View>
              </View>
            ))}
            <TouchableOpacity style={styles.btnAdd} onPress={() => addDevice('motores_electricos', { me_tab_m: '', me_tab_s: '', me_bom_m: '', me_bom_s: '', me_mot_m: '', me_mot_s: '', table_me: DEFAULT_ME_ROWS })}>
              <Text style={styles.btnAddText}>+ AGREGAR MOTOR ELÉCTRICO</Text>
            </TouchableOpacity>
          </View>
        )}

        {activeTab === 'JOCKEY' && (
          <View>
            {formData.bombas_jockey.map((motor, idx) => (
              <View key={`mj-${idx}`} style={{ marginBottom: 20 }}>
                <View style={styles.card}>
                  <View style={[styles.row, { alignItems: 'center', marginBottom: 10 }]}>
                    <Text style={[styles.cardTitle, { marginBottom: 0 }]}>5. INFORMACION GENERAL BOMBA JOCKEY #{idx + 1}</Text>
                    {formData.bombas_jockey.length > 1 && (
                      <TouchableOpacity onPress={() => removeDevice('bombas_jockey', idx)}>
                        <Text style={{ color: 'red', fontSize: 12, fontWeight: 'bold' }}>ELIMINAR</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                  <View style={styles.row}>
                    <InputField label="Marca y modelo del tablero" value={motor.mj_tab_m} onChangeText={(t) => {
                      const arr = [...formData.bombas_jockey]; arr[idx].mj_tab_m = t; setFormData({ ...formData, bombas_jockey: arr });
                    }} />
                    <InputField label="Serie" value={motor.mj_tab_s} onChangeText={(t) => {
                      const arr = [...formData.bombas_jockey]; arr[idx].mj_tab_s = t; setFormData({ ...formData, bombas_jockey: arr });
                    }} />
                  </View>
                  <View style={styles.row}>
                    <InputField label="Marca y modelo de la bomba" value={motor.mj_bom_m} onChangeText={(t) => {
                      const arr = [...formData.bombas_jockey]; arr[idx].mj_bom_m = t; setFormData({ ...formData, bombas_jockey: arr });
                    }} />
                    <InputField label="Serie" value={motor.mj_bom_s} onChangeText={(t) => {
                      const arr = [...formData.bombas_jockey]; arr[idx].mj_bom_s = t; setFormData({ ...formData, bombas_jockey: arr });
                    }} />
                  </View>
                  <View style={styles.row}>
                    <InputField label="Marca y modelo del motor" value={motor.mj_mot_m} onChangeText={(t) => {
                      const arr = [...formData.bombas_jockey]; arr[idx].mj_mot_m = t; setFormData({ ...formData, bombas_jockey: arr });
                    }} />
                    <InputField label="Serie" value={motor.mj_mot_s} onChangeText={(t) => {
                      const arr = [...formData.bombas_jockey]; arr[idx].mj_mot_s = t; setFormData({ ...formData, bombas_jockey: arr });
                    }} />
                  </View>
                </View>
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>6. BOMBA JOCKEY #{idx + 1}: INSPECCION</Text>
                  {renderTable('bombas_jockey', idx, 'table_mj', '', { fixed: true, header: 'Inspeccion Bomba Jockey' })}
                </View>
              </View>
            ))}
            <TouchableOpacity style={styles.btnAdd} onPress={() => addDevice('bombas_jockey', { mj_tab_m: '', mj_tab_s: '', mj_bom_m: '', mj_bom_s: '', mj_mot_m: '', mj_mot_s: '', table_mj: DEFAULT_MJ_ROWS })}>
              <Text style={styles.btnAddText}>+ AGREGAR BOMBA JOCKEY</Text>
            </TouchableOpacity>
          </View>
        )}

        {activeTab === 'FIRMAS' && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>7. GALERÍA DE EVIDENCIAS Y FIRMAS</Text>
            
            {/* EVIDENCIAS FOTOGRÁFICAS CON PROTECCIÓN (?) */}
            <View style={styles.row}>
                <TouchableOpacity style={styles.eviBtn} onPress={() => takePhoto('evi1')}>
                    {formData.evidencias?.evi1 ? (
                      <Image source={{ uri: formData.evidencias.evi1 }} style={styles.eviPreview} onError={() => {}} />
                    ) : (
                      <Text style={styles.eviText}>TOMAR EVI 1</Text>
                    )}
                </TouchableOpacity>
                <TouchableOpacity style={styles.eviBtn} onPress={() => takePhoto('evi2')}>
                    {formData.evidencias?.evi2 ? (
                      <Image source={{ uri: formData.evidencias.evi2 }} style={styles.eviPreview} onError={() => {}} />
                    ) : (
                      <Text style={styles.eviText}>TOMAR EVI 2</Text>
                    )}
                </TouchableOpacity>
            </View>
            <View style={styles.row}>
                <TouchableOpacity style={styles.eviBtn} onPress={() => takePhoto('evi3')}>
                    {formData.evidencias?.evi3 ? (
                      <Image source={{ uri: formData.evidencias.evi3 }} style={styles.eviPreview} onError={() => {}} />
                    ) : (
                      <Text style={styles.eviText}>TOMAR EVI 3</Text>
                    )}
                </TouchableOpacity>
                <TouchableOpacity style={styles.eviBtn} onPress={() => takePhoto('evi4')}>
                    {formData.evidencias?.evi4 ? (
                      <Image source={{ uri: formData.evidencias.evi4 }} style={styles.eviPreview} onError={() => {}} />
                    ) : (
                      <Text style={styles.eviText}>TOMAR EVI 4</Text>
                    )}
                </TouchableOpacity>
            </View>

            <View style={{marginVertical: 10}}>
              <Text style={[styles.label, {marginBottom: 4}]}>Observaciones / Condiciones inseguras (NO):</Text>
              <TextInput
                style={[styles.input, {height: 80, textAlignVertical: 'top'}]}
                placeholder="Especificar puntos donde la respuesta fue NO..."
                placeholderTextColor={BRAND.colors.textMuted}
                value={formData.g_observaciones}
                onChangeText={t => setFormData(prev => ({...prev, g_observaciones: t}))}
                multiline
                {...BASE_INPUT_PROPS}
              />
            </View>

            <View style={styles.firmasContainer}>
              <Text style={styles.firmasHeader}>Firmas Digitales</Text>
              
              {/* FIRMA CLIENTE */}
              <Text style={styles.signatureLabel}>Firma del Cliente:</Text>
              <TextInput
                style={styles.inputFirmaNombre}
                placeholder="Nombre de quien firma"
                placeholderTextColor={BRAND.colors.textMuted}
                value={formData.f_cli_nombre}
                onChangeText={t => setFormData({...formData, f_cli_nombre: t})}
                {...BASE_INPUT_PROPS}
              />
              <TouchableOpacity style={styles.signatureBox} onPress={() => setSigModal({visible: true, target: 'cliente'})}>
                {formData.firma_cliente ? <Text style={styles.signedText}>CLIENTE HA FIRMADO ✓</Text> : <Text style={styles.signPrompt}>Toca para firmar (Cliente)</Text>}
              </TouchableOpacity>

              {/* FIRMA TÉCNICO */}
              <Text style={styles.signatureLabel}>Firma Técnico (Fire Engineers):</Text>
              <TextInput
                style={styles.inputFirmaNombre}
                placeholder="Nombre Técnico"
                placeholderTextColor={BRAND.colors.textMuted}
                value={formData.f_eng_nombre}
                onChangeText={t => setFormData({...formData, f_eng_nombre: t})}
                {...BASE_INPUT_PROPS}
              />
              <TouchableOpacity style={styles.signatureBox} onPress={() => setSigModal({visible: true, target: 'tecnico'})}>
                {formData.firma_tecnico ? <Text style={styles.signedText}>TÉCNICO HA FIRMADO ✓</Text> : <Text style={styles.signPrompt}>Toca para firmar (Técnico)</Text>}
              </TouchableOpacity>

              <TouchableOpacity style={styles.btnSecondary} onPress={reSubirFotos} disabled={saving}>
                <Text style={styles.btnSecondaryText}>{saving ? "RE-SUBIENDO..." : "RE-SUBIR FOTOS"}</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.btnSecondary} onPress={guardarEnHistorial} disabled={saving}>
                <Text style={styles.btnSecondaryText}>{saving ? "GUARDANDO..." : "GUARDAR BORRADOR"}</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.btnPrimary} onPress={generarPDF} disabled={saving}>
                <Text style={styles.btnPrimaryText}>GENERAR PDF </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>

      <Modal visible={sigModal.visible} animationType="slide" onRequestClose={() => setSigModal({visible: false, target: null})}>
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
            
            <TouchableOpacity style={styles.btnCloseModal} onPress={() => setSigModal({visible: false, target: null})}>
                <Text style={{color: BRAND.colors.text, fontWeight: 'bold'}}>CANCELAR</Text>
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
      keyboardType={keyboard}
      {...BASE_INPUT_PROPS}
    />
  </View>
);

const InputRow = ({ label, val, setVal, ph, kbd = 'default', boxed = false, ...props }) => (
  <View style={{ marginBottom: 12 }}>
    <Text style={styles.label}>{label}</Text>
    <TextInput
      style={[styles.input, boxed && { borderWidth: 1, borderColor: '#e5e7eb', backgroundColor: '#f9fafb', color: '#111827' }, props.style]}
      value={val}
      onChangeText={setVal}
      placeholder={ph}
      placeholderTextColor={BRAND.colors.textMuted}
      keyboardType={kbd}
      {...BASE_INPUT_PROPS}
      {...props}
    />
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BRAND.colors.bg },
  headerRed: { backgroundColor: BRAND.colors.cardAlt, paddingTop: 50, paddingHorizontal: 15, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: BRAND.colors.border },
  headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  btnBack: { marginRight: 10, paddingVertical: 4, paddingHorizontal: 8, backgroundColor: BRAND.colors.bgAlt, borderRadius: BRAND.radius.sm, borderWidth: 1, borderColor: BRAND.colors.border },
  btnBackText: { color: BRAND.colors.accentStrong, fontSize: 11, fontFamily: BRAND.fonts.semi },
  headerTitle: { color: BRAND.colors.text, fontSize: 16, fontFamily: BRAND.fonts.title, flex: 1 },
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
  pickerEstado: { flex: 0.8, borderWidth: 1, borderColor: BRAND.colors.border, borderRadius: BRAND.radius.md, height: 38, justifyContent: 'center', backgroundColor: '#4b5563' },
  estadoSI:      { backgroundColor: '#16a34a', borderColor: '#4ade80' },
  estadoNO:      { backgroundColor: '#dc2626', borderColor: '#f87171' },
  estadoNA:      { backgroundColor: '#ca8a04', borderColor: '#fbbf24' },
  estadoDefault: { backgroundColor: '#4b5563', borderColor: '#9ca3af' },
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
  
  logoPicker: { width: '100%', height: 80, borderWidth: 1, borderColor: BRAND.colors.border, borderRadius: BRAND.radius.md, justifyContent: 'center', alignItems: 'center', backgroundColor: BRAND.colors.bgAlt, marginBottom: 20 },
  logoPreview: { width: '100%', height: '100%', borderRadius: BRAND.radius.md },
  logoPickerText: { color: BRAND.colors.textMuted, fontSize: 12, fontFamily: BRAND.fonts.semi },

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
