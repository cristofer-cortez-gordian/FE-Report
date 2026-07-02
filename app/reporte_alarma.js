import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Button, FlatList, Image, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
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
import { getSafeMisReportes, downloadReportAssets, enqueueBackup, imageUriToDataUrl, migrateReportPhotoUris, optimizeReportForStorage, persistPhotoUri, persistSignatureDataUrl, reuploadReportAssets, sanitizeReportsForStorage, savePhotoToGallery, saveUserSnapshot, saveWithSpaceCheck, signatureUriToDataUrl } from '../utils/backup';
import { buildExactPdfHeader, PDF_EXACT_HEADER_STYLES, PDF_PRINT_SAFE_STYLES } from '../utils/pdfHeader';
import { printHtmlToPdf, sharePdfUri } from '../utils/pdfExport';

export default function ReporteAlarma() {
  const { cliente, datosPrevios, modo, idOriginal, logoCliente } = useLocalSearchParams();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState('general');
  const [saving, setSaving] = useState(false);
  const [signatureModalVisible, setSignatureModalVisible] = useState(false);
  const [currentSigner, setCurrentSigner] = useState(null);
  const signatureRef = useRef();
  const autoSaveTimer = useRef(null);
  const resolvedIdRef = useRef(null);
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(false);
  const DEVICE_PAGE_SIZE = 200;
  const [devicePages, setDevicePages] = useState({ detectores: 1, modulos: 1, estaciones: 1, estrovocopicas: 1 });

  const [formData, setFormData] = useState({
    h_fecha: new Date().toLocaleDateString(),
    logo_cliente: logoCliente || null,
    h_ejecutivo: '',
    h_email_ejecutivo: '',
    h_cel: '',
    h_tel_oficina: '',
    h_tecnico: '',
    h_sistema: 'MANTENIMIENTO AL SISTEMA DE ALARMA DE INCENDIOS',
    h_cliente: cliente || '',
    h_contacto: '',
    h_departamento_supervisor: '',
    h_responsable_depto: '',
    h_tel: '',
    h_email: '',
    h_predio: '',
    h_direccion: '',
    h_hora_inicio: '',
    h_hora_final: '',
    g_direccion: '',
    g_contacto: '',
    g_telefono: '',
    g_email: '',
    empresa_nombre: '',
    empresa_direccion: '',
    empresa_representante: '',
    empresa_telefono: '',
    empresa_correo: '',
    empresa_especialista: '',
    g_fecha: new Date().toLocaleDateString(),
    g_predio: '',
    g_manto_lazo: '1 y 2',
    g_cant_det: '',
    g_cant_mod: '',
    g_cant_est: '',
    g_cant_estr: '',
    firma_cliente: null,
    firma_tecnico: null,
    nombre_cliente_firma: '',
    nombre_tecnico_firma: '',
    p_ubi: 'Cto de Vigilancia', p_fab: 'Edwards', p_mod: 'EST3X',
    p_lazos: '2', p_estilo: 'Tipo B',
    p_vprim: '119.1 V', p_vsec: 'N/A',
    p_bat1: '13.8 V', p_bat2: '13.8 V',
    p_vlazos: '16-19 V',
    p_obs: '',

    fp_marca: '',
    fp_mod: '',
    fp_ubicacion: 'ALMACEN GENERAL',
    fp_vprim: '123.4 VAC',
    fp_vsec: 'N/A',
    fp_vbat: '13.7 VDC Y 13.7 VDC',
    fp_vnac: '22.3 VDC',
    fp_normal: 'SI',
    fp_prob_nac12: 'NO',
    fp_prob_nac34: 'NO',
    fp_prob_bat: 'NO',
    fp_fallo_tierra: 'NO',
    fp_ubic_tablero: 'ALMACEN GENERAL',

    p_fotos: [null, null, null, null],
    detectores: [],
    modulos: [],
    estaciones: [],
    estrovocopicas: [],
    incidencias: [],
    logo_cliente: null,
    sucursal: 'Matriz Toluquilla'
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
      console.warn('saveHydratedToLocal failed (alarma)', e);
    }
  };

  // Cargar datos si estamos editando
  useEffect(() => {
    const cargarDatosTemporales = async () => {
      try {
        console.log("Intentando cargar datos temporales...", "modo:", modo, "idOriginal:", idOriginal);

        const datosTemporales = await AsyncStorage.getItem('reporte_temporal');

        if (datosTemporales) {
          const datosParseados = JSON.parse(datosTemporales);
          console.log("Datos cargados desde AsyncStorage:", datosParseados);

          // Limpiar el storage temporal
          await AsyncStorage.removeItem('reporte_temporal');

          // Asegurar que los arrays existan y tengan la estructura correcta
          const datosCorregidos = {
            ...datosParseados,
            sucursal: datosParseados?.sucursal || 'Matriz Toluquilla',
            detectores: Array.isArray(datosParseados.detectores) ? datosParseados.detectores : [],
            modulos: Array.isArray(datosParseados.modulos) ? datosParseados.modulos : [],
            estaciones: Array.isArray(datosParseados.estaciones) ? datosParseados.estaciones : [],
            estrovocopicas: Array.isArray(datosParseados.estrovocopicas) ? datosParseados.estrovocopicas : [],
            incidencias: Array.isArray(datosParseados.incidencias) ? datosParseados.incidencias : [],
            p_fotos: Array.isArray(datosParseados.p_fotos) ? datosParseados.p_fotos : [null, null, null, null]
          };

          // Asegurar que p_fotos tenga 4 espacios
          while (datosCorregidos.p_fotos.length < 4) {
            datosCorregidos.p_fotos.push(null);
          }

          const migrated = await migrateReportPhotoUris(datosCorregidos, datosCorregidos.id || idOriginal);
          const downloadResult = await downloadReportAssets(migrated);
          const hydrated = downloadResult?.report || migrated;

          if (modo === 'clonar') {
            console.log("Modo: CLONAR");
            const cloned = {
              ...hydrated,
              id: Date.now(),
              g_fecha: new Date().toLocaleDateString(),
              firma_cliente: null,
              firma_tecnico: null,
              nombre_cliente_firma: '',
              nombre_tecnico_firma: '',
              sucursal: hydrated?.sucursal || 'Matriz Toluquilla'
            };
            setFormData(cloned);
            await saveHydratedToLocal(cloned);
            Alert.alert("Borrador creado", "Borrador creado automaticamente al clonar.");
          }
          else if (modo === 'editar') {
            console.log("Modo: EDITAR");
            setFormData(hydrated);
            await saveHydratedToLocal(hydrated);
          }
        } else {
          console.log("No hay datos temporales en AsyncStorage");
        }
      } catch (e) {
        console.log("Error al cargar datos temporales:", e);
      } finally {
        setAutoSaveEnabled(true);
      }
    };

    cargarDatosTemporales();
  }, [modo]);

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

  // Actualizar automáticamente la cantidad de dispositivos
  useEffect(() => {
    setFormData(prevFormData => ({
      ...prevFormData,
      g_cant_det: (prevFormData.detectores?.length || 0).toString(),
      g_cant_mod: (prevFormData.modulos?.length || 0).toString(),
      g_cant_est: (prevFormData.estaciones?.length || 0).toString(),
      g_cant_estr: (prevFormData.estrovocopicas?.length || 0).toString()
    }));
  }, [formData.detectores?.length, formData.modulos?.length, formData.estaciones?.length, formData.estrovocopicas?.length]);

  useEffect(() => {
    if (!autoSaveEnabled) return;
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);

    autoSaveTimer.current = setTimeout(async () => {
      try {
        const optimized = optimizeReportForStorage(formData, { keepLocal: true });
        await saveWithSpaceCheck('reporte_temporal', JSON.stringify(optimized));
      } catch (e) {
        console.warn('autosave failed (alarma)', e);
      }
    }, 800);

    return () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    };
  }, [autoSaveEnabled, formData]);

  // Función auxiliar para preparar el objeto a guardar
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

  const prepararDatosParaGuardar = () => {
    const nombreCliente = cliente || formData.g_contacto || formData.g_predio;
    if (!nombreCliente) return null;

    return {
      ...formData,
      cliente: nombreCliente,
      tipo: 'alarma',
      id: resolveReportId(),
      ultimoCambio: new Date().toISOString()
    };
  };

  // Botón Azul: Solo Guarda
  const guardarEnHistorial = async () => {
    const reporteAGuardar = prepararDatosParaGuardar();
    if (!reporteAGuardar) {
      return Alert.alert("Faltan datos", "Para guardar, escribe al menos el nombre del cliente o el contacto.");
    }

    try {
      setSaving(true);
      let historial = await getSafeMisReportes();
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
      try { await saveUserSnapshot(); } catch (e) { }
      enqueueBackup(reporteAGuardar).catch(e => console.warn('Backup queue failed (alarma):', e));
      Alert.alert("Guardado", "El borrador se guardó correctamente.");

    } catch (e) {
      Alert.alert("Error", "No se pudo guardar: " + e.message);
    } finally {
      setSaving(false);
    }
  };


  // FUNCIÓN PRINCIPAL: GUARDA EN HISTORIAL Y GENERA PDF

  const generarPDFProfesional = async () => {
    // 1. Validaciones
    if (!formData.firma_cliente || !formData.firma_tecnico) {
      Alert.alert("Faltan Firmas", "Por favor asegúrate de firmar (Cliente y Técnico) antes de generar el PDF.");
      return;
    }

    const reporteAGuardar = prepararDatosParaGuardar();
    if (!reporteAGuardar) {
      return Alert.alert("Faltan datos", "Se requiere nombre del cliente para guardar.");
    }

    setSaving(true);

    try {

      // PASO 1: GUARDADO OFFLINE AUTOMÁTICO

      let historial = await getSafeMisReportes();
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
      try { await saveUserSnapshot(); } catch (e) { }

      // PASO 2: GENERACION DEL PDF

      const firmaCliente = await signatureUriToDataUrl(formData.firma_cliente);
      const firmaTecnico = await signatureUriToDataUrl(formData.firma_tecnico);
      const logoClientePdf = formData.logo_cliente ? await imageUriToDataUrl(formData.logo_cliente, { maxWidth: 300, compress: 0.8 }) : null;

      const panelFotos = [];
      for (const uri of (formData.p_fotos || [])) {
        panelFotos.push(await imageUriToDataUrl(uri, { maxWidth: 200, compress: 0.4 }));
      }
      const convertDevices = async (devices) => {
        const list = Array.isArray(devices) ? devices : [];
        const converted = [];
        for (const item of list) {
          const fotos = Array.isArray(item.fotos) ? item.fotos : [];
          const fotosData = [];
          for (const uri of fotos) {
            fotosData.push(await imageUriToDataUrl(uri, { maxWidth: 200, compress: 0.4 }));
          }
          converted.push({ ...item, fotos: fotosData });
        }
        return converted;
      };
      const detectoresPdf = await convertDevices(formData.detectores);
      const modulosPdf = await convertDevices(formData.modulos);
      const estacionesPdf = await convertDevices(formData.estaciones);
      const estrovocopicasPdf = await convertDevices(formData.estrovocopicas);

      // CAMBIO: Generar HTML para las fotos del panel
      const fotosPanelHtml = `
        <div style="page-break-before: always;">
          <div class="section-header" style="margin-top:10px;">Evidencia Fotográfica del Panel</div>
          <div class="panel-photos">
            <div class="panel-photo">
              ${panelFotos[0] ? `<img src="${panelFotos[0]}" class="panel-photo-img"/>` : '<span class="panel-photo-empty">Sin foto 1</span>'}
            </div>
            <div class="panel-photo">
              ${panelFotos[1] ? `<img src="${panelFotos[1]}" class="panel-photo-img"/>` : '<span class="panel-photo-empty">Sin foto 2</span>'}
            </div>
            <div class="panel-photo">
              ${panelFotos[2] ? `<img src="${panelFotos[2]}" class="panel-photo-img"/>` : '<span class="panel-photo-empty">Sin foto 3</span>'}
            </div>
            <div class="panel-photo">
              ${panelFotos[3] ? `<img src="${panelFotos[3]}" class="panel-photo-img"/>` : '<span class="panel-photo-empty">Sin foto 4</span>'}
            </div>
          </div>
        </div>
        `;

      const headerHtml = await buildExactPdfHeader({
        title: 'REPORTE DE MANTENIMIENTO SISTEMA DE ALARMA DE INCENDIOS',
        logoCliente: logoClientePdf,
        sucursal: formData.sucursal,
        meta: `${formData.h_fecha || formData.g_fecha} | ${formData.h_cliente || cliente || '-'} | ${formData.empresa_nombre || '-'}`,
        fields: {
          fecha: formData.h_fecha || formData.g_fecha,
          ejecutivo: formData.h_ejecutivo,
          emailEjecutivo: formData.h_email_ejecutivo,
          cel: formData.h_cel,
          telOficina: formData.h_tel_oficina,
          tecnico: formData.h_tecnico,
          sistema: formData.h_sistema,
          cliente: formData.h_cliente || cliente,
          contacto: formData.h_contacto || formData.g_contacto,
          departamentoSupervisor: formData.h_departamento_supervisor,
          telCliente: formData.h_tel || formData.g_telefono,
          emailCliente: formData.h_email || formData.g_email,
          predio: formData.h_predio || formData.g_predio,
          direccion: formData.h_direccion || formData.g_direccion,
          horaInicio: formData.h_hora_inicio,
          horaFinal: formData.h_hora_final,
          responsableDepto: formData.h_responsable_depto,
          cant_det: formData.g_cant_det,
          cant_mod: formData.g_cant_mod,
          cant_est: formData.g_cant_est,
          cant_estr: formData.g_cant_estr
        }
      });

      const panelSectionHtml = `
            <div class="section-header">Check List Panel de Control</div>
            <table class="data-table">
            <tr>
              <th colspan="2">Datos Generales Panel de Control</th>
              <th colspan="2">Mediciones Panel de Control</th>
            </tr>
            <tr>
              <td>Ubicación panel:</td><td>${formData.p_ubi}</td>
              <td>Voltaje primario:</td><td>${formData.p_vprim}</td>
            </tr>
            <tr>
              <td>Fabricante:</td><td>${formData.p_fab}</td>
              <td>Voltaje secundario:</td><td>${formData.p_vsec}</td>
            </tr>
             <tr>
              <td>Modelo Panel:</td><td>${formData.p_mod}</td>
              <td>Voltaje de Lazos:</td><td>${formData.p_vlazos}</td>
            </tr>
            </table>

            <div class="section-header" style="margin-top: 15px;">FUENTE DE PODER Mca: ${formData.fp_marca} NOTIFIER Mod: ${formData.fp_mod}</div>
            <table class="data-table">
            <tr>
              <td style="width: 50%;">Ubicación APS:</td><td>${formData.fp_ubicacion}</td>
            </tr>
            <tr>
              <td>Voltaje primario:</td><td>${formData.fp_vprim}</td>
            </tr>
            <tr>
              <td>Voltaje secundario:</td><td>${formData.fp_vsec}</td>
            </tr>
            <tr>
              <td>Voltaje de batería 1 y 2:</td><td>${formData.fp_vbat}</td>
            </tr>
            <tr>
              <td>Voltaje Nac 1-2-3:</td><td>${formData.fp_vnac}</td>
            </tr>
            <tr>
              <td>Fuente en sistema normal?:</td><td>${formData.fp_normal}</td>
            </tr>
            <tr>
              <td>Problema nac's 1 y 2?:</td><td>${formData.fp_prob_nac12}</td>
            </tr>
            <tr>
              <td>Problema nac's 3 y 4?:</td><td>${formData.fp_prob_nac34}</td>
            </tr>
            <tr>
              <td>Problema de batería?:</td><td>${formData.fp_prob_bat}</td>
            </tr>
            <tr>
              <td>Fallo a tierra?:</td><td>${formData.fp_fallo_tierra}</td>
            </tr>
            <tr>
              <td>Ubicación de tablero Elec. y No. De térmico:</td><td>${formData.fp_ubic_tablero}</td>
            </tr>
            </table>
            ${fotosPanelHtml}
          `;

      const createBlueTable = (title, devices, typeCode, options = {}) => {
        if (devices.length === 0) return '';
        const isEstroboscopicaTable = typeCode === 'ESTR';

        const {
          firstPageRows = 3,
          nextPageRows = 14,
          forcePageBreakPerChunk = false,
          showCaptionOnEveryChunk = false
        } = options;

        const rowStrings = devices.map((item, index) => {
          const pruebas = item?.pruebas || {};
          const fotos = Array.isArray(item?.fotos) ? item.fotos : [];

          const normalizeTriState = (value) => {
            const normalized = String(value ?? '').trim().toUpperCase();
            if (normalized === 'SI' || normalized === 'S' || normalized === 'YES') return 'SI';
            if (normalized === 'NO' || normalized === 'N') return 'NO';
            return 'N/A';
          };

          const booleanToCell = (value) => {
            if (value === true) return 'SI';
            if (value === false) return 'NO';
            return 'N/A';
          };

          const funcionalValue = isEstroboscopicaTable
            ? normalizeTriState(pruebas.funcional)
            : booleanToCell(pruebas.funcional);
          const reportaValue = isEstroboscopicaTable
            ? normalizeTriState(item?.reporta ?? pruebas.reporta ?? item?.estado)
            : booleanToCell(pruebas.reporta);
          const ledsValue = isEstroboscopicaTable
            ? normalizeTriState(pruebas.leds)
            : booleanToCell(pruebas.leds);
          const fisicoOkValue = isEstroboscopicaTable
            ? normalizeTriState(pruebas.fisicoOk)
            : booleanToCell(pruebas.fisicoOk);
          const obstruidoValue = isEstroboscopicaTable
            ? normalizeTriState(pruebas.obstruido)
            : booleanToCell(pruebas.obstruido);
          const limpiezaValue = isEstroboscopicaTable
            ? normalizeTriState(pruebas.limpieza)
            : booleanToCell(pruebas.limpieza);

          let observacionText = (item.observacion && item.observacion !== 'N/A') ? item.observacion : '';
          if (item.comentario) {
            observacionText += (observacionText ? ' - ' : '') + item.comentario;
          }
          if (!observacionText) observacionText = 'N/A';

          return `
            <tr>
                <td class="col-blue text-left" style="padding: 2px;">${item.numero || (index + 1)}</td>
                <td class="col-white text-left" style="font-size:7px; padding: 2px;">${item.ubicacion || '-'}</td>
                <td class="col-blue">${typeCode}</td>
                <td class="col-white">${item.zona || '-'}</td>
                <td class="col-blue">${funcionalValue}</td>
                <td class="col-white">${reportaValue}</td>
                <td class="col-blue">${ledsValue}</td>
                <td class="col-white">${fisicoOkValue}</td>
                <td class="col-blue">${obstruidoValue}</td>
                <td class="col-white">${limpiezaValue}</td>
                <td class="col-blue text-left" style="font-size:7px; padding: 2px;">${observacionText}</td>

                <td class="photo-cell col-white">${fotos[0] ? `<img src="${fotos[0]}" class="device-img"/>` : ''}</td>
                <td class="photo-cell col-white">${fotos[1] ? `<img src="${fotos[1]}" class="device-img"/>` : ''}</td>
                <td class="photo-cell col-white">${fotos[2] ? `<img src="${fotos[2]}" class="device-img"/>` : ''}</td>
            </tr>
          `;
        });

        const headerHtml = `
          <colgroup>
            <col style="width: 9%;">
            <col style="width: 16%;">
            <col style="width: 4%;">
            <col style="width: 5%;">
            <col style="width: 4%;">
            <col style="width: 4%;">
            <col style="width: 4%;">
            <col style="width: 4%;">
            <col style="width: 4%;">
            <col style="width: 4%;">
            <col style="width: 4%;">
            <col style="width: 12.6%;">
            <col style="width: 12.6%;">
            <col style="width: 12.6%;">
          </colgroup>
          <thead>
            <tr>
              <th colspan="14" class="stair-banner">
                D.H. Detector de humo. - D.T Detector Térmico. - D.H.T, Detector Humo y Térmico.- D.T.L. Detector térmico tipo lápiz, D.M. Detector multicriterio, DG. Detector de Gas, D.H. Detector de hidrocarburo, D.F. Detector de Flama, D.L, Fotobeam, S.F. detector de flujo, M.D. Modulo dual. E.M . Estación Manual.- M.C. Modulo de Control.- M.M. Modulo Monitor.- M.R. Modulo Relevador. ISO. Modulo Aislador.- P.S. Fuente de Poder
              </th>
            </tr>
            <tr>
              <th colspan="14" class="stair-row col-blue">A: Numero de dispositivo</th>
            </tr>
            <tr>
              <th rowspan="11" class="stair-col col-blue">A</th>
              <th colspan="13" class="stair-row col-white">B: Ubicación de dispositivo</th>
            </tr>
            <tr>
              <th rowspan="10" class="stair-col col-white">B</th>
              <th colspan="12" class="stair-row col-blue">C: Tipo de dispositivo</th>
            </tr>
            <tr>
              <th rowspan="9" class="stair-col col-blue">C</th>
              <th colspan="11" class="stair-row col-white">D: Numero de zona lógica</th>
            </tr>
            <tr>
              <th rowspan="8" class="stair-col col-white">D</th>
              <th colspan="10" class="stair-row col-blue">E: Realizar prueba de funcionamiento del dispositivo</th>
            </tr>
            <tr>
              <th rowspan="7" class="stair-col col-blue">E</th>
              <th colspan="9" class="stair-row col-white">F: El dispositivo reporto al panel ?</th>
            </tr>
            <tr>
              <th rowspan="6" class="stair-col col-white">F</th>
              <th colspan="8" class="stair-row col-blue">G: Los led se encuentran parpadeando?</th>
            </tr>
            <tr>
              <th rowspan="5" class="stair-col col-blue">G</th>
              <th colspan="7" class="stair-row col-white">H: El dispositivo esta libre de materia extraña y/o daño físico</th>
            </tr>
            <tr>
              <th rowspan="4" class="stair-col col-white">H</th>
              <th colspan="6" class="stair-row col-blue">I: El dispositivo se encuentra obstruido?</th>
            </tr>
            <tr>
              <th rowspan="3" class="stair-col col-blue">I</th>
              <th colspan="5" class="stair-row col-white">J: Realizar limpieza de dispositivo</th>
            </tr>
            <tr>
              <th rowspan="2" class="stair-col col-white">J</th>
              <th colspan="4" class="stair-row col-blue">K: No. De observación. (detallar al final del reporte)</th>
            </tr>
            <tr>
              <th class="stair-col col-blue">K</th>
              <th class="stair-photo">ANTES O PRUEBAS</th>
              <th class="stair-photo">DURANTE</th>
              <th class="stair-photo">DESPUÉS</th>
            </tr>
          </thead>
        `;

        const nextHeaderHtml = `
          <colgroup>
            <col style="width: 9%;">
            <col style="width: 16%;">
            <col style="width: 4%;">
            <col style="width: 5%;">
            <col style="width: 4%;">
            <col style="width: 4%;">
            <col style="width: 4%;">
            <col style="width: 4%;">
            <col style="width: 4%;">
            <col style="width: 4%;">
            <col style="width: 4%;">
            <col style="width: 12.6%;">
            <col style="width: 12.6%;">
            <col style="width: 12.6%;">
          </colgroup>
          <thead>
            <tr>
              <th class="stair-col col-blue">A</th>
              <th class="stair-col col-white">B</th>
              <th class="stair-col col-blue">C</th>
              <th class="stair-col col-white">D</th>
              <th class="stair-col col-blue">E</th>
              <th class="stair-col col-white">F</th>
              <th class="stair-col col-blue">G</th>
              <th class="stair-col col-white">H</th>
              <th class="stair-col col-blue">I</th>
              <th class="stair-col col-white">J</th>
              <th class="stair-col col-blue">K</th>
              <th class="stair-photo">ANTES O PRUEBAS</th>
              <th class="stair-photo">DURANTE</th>
              <th class="stair-photo">DESPUÉS</th>
            </tr>
          </thead>
        `;

        const titleCaption = `<caption class="section-title-caption">${title}</caption>`;
        
        return `
          <table class="img-stair-table" style="page-break-inside: auto; margin-bottom: 12px;">
            ${titleCaption}
            ${headerHtml}
            <tbody>
              ${rowStrings.join('')}
            </tbody>
          </table>
        `;
      };

      const footerHtml = `
          <div class="report-footer">
          <div class="footer-note">Este reporte fue generado por <span class="brand-fire">Fire</span> <span class="brand-eng">Engineers</span> y es valido con firmas autografas.</div>
          <table class="signatures-table">
            <tr>
              <td class="sig-cell">
                ${firmaCliente ? `<img src="${firmaCliente}" class="sig-img"/>` : ''}<br/>
                <div style="font-size:10px;">${formData.nombre_cliente_firma}</div>
                <div class="sig-line">Por Parte Del Cliente</div>
              </td>
              <td style="width:10%;"></td>
              <td class="sig-cell">
                 ${firmaTecnico ? `<img src="${firmaTecnico}" class="sig-img"/>` : ''}<br/>
                <div style="font-size:10px;">${formData.nombre_tecnico_firma}</div>
                <div class="sig-line"><span class="brand-fire">Fire</span> <span class="brand-eng">Engineers</span></div>
              </td>
            </tr>
          </table>
          </div>
        `;

      const baseStyles = `
        ${PDF_PRINT_SAFE_STYLES}
        body { font-family: Arial, sans-serif; padding: 0; color: #111827; font-size: 10px; }
        @page { margin: 5mm 5mm 5mm 5mm !important; }
        ${PDF_EXACT_HEADER_STYLES}
        .report-header { text-align: center; margin-bottom: 5px; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px; }
        .brand { font-size: 16px; font-weight: bold; }
        .brand-fire { color: #ff6b6b; }
        .brand-eng { color: #1f4aa8; }
        .brand-sub { font-size: 9px; color: #6b7280; }
        .report-title { font-size: 12px; font-weight: bold; color: #1f2937; margin-top: 4px; }
        .meta { font-size: 9px; color: #6b7280; margin-top: 2px; }

        .header-table { width: 100%; border-collapse: collapse; margin-bottom: 6px; border: 1px solid #000; page-break-inside: auto; }
        .header-table td { border: 1px solid #000; padding: 2px 4px; }
        .data-table { width: 100%; border-collapse: collapse; font-size: 9px; margin-bottom: 6px; page-break-inside: auto; }
        .data-table td, .data-table th { border: 1px solid #000; padding: 2px 4px; }
        .section-header { background-color: #111827; color: #fff; font-weight: bold; text-align: center; padding: 5px; border: 1px solid #111827; }
        .section-title { font-weight: bold; color: #111827; text-align: center; font-size: 11px; margin-top: 6px; margin-bottom: 2px; }
        .section-title-caption { font-weight: bold; color: #111827; text-align: center; font-size: 11px; padding: 4px 2px; caption-side: top; }

        /* Estilos específicos de la tabla en escalera */
        .img-stair-table { width: 100%; border-collapse: collapse; font-size: 8px; margin-top: 2px; page-break-inside: auto; table-layout: fixed; }
        .img-stair-table thead { display: table-header-group; }
        .img-stair-table tfoot { display: table-footer-group; }
        .img-stair-table th, .img-stair-table td { 
          border: 1px solid #000; text-align: center; padding: 2px; 
          word-wrap: break-word; overflow-wrap: break-word; word-break: break-word;
        }
        .img-stair-table tbody td { height: 50px; }
        
        .stair-banner {
          background-color: #0070c0; color: white; font-size: 6px; text-align: center;
          padding: 3px; font-weight: normal; border: 1px solid #000;
        }
        .stair-row {
          text-align: right !important; border: 1px solid #000; padding: 2px 4px;
          font-size: 7px; font-weight: normal; background-color: #ffffff;
        }
        .stair-col {
          border: 1px solid #000; vertical-align: bottom; text-align: center;
          font-weight: bold; font-size: 8px; padding-bottom: 2px;
        }
        .col-blue { background-color: #dce6f1 !important; }
        .col-white { background-color: #ffffff !important; }
        .stair-photo {
          border: 1px solid #000; background-color: #ffffff; font-size: 7px;
          font-weight: bold; text-align: center; vertical-align: bottom; padding: 4px;
        }
        .col-a { background-color: #dce6f1; }
        .col-b { background-color: #ffffff; }
        .col-c { background-color: #dce6f1; }
        .col-d { background-color: #ffffff; }
        .col-e { background-color: #dce6f1; }
        .col-f { background-color: #ffffff; }
        .col-g { background-color: #dce6f1; }
        .col-h { background-color: #ffffff; }
        .col-i { background-color: #dce6f1; }
        .col-j { background-color: #ffffff; }
        .col-k { background-color: #dce6f1; }
        .bg-white { background-color: #ffffff; }
        .text-left { text-align: left !important; }

        tr { page-break-inside: avoid; page-break-after: auto; }
        .photo-cell { padding: 0 !important; }
        .device-img { width: 100%; height: 50px; object-fit: cover; display:block; }

        .panel-photos { display: flex; gap: 6px; margin-top: 5px; }
        .panel-photo { flex: 1 1 0; border: 1px solid #ddd; padding: 5px; text-align: center; min-height: 100px; }
        .panel-photo-img { width: 100%; height: 90px; object-fit: contain; display: block; }
        .panel-photo-empty { color: #ccc; font-size: 9px; }

        .report-footer { margin-top: 10px; page-break-inside: avoid; }
        .footer-note { font-size: 8px; color: #374151; text-align: center; margin-bottom: 8px; }
        .signatures-table { width: 100%; margin-top: 12px; page-break-inside: avoid; }
        .sig-cell { width: 45%; text-align: center; vertical-align: bottom; height: 100px; }
        .sig-line { border-top: 1px solid #111827; width: 80%; margin: 0 auto; padding-top: 5px; color: #111827; font-weight: bold; }
        .sig-img { height: 80px; max-width: 200px; }
      `;

      const createDocument = (sectionHtml) => `
        <html>
          <head>
            <style>${baseStyles}</style>
          </head>
          <body>
            <table style="width: 100%; border: none;">
              <thead class="page-number-header">
                <tr><td class="page-number-cell"></td></tr>
              </thead>
              <tbody>
                <tr>
                  <td style="border: none; padding: 0;">
                    ${headerHtml}
                    ${sectionHtml}
                    ${footerHtml}
                  </td>
                </tr>
              </tbody>
            </table>
          </body>
        </html>
      `;

      const sections = [
        {
          key: 'detectores',
          html: createBlueTable("TABLA DE DETECTORES", detectoresPdf, "D.H", {
            firstPageRows: 3,
            nextPageRows: 14,
            forcePageBreakPerChunk: true
          })
        },
        {
          key: 'modulos',
          html: createBlueTable("TABLA DE MÓDULOS", modulosPdf, "MOD", {
            firstPageRows: 3,
            nextPageRows: 14,
            forcePageBreakPerChunk: true
          })
        },
        { key: 'estrovocopicas', html: createBlueTable("TABLA DE ESTROBOCOPICAS", estrovocopicasPdf, "ESTR", { forcePageBreakPerChunk: true }) },
        { key: 'estaciones', html: createBlueTable("TABLA DE ESTACIONES MANUALES", estacionesPdf, "EST", { forcePageBreakPerChunk: true }) },
        { key: 'panel', html: panelSectionHtml }
      ];

      const pdfs = [];
      for (const section of sections) {
        const html = createDocument(section.html);
        const { uri } = await printHtmlToPdf({ html, fileName: `alarma-${section.key}-${formData.id || Date.now()}.pdf` });
        pdfs.push({ key: section.key, uri });
      }

      for (const item of pdfs) {
        await sharePdfUri(item.uri);
      }
      
      // ALERTA PARA GENERAR INCIDENCIAS O TERMINAR
      if (formData.incidencias && formData.incidencias.length > 0) {
        Alert.alert(
          "Reporte Principal Generado",
          "¿Deseas generar también el reporte de incidencias?",
          [
            { text: "No", style: "cancel", onPress: () => Alert.alert("Listo", "Proceso completado") },
            { text: "Sí", onPress: () => generarPDFIncidencias() }
          ]
        );
      } else {
        Alert.alert("Listo", "PDF compartido correctamente");
      }

    } catch (error) {
      Alert.alert("Error Crítico", error.message);
    } finally {
      setSaving(false);
    }
  };

  const generarPDFIncidencias = async () => {
    try {
      setSaving(true);
      const reporteConImagenesEnLaNube = prepararDatosParaGuardar();
      if (!reporteConImagenesEnLaNube) {
        setSaving(false);
        return Alert.alert("Faltan datos", "Se requiere el nombre del cliente para continuar.");
      }

      const logoClienteBase64 = reporteConImagenesEnLaNube.logo_cliente 
        ? (reporteConImagenesEnLaNube.logo_cliente.startsWith('http') 
            ? await imageUriToDataUrl(reporteConImagenesEnLaNube.logo_cliente) 
            : reporteConImagenesEnLaNube.logo_cliente) 
        : null;

      const headerHtml = await buildExactPdfHeader({
        title: 'REPORTE DE INCIDENCIAS - SISTEMA DE ALARMA DE INCENDIOS',
        logoCliente: logoClienteBase64,
        sucursal: reporteConImagenesEnLaNube.sucursal,
        meta: `${reporteConImagenesEnLaNube.h_fecha || reporteConImagenesEnLaNube.g_fecha} | ${reporteConImagenesEnLaNube.h_cliente || reporteConImagenesEnLaNube.g_cliente || '-'} | ${reporteConImagenesEnLaNube.empresa_nombre || '-'}`,
        fields: {
          fecha: reporteConImagenesEnLaNube.h_fecha || reporteConImagenesEnLaNube.g_fecha,
          ejecutivo: reporteConImagenesEnLaNube.h_ejecutivo,
          emailEjecutivo: reporteConImagenesEnLaNube.h_email_ejecutivo,
          cel: reporteConImagenesEnLaNube.h_cel,
          telOficina: reporteConImagenesEnLaNube.h_tel_oficina,
          tecnico: reporteConImagenesEnLaNube.h_tecnico,
          sistema: reporteConImagenesEnLaNube.h_sistema,
          cliente: reporteConImagenesEnLaNube.h_cliente || reporteConImagenesEnLaNube.g_cliente,
          contacto: reporteConImagenesEnLaNube.h_contacto || reporteConImagenesEnLaNube.g_contacto,
          departamentoSupervisor: reporteConImagenesEnLaNube.h_departamento_supervisor,
          telCliente: reporteConImagenesEnLaNube.h_tel || reporteConImagenesEnLaNube.g_telefono,
          emailCliente: reporteConImagenesEnLaNube.h_email || reporteConImagenesEnLaNube.g_email,
          predio: reporteConImagenesEnLaNube.h_predio || reporteConImagenesEnLaNube.g_predio,
          direccion: reporteConImagenesEnLaNube.h_direccion || reporteConImagenesEnLaNube.g_direccion,
          horaInicio: reporteConImagenesEnLaNube.h_hora_inicio,
          horaFinal: reporteConImagenesEnLaNube.h_hora_final,
          responsableDepto: reporteConImagenesEnLaNube.h_responsable_depto
        }
      });

      const buildIncidenciasTable = async () => {
        let rows = '';
        for (let i = 0; i < (reporteConImagenesEnLaNube.incidencias || []).length; i++) {
          const inc = reporteConImagenesEnLaNube.incidencias[i];
          const foto1Url = inc.fotos[0] ? (inc.fotos[0].startsWith('http') ? await imageUriToDataUrl(inc.fotos[0]) : inc.fotos[0]) : '';
          const foto2Url = inc.fotos[1] ? (inc.fotos[1].startsWith('http') ? await imageUriToDataUrl(inc.fotos[1]) : inc.fotos[1]) : '';
          const foto3Url = inc.fotos[2] ? (inc.fotos[2].startsWith('http') ? await imageUriToDataUrl(inc.fotos[2]) : inc.fotos[2]) : '';

          rows += `
            <tr>
              <td class="stair-col col-white" style="font-weight:bold; font-size:12px; color:blue; vertical-align:middle; text-align:center;">${i + 1}</td>
              <td class="stair-row col-white" style="vertical-align:top; text-align:left !important; padding:4px;">
                <div style="min-height:40px;">${inc.descripcion || ''}</div>
              </td>
              <td class="stair-row col-white" style="vertical-align:top; text-align:left !important; padding:4px;">
                <div style="min-height:40px;">${inc.pruebas || ''}</div>
              </td>
              <td class="stair-row col-white" style="vertical-align:top; text-align:left !important; padding:4px;">
                <div style="min-height:40px;">${inc.solucion || ''}</div>
              </td>
            </tr>
            <tr>
              <td class="stair-col col-white" style="font-weight:bold; font-size:9px; color:blue; vertical-align:middle; text-align:center;">IMAGEN</td>
              <td class="photo-cell col-white">${foto1Url ? `<img src="${foto1Url}" style="width:100%; height:120px; object-fit:contain; display:block;"/>` : ''}</td>
              <td class="photo-cell col-white">${foto2Url ? `<img src="${foto2Url}" style="width:100%; height:120px; object-fit:contain; display:block;"/>` : ''}</td>
              <td class="photo-cell col-white">${foto3Url ? `<img src="${foto3Url}" style="width:100%; height:120px; object-fit:contain; display:block;"/>` : ''}</td>
            </tr>
          `;
        }
        return `
          <table style="width:100%; border-collapse:collapse; border:1px solid #000;">
            <colgroup>
              <col style="width: 5%;">
              <col style="width: 31.6%;">
              <col style="width: 31.6%;">
              <col style="width: 31.6%;">
            </colgroup>
            <thead>
              <tr>
                <th class="stair-col col-blue" style="font-size:10px; color:blue; padding:4px; text-align:left; border:1px solid #000;">No.</th>
                <th class="stair-col col-blue" style="font-size:10px; padding:4px; border:1px solid #000; text-align:center; font-weight:normal;">DESCRIPCION DE INCIDENCIAS / EVIDENCIA GRAFICA</th>
                <th class="stair-col col-blue" style="font-size:10px; padding:4px; border:1px solid #000; text-align:center; font-weight:normal;">PRUEBAS Y DIAGNOSTICO / EVIDENCIAS GRAFICA</th>
                <th class="stair-col col-blue" style="font-size:10px; padding:4px; border:1px solid #000; text-align:center; font-weight:normal;">SOLUCIÓN O RECOMENDACIÓN / EVIDENCIA GRAFICA</th>
              </tr>
            </thead>
            <tbody>
              ${rows}
            </tbody>
          </table>
        `;
      };

      const incidenciasHtml = await buildIncidenciasTable();

      const baseStyles = `
        ${PDF_PRINT_SAFE_STYLES}
        body { font-family: Arial, sans-serif; padding: 0; color: #111827; font-size: 10px; }
        @page { margin: 5mm 5mm 5mm 5mm !important; }
        ${PDF_EXACT_HEADER_STYLES}
        .header-table { width: 100%; border-collapse: collapse; margin-bottom: 6px; border: 1px solid #000; page-break-inside: auto; }
        .header-table td { border: 1px solid #000; padding: 2px 4px; }
        .data-table { width: 100%; border-collapse: collapse; font-size: 9px; margin-bottom: 6px; page-break-inside: auto; }
        .data-table td, .data-table th { border: 1px solid #000; padding: 2px 4px; }
        .col-blue { background-color: #dce6f1 !important; }
        .col-white { background-color: #ffffff !important; }
        .stair-row { border: 1px solid #000; }
        .stair-col { border: 1px solid #000; }
        .photo-cell { border: 1px solid #000; padding: 0 !important; }
        tr { page-break-inside: avoid; page-break-after: auto; }
      `;

      const htmlContent = `
        <html>
          <head><style>${baseStyles}</style></head>
          <body>
            <table style="width: 100%; border: none;">
              <thead class="page-number-header"><tr><td class="page-number-cell"></td></tr></thead>
              <tbody>
                <tr>
                  <td style="border: none; padding: 0;">
                    ${headerHtml}
                    ${incidenciasHtml}
                  </td>
                </tr>
              </tbody>
            </table>
          </body>
        </html>
      `;

      const { uri } = await printHtmlToPdf({ html: htmlContent, fileName: `alarma-incidencias-${formData.id || Date.now()}.pdf` });
      await sharePdfUri(uri);
      Alert.alert("Listo", "Reporte de incidencias generado y compartido.");
    } catch (e) {
      console.error(e);
      Alert.alert("Error", "No se pudo generar el reporte de incidencias.");
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
          console.warn('reSubirFotos: failed to update local history (alarma)', saveErr);
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

  const pickImage = async (index, type = 'panel', deviceId = null) => {
    if (type === 'general') {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') return Alert.alert("Permiso denegado", "Se requiere galería.");
      let result = await ImagePicker.launchImageLibraryAsync({ allowsEditing: false, quality: 0.8, base64: false });
      if (!result.canceled) {
        const reportKey = resolveReportId();
        const localUri = await persistPhotoUri(result.assets[0].uri, reportKey, `logo_cliente`);
        setFormData({ ...formData, logo_cliente: localUri });
      }
      return;
    }
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') return Alert.alert("Permiso denegado", "Se requiere cámara.");

    let result = await ImagePicker.launchCameraAsync({ allowsEditing: false, quality: 0.5, base64: false });

    if (!result.canceled) {
      const reportKey = resolveReportId();
      await savePhotoToGallery(result.assets[0].uri);
      const localUri = await persistPhotoUri(result.assets[0].uri, reportKey, `${type}_${deviceId ?? index}`);

      if (type === 'panel') {
        let nuevasFotos = [...(formData.p_fotos || [])];
        nuevasFotos[index] = localUri;
        setFormData({ ...formData, p_fotos: nuevasFotos });
      } else {
        const listaActualizada = (formData[type] || []).map(item => {
          if (item.id === deviceId) {
            const nuevasFotosDevice = [...item.fotos];
            nuevasFotosDevice[index] = localUri;
            return { ...item, fotos: nuevasFotosDevice };
          }
          return item;
        });
        setFormData({ ...formData, [type]: listaActualizada });
      }
    }
  };

  const handleSignature = async (signature) => {
    const reportId = resolveReportId();
    const stored = await persistSignatureDataUrl(signature, reportId, currentSigner || 'firma');
    setFormData(prev => ({
      ...prev,
      [currentSigner === 'cliente' ? 'firma_cliente' : 'firma_tecnico']: stored
    }));
    setSignatureModalVisible(false);
  };

  const openSignatureModal = (signer) => {
    setCurrentSigner(signer);
    setSignatureModalVisible(true);
  };

  const addDevice = (tipo) => {
    const nuevo = tipo === 'estrovocopicas'
      ? {
        id: Date.now(),
        estado: '',
        reporta: '',
        pruebas: {
          funcional: '',
          reporta: '',
          leds: '',
          fisicoOk: '',
          obstruido: '',
          limpieza: ''
        },
        observacion: '',
        comentario: '',
        fotos: [null, null, null]
      }
      : {
        id: Date.now(),
        numero: '',
        zona: '',
        ubicacion: '',
        pruebas: {
          funcional: true,
          reporta: true,
          leds: true,
          fisicoOk: true,
          obstruido: false,
          limpieza: true
        },
        observacion: 'N/A',
        comentario: '',
        fotos: [null, null, null]
      };
    const nextList = [...(formData[tipo] || []), nuevo];
    setFormData({ ...formData, [tipo]: nextList });
    const pagesNeeded = Math.ceil(nextList.length / DEVICE_PAGE_SIZE) || 1;
    setDevicePages((prev) => {
      const current = prev[tipo] || 1;
      return pagesNeeded > current ? { ...prev, [tipo]: pagesNeeded } : prev;
    });
  };

  const addIncidencia = () => {
    const nuevaIncidencia = {
      id: Date.now().toString(),
      descripcion: '',
      pruebas: '',
      solucion: '',
      fotos: [null, null, null]
    };
    setFormData({ ...formData, incidencias: [...(formData.incidencias || []), nuevaIncidencia] });
  };

  const updateIncidencia = (id, campo, valor) => {
    const actualizadas = (formData.incidencias || []).map(inc =>
      inc.id === id ? { ...inc, [campo]: valor } : inc
    );
    setFormData({ ...formData, incidencias: actualizadas });
  };

  const removeIncidencia = (id) => {
    const actualizadas = (formData.incidencias || []).filter(inc => inc.id !== id);
    setFormData({ ...formData, incidencias: actualizadas });
  };

  const tomarFotoIncidencia = async (incidenciaId, colIndex) => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') return Alert.alert("Permiso denegado", "Se requiere cámara.");

    let result = await ImagePicker.launchCameraAsync({ allowsEditing: false, quality: 0.5, base64: false });
    if (!result.canceled) {
      await savePhotoToGallery(result.assets[0].uri);
      const reportKey = resolveReportId();
      const localUri = await persistPhotoUri(result.assets[0].uri, reportKey, `incidencia_${incidenciaId}_${colIndex}`);
      
      const actualizadas = (formData.incidencias || []).map(inc => {
        if (inc.id === incidenciaId) {
          const nuevasFotos = [...inc.fotos];
          nuevasFotos[colIndex] = localUri;
          return { ...inc, fotos: nuevasFotos };
        }
        return inc;
      });
      setFormData({ ...formData, incidencias: actualizadas });
    }
  };

  const updateDevice = (tipo, id, field, value) => {
    const listaActualizada = (formData[tipo] || []).map(item => item.id === id ? { ...item, [field]: value } : item);
    setFormData({ ...formData, [tipo]: listaActualizada });
  };

  const updateDeviceCheck = (tipo, id, checkField) => {
    const listaActualizada = (formData[tipo] || []).map(item => {
      if (item.id === id) {
        return { ...item, pruebas: { ...item.pruebas, [checkField]: !item.pruebas[checkField] } };
      }
      return item;
    });
    setFormData({ ...formData, [tipo]: listaActualizada });
  };

  const updateDevicePruebaValue = (tipo, id, checkField, value) => {
    const listaActualizada = (formData[tipo] || []).map(item => {
      if (item.id === id) {
        return {
          ...item,
          pruebas: {
            ...(item.pruebas || {}),
            [checkField]: value
          }
        };
      }
      return item;
    });
    setFormData({ ...formData, [tipo]: listaActualizada });
  };

  const getDevicePage = (tipo) => devicePages[tipo] || 1;
  const getVisibleDevices = (tipo) => (formData[tipo] || []).slice(0, getDevicePage(tipo) * DEVICE_PAGE_SIZE);
  const canLoadMoreDevices = (tipo) => (formData[tipo]?.length || 0) > getDevicePage(tipo) * DEVICE_PAGE_SIZE;
  const loadMoreDevices = (tipo) => {
    setDevicePages((prev) => ({ ...prev, [tipo]: (prev[tipo] || 1) + 1 }));
  };
  const getDevicesWithAddButton = (tipo) => {
    const visible = getVisibleDevices(tipo);
    if (visible.length === 0) return [{ id: `__add__${tipo}`, __add: true }];
    const insertIndex = Math.max(visible.length - 1, 0);
    const next = [...visible];
    next.splice(insertIndex, 0, { id: `__add__${tipo}`, __add: true });
    return next;
  };

  const renderInput = (label, key, placeholder = "", width = "100%", keyboard = "default") => (
    <View style={{ marginBottom: 10, width: width }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={styles.input} placeholder={placeholder} placeholderTextColor={BRAND.colors.textMuted} keyboardType={keyboard}
        value={formData[key]} onChangeText={(v) => setFormData({ ...formData, [key]: v })}
      />
    </View>
  );

  // Buscador de dispositivos por ID
  const [busquedaId, setBusquedaId] = useState('');

  // Filtrar dispositivos por ID (solo mostrar el que coincide exactamente)
  const filtrarDispositivosPorId = (tipo) => {
    if (!busquedaId) return formData[tipo] || [];
    const idBuscado = busquedaId.trim();
    return (formData[tipo] || []).filter(item => {
      const idItem = (item.id ?? '').toString().trim();
      const numeroItem = (item.numero ?? '').toString().trim();
      return idItem === idBuscado || numeroItem === idBuscado;
    });
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={[styles.container, { paddingBottom: insets.bottom }]}
    >
      {/* Encabezado Rojo */}
      <View style={styles.headerApp}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={styles.headerTitle}>Reporte: {cliente || formData.g_contacto || "Nuevo"}</Text>
          {/* Indicador de modo edición */}
        </View>
      </View>

      {/* Buscador por ID de dispositivo */}
      <View style={{ marginBottom: 12, marginTop: 8 }}>
        <Text style={{ fontSize: 14, color: BRAND.colors.textMuted, marginBottom: 4 }}>Buscar dispositivo por ID:</Text>
        <TextInput
          style={{ borderWidth: 1, borderColor: BRAND.colors.border, borderRadius: 8, padding: 8, color: BRAND.colors.text }}
          placeholder="ID del dispositivo"
          value={busquedaId}
          onChangeText={setBusquedaId}
        />
      </View>
      {modo === 'editar' && <Text style={{ color: 'yellow', fontWeight: 'bold' }}>EDITANDO</Text>}

      {/* Tabs */}
      <View style={styles.tabContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingRight: 20 }}>
          {['GENERAL', 'DETECTORES', 'MODULOS', 'ESTACIONES', 'ESTROVOCOPICAS', 'PANEL', 'INCIDENCIAS', 'FIRMAS'].map(tab => (
            <TouchableOpacity key={tab} style={[styles.tab, activeTab === tab.toLowerCase() && styles.activeTab]} onPress={() => setActiveTab(tab.toLowerCase())}>
              <Text style={[styles.tabText, activeTab === tab.toLowerCase() && styles.activeTabText]}>{tab}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 24) }}>

        {/* PESTAÑA: GENERAL */}
        {activeTab === 'general' && (
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

            <Text style={styles.cardTitle}>Logo del cliente (opcional)</Text>
            <TouchableOpacity
              style={{ height: 80, backgroundColor: BRAND.colors.bgAlt, marginBottom: 10, borderRadius: 8, alignItems: 'center', justifyContent: 'center', borderStyle: 'dashed', borderWidth: 1, borderColor: BRAND.colors.border }}
              onPress={() => pickImage('logo', 'general')}
            >
              {formData.logo_cliente
                ? <Image source={{ uri: formData.logo_cliente }} style={{ width: '100%', height: '100%', borderRadius: 8, resizeMode: 'contain' }} onError={() => { }} />
                : <Text style={{ color: BRAND.colors.textMuted, fontSize: 12 }}>Toca para insertar el logo del cliente</Text>
              }
            </TouchableOpacity>

            <Text style={styles.cardTitle}>Datos del cliente</Text>
            <View style={styles.row}>
              {renderInput("Cliente / razón social", "h_cliente", "", "48%")}
              {renderInput("Contacto del cliente", "g_contacto", "", "48%")}
            </View>
            <View style={styles.row}>
              {renderInput("Teléfono del cliente", "g_telefono", "", "48%", "phone-pad")}
              {renderInput("Correo del cliente", "g_email", "", "48%", "email-address")}
            </View>
            <View style={styles.row}>
              {renderInput("Predio / ubicación del cliente", "g_predio", "", "48%")}
              {renderInput("Dirección del sitio", "h_direccion", "", "48%")}
            </View>

            <Text style={styles.cardTitle}>Datos de la empresa que presta el servicio</Text>
            <View style={styles.row}>
              {renderInput("Ejecutivo / representante", "h_ejecutivo", "", "48%")}
              {renderInput("E-mail del ejecutivo", "h_email_ejecutivo", "", "48%", "email-address")}
            </View>
            <View style={styles.row}>
              {renderInput("Celular de la empresa", "h_cel", "", "48%", "phone-pad")}
              {renderInput("Teléfono de oficina", "h_tel_oficina", "", "48%", "phone-pad")}
            </View>
            <View style={styles.row}>
              {renderInput("Técnico", "h_tecnico", "", "48%")}
              {renderInput("Departamento supervisor", "h_departamento_supervisor", "", "48%")}
            </View>

            <Text style={styles.cardTitle}>Datos del servicio</Text>
            <View style={styles.row}>
              {renderInput("Fecha", "h_fecha", "", "48%")}
              {renderInput("Sistema", "h_sistema", "", "48%")}
            </View>
            <View style={styles.row}>
              {renderInput("Hora de inicio", "h_hora_inicio", "", "48%")}
              {renderInput("Hora final", "h_hora_final", "", "48%")}
            </View>
            {renderInput("Responsable del departamento", "h_responsable_depto")}
            {renderInput("Observación / detalle del servicio", "g_manto_lazo")}

            <Text style={styles.cardTitle}>Cantidades Automáticas</Text>
            <View style={styles.row}>
              <View style={{ width: '23%' }}>
                <Text style={styles.label}>Cant. Detectores</Text>
                <View style={[styles.input, { backgroundColor: '#f3f4f6', justifyContent: 'center' }]}>
                  <Text>{formData.g_cant_det || '0'}</Text>
                </View>
              </View>
              <View style={{ width: '23%' }}>
                <Text style={styles.label}>Cant. Módulos</Text>
                <View style={[styles.input, { backgroundColor: '#f3f4f6', justifyContent: 'center' }]}>
                  <Text>{formData.g_cant_mod || '0'}</Text>
                </View>
              </View>
              <View style={{ width: '23%' }}>
                <Text style={styles.label}>Cant. Estaciones</Text>
                <View style={[styles.input, { backgroundColor: '#f3f4f6', justifyContent: 'center' }]}>
                  <Text>{formData.g_cant_est || '0'}</Text>
                </View>
              </View>
              <View style={{ width: '23%' }}>
                <Text style={styles.label}>Cant. Estrobosc.</Text>
                <View style={[styles.input, { backgroundColor: '#f3f4f6', justifyContent: 'center' }]}>
                  <Text>{formData.g_cant_estr || '0'}</Text>
                </View>
              </View>
            </View>

            <Text style={styles.cardTitle}>Datos Internos</Text>
            {renderInput("Manto. Lazo", "g_manto_lazo")}
          </View>
        )}

        {/* PESTAÑAS: LISTAS DE DISPOSITIVOS */}
        {(activeTab === 'detectores' || activeTab === 'modulos' || activeTab === 'estaciones') && (
          <View style={{ flex: 1, minHeight: 500 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10, paddingHorizontal: 15 }}>
              <Text style={styles.cardTitle}>TABLA DE {activeTab.toUpperCase()} ({formData[activeTab]?.length || 0})</Text>
            </View>

            <FlatList
              data={busquedaId ? filtrarDispositivosPorId(activeTab) : getDevicesWithAddButton(activeTab)}
              keyExtractor={(item) => (item.__add ? item.id : item.id.toString())}
              renderItem={({ item, index }) => {
                if (!busquedaId && item.__add) {
                  return (
                    <View style={{ paddingHorizontal: 15, paddingVertical: 10 }}>
                      <TouchableOpacity style={styles.btnAdd} onPress={() => addDevice(activeTab)}>
                        <Text style={{ color: BRAND.colors.ink }}>+ AGREGAR</Text>
                      </TouchableOpacity>
                    </View>
                  );
                }
                const deviceIndex = (formData[activeTab] || []).findIndex(d => d.id === item.id);
                const displayIndex = deviceIndex >= 0 ? deviceIndex + 1 : index + 1;
                return (
                  <View style={[styles.deviceItem, { marginHorizontal: 15 }]}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                      <Text style={{ fontWeight: 'bold', color: BRAND.colors.accentStrong }}>Disp #{displayIndex}</Text>
                      <TouchableOpacity onPress={() => {
                        const nuevaLista = formData[activeTab].filter(d => d.id !== item.id);
                        setFormData({ ...formData, [activeTab]: nuevaLista });
                      }}>
                        <Text style={{ color: BRAND.colors.danger, fontWeight: 'bold' }}>Eliminar</Text>
                      </TouchableOpacity>
                    </View>

                    <View style={styles.row}>
                      <TextInput style={[styles.inputCompact, { flex: 1 }]} placeholder="ID" placeholderTextColor={BRAND.colors.textMuted} value={item.numero} onChangeText={t => updateDevice(activeTab, item.id, 'numero', t)} />
                      <TextInput style={[styles.inputCompact, { flex: 2 }]} placeholder="Zona" placeholderTextColor={BRAND.colors.textMuted} value={item.zona} onChangeText={t => updateDevice(activeTab, item.id, 'zona', t)} />
                      <TextInput style={[styles.inputCompact, { flex: 3 }]} placeholder="Ubicación" placeholderTextColor={BRAND.colors.textMuted} value={item.ubicacion} onChangeText={t => updateDevice(activeTab, item.id, 'ubicacion', t)} />
                    </View>
                    <TextInput
                      style={[styles.input, { height: 36, marginBottom: 0 }]}
                      placeholder="Comentario del dispositivo"
                      value={item.comentario}
                      onChangeText={t => updateDevice(activeTab, item.id, 'comentario', t)}
                    />

                    <Text style={{ fontSize: 9, marginTop: 5, color: BRAND.colors.textMuted }}>Estado:</Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                      <TouchableOpacity onPress={() => updateDeviceCheck(activeTab, item.id, 'funcional')} style={[styles.checkBtn, item.pruebas.funcional ? styles.bgGreen : styles.bgGray]}>
                        <Text style={styles.checkTxt}>Funciona</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => updateDeviceCheck(activeTab, item.id, 'reporta')} style={[styles.checkBtn, item.pruebas.reporta ? styles.bgGreen : styles.bgGray]}>
                        <Text style={styles.checkTxt}>Reporta</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => updateDeviceCheck(activeTab, item.id, 'leds')} style={[styles.checkBtn, item.pruebas.leds ? styles.bgGreen : styles.bgGray]}>
                        <Text style={styles.checkTxt}>LEDs</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => updateDeviceCheck(activeTab, item.id, 'fisicoOk')} style={[styles.checkBtn, item.pruebas.fisicoOk ? styles.bgGreen : styles.bgGray]}>
                        <Text style={styles.checkTxt}>Sin Daño</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => updateDeviceCheck(activeTab, item.id, 'obstruido')} style={[styles.checkBtn, item.pruebas.obstruido ? styles.bgRed : styles.bgGray]}>
                        <Text style={styles.checkTxt}>Obstruido</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => updateDeviceCheck(activeTab, item.id, 'limpieza')} style={[styles.checkBtn, item.pruebas.limpieza ? styles.bgGreen : styles.bgGray]}>
                        <Text style={styles.checkTxt}>Limpieza</Text>
                      </TouchableOpacity>
                    </View>

                    <View style={styles.row}>
                      {['Antes', 'Durante', 'Después'].map((label, i) => (
                        <TouchableOpacity key={i} style={styles.photoBoxSmall} onPress={() => pickImage(i, activeTab, item.id)}>
                          {item.fotos[i] ? <Image source={{ uri: item.fotos[i] }} style={styles.imgPreview} onError={() => { item.fotos[i] = null; }} /> : <Text style={{ fontSize: 8 }}>{label}</Text>}
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                );
              }}
              initialNumToRender={12}
              maxToRenderPerBatch={12}
              updateCellsBatchingPeriod={40}
              windowSize={7}
              removeClippedSubviews={true}
              scrollEnabled={false}
              nestedScrollEnabled={true}
              contentContainerStyle={{ paddingBottom: 20 }}
            />
            {canLoadMoreDevices(activeTab) && (
              <TouchableOpacity style={[styles.btnLoadMore, { marginHorizontal: 15 }]} onPress={() => loadMoreDevices(activeTab)}>
                <Text style={styles.btnLoadMoreText}>CARGAR 200 MAS</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* PESTAÑA: ESTROVOCOPICAS */}
        {activeTab === 'estrovocopicas' && (
          <View style={{ flex: 1, minHeight: 500 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10, paddingHorizontal: 15 }}>
              <Text style={styles.cardTitle}>TABLA DE ESTROVOCOPICAS ({formData.estrovocopicas?.length || 0})</Text>
            </View>

            <FlatList
              data={getDevicesWithAddButton('estrovocopicas')}
              keyExtractor={(item) => (item.__add ? item.id : item.id.toString())}
              renderItem={({ item, index }) => {
                if (item.__add) {
                  return (
                    <View style={{ paddingHorizontal: 15, paddingVertical: 10 }}>
                      <TouchableOpacity style={styles.btnAdd} onPress={() => addDevice('estrovocopicas')}>
                        <Text style={{ color: BRAND.colors.ink }}>+ AGREGAR</Text>
                      </TouchableOpacity>
                    </View>
                  );
                }
                const deviceIndex = (formData.estrovocopicas || []).findIndex(d => d.id === item.id);
                const displayIndex = deviceIndex >= 0 ? deviceIndex + 1 : index + 1;
                const estado = item.estado || 'N/A';
                const reporta = item.reporta || 'N/A';
                const pruebas = item.pruebas || {};
                const tri = (value) => {
                  const normalized = String(value ?? 'N/A').trim().toUpperCase();
                  return normalized === 'SI' || normalized === 'NO' || normalized === 'N/A' ? normalized : 'N/A';
                };
                const funcional = tri(pruebas.funcional);
                const leds = tri(pruebas.leds);
                const fisicoOk = tri(pruebas.fisicoOk);
                const obstruido = tri(pruebas.obstruido);
                const limpieza = tri(pruebas.limpieza);
                return (
                  <View style={[styles.deviceItem, { marginHorizontal: 15 }]}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                      <Text style={{ fontWeight: 'bold', color: BRAND.colors.accentStrong }}>Disp #{displayIndex}</Text>
                      <TouchableOpacity onPress={() => {
                        const nuevaLista = formData.estrovocopicas.filter(d => d.id !== item.id);
                        setFormData({ ...formData, estrovocopicas: nuevaLista });
                      }}>
                        <Text style={{ color: BRAND.colors.danger, fontWeight: 'bold' }}>Eliminar</Text>
                      </TouchableOpacity>
                    </View>

                    <Text style={{ fontSize: 9, marginTop: 5, color: BRAND.colors.textMuted }}>Estado:</Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                      <TouchableOpacity
                        onPress={() => updateDevice('estrovocopicas', item.id, 'estado', 'SI')}
                        style={[styles.checkBtn, estado === 'SI' ? styles.bgGreen : styles.bgGray]}
                      >
                        <Text style={styles.checkTxt}>Si</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => updateDevice('estrovocopicas', item.id, 'estado', 'NO')}
                        style={[styles.checkBtn, estado === 'NO' ? styles.bgRed : styles.bgGray]}
                      >
                        <Text style={styles.checkTxt}>No</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => updateDevice('estrovocopicas', item.id, 'estado', 'N/A')}
                        style={[styles.checkBtn, estado === 'N/A' ? styles.bgYellow : styles.bgGray]}
                      >
                        <Text style={styles.checkTxt}>N/A</Text>
                      </TouchableOpacity>
                    </View>

                    <Text style={{ fontSize: 9, marginTop: 5, color: BRAND.colors.textMuted }}>Si reporta panel:</Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                      <TouchableOpacity
                        onPress={() => updateDevice('estrovocopicas', item.id, 'reporta', 'SI')}
                        style={[styles.checkBtn, reporta === 'SI' ? styles.bgGreen : styles.bgGray]}
                      >
                        <Text style={styles.checkTxt}>Si</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => updateDevice('estrovocopicas', item.id, 'reporta', 'NO')}
                        style={[styles.checkBtn, reporta === 'NO' ? styles.bgRed : styles.bgGray]}
                      >
                        <Text style={styles.checkTxt}>No</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => updateDevice('estrovocopicas', item.id, 'reporta', 'N/A')}
                        style={[styles.checkBtn, reporta === 'N/A' ? styles.bgYellow : styles.bgGray]}
                      >
                        <Text style={styles.checkTxt}>N/A</Text>
                      </TouchableOpacity>
                    </View>

                    <Text style={{ fontSize: 9, marginTop: 5, color: BRAND.colors.textMuted }}>Prueba funcional:</Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                      <TouchableOpacity onPress={() => updateDevicePruebaValue('estrovocopicas', item.id, 'funcional', 'SI')} style={[styles.checkBtn, funcional === 'SI' ? styles.bgGreen : styles.bgGray]}>
                        <Text style={styles.checkTxt}>Si</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => updateDevicePruebaValue('estrovocopicas', item.id, 'funcional', 'NO')} style={[styles.checkBtn, funcional === 'NO' ? styles.bgRed : styles.bgGray]}>
                        <Text style={styles.checkTxt}>No</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => updateDevicePruebaValue('estrovocopicas', item.id, 'funcional', 'N/A')} style={[styles.checkBtn, funcional === 'N/A' ? styles.bgYellow : styles.bgGray]}>
                        <Text style={styles.checkTxt}>N/A</Text>
                      </TouchableOpacity>
                    </View>

                    <Text style={{ fontSize: 9, marginTop: 5, color: BRAND.colors.textMuted }}>LEDs:</Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                      <TouchableOpacity onPress={() => updateDevicePruebaValue('estrovocopicas', item.id, 'leds', 'SI')} style={[styles.checkBtn, leds === 'SI' ? styles.bgGreen : styles.bgGray]}>
                        <Text style={styles.checkTxt}>Si</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => updateDevicePruebaValue('estrovocopicas', item.id, 'leds', 'NO')} style={[styles.checkBtn, leds === 'NO' ? styles.bgRed : styles.bgGray]}>
                        <Text style={styles.checkTxt}>No</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => updateDevicePruebaValue('estrovocopicas', item.id, 'leds', 'N/A')} style={[styles.checkBtn, leds === 'N/A' ? styles.bgYellow : styles.bgGray]}>
                        <Text style={styles.checkTxt}>N/A</Text>
                      </TouchableOpacity>
                    </View>

                    <Text style={{ fontSize: 9, marginTop: 5, color: BRAND.colors.textMuted }}>Libre de dano:</Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                      <TouchableOpacity onPress={() => updateDevicePruebaValue('estrovocopicas', item.id, 'fisicoOk', 'SI')} style={[styles.checkBtn, fisicoOk === 'SI' ? styles.bgGreen : styles.bgGray]}>
                        <Text style={styles.checkTxt}>Si</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => updateDevicePruebaValue('estrovocopicas', item.id, 'fisicoOk', 'NO')} style={[styles.checkBtn, fisicoOk === 'NO' ? styles.bgRed : styles.bgGray]}>
                        <Text style={styles.checkTxt}>No</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => updateDevicePruebaValue('estrovocopicas', item.id, 'fisicoOk', 'N/A')} style={[styles.checkBtn, fisicoOk === 'N/A' ? styles.bgYellow : styles.bgGray]}>
                        <Text style={styles.checkTxt}>N/A</Text>
                      </TouchableOpacity>
                    </View>

                    <Text style={{ fontSize: 9, marginTop: 5, color: BRAND.colors.textMuted }}>Esta obstruido:</Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                      <TouchableOpacity onPress={() => updateDevicePruebaValue('estrovocopicas', item.id, 'obstruido', 'SI')} style={[styles.checkBtn, obstruido === 'SI' ? styles.bgGreen : styles.bgGray]}>
                        <Text style={styles.checkTxt}>Si</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => updateDevicePruebaValue('estrovocopicas', item.id, 'obstruido', 'NO')} style={[styles.checkBtn, obstruido === 'NO' ? styles.bgRed : styles.bgGray]}>
                        <Text style={styles.checkTxt}>No</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => updateDevicePruebaValue('estrovocopicas', item.id, 'obstruido', 'N/A')} style={[styles.checkBtn, obstruido === 'N/A' ? styles.bgYellow : styles.bgGray]}>
                        <Text style={styles.checkTxt}>N/A</Text>
                      </TouchableOpacity>
                    </View>

                    <Text style={{ fontSize: 9, marginTop: 5, color: BRAND.colors.textMuted }}>Limpieza:</Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                      <TouchableOpacity onPress={() => updateDevicePruebaValue('estrovocopicas', item.id, 'limpieza', 'SI')} style={[styles.checkBtn, limpieza === 'SI' ? styles.bgGreen : styles.bgGray]}>
                        <Text style={styles.checkTxt}>Si</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => updateDevicePruebaValue('estrovocopicas', item.id, 'limpieza', 'NO')} style={[styles.checkBtn, limpieza === 'NO' ? styles.bgRed : styles.bgGray]}>
                        <Text style={styles.checkTxt}>No</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => updateDevicePruebaValue('estrovocopicas', item.id, 'limpieza', 'N/A')} style={[styles.checkBtn, limpieza === 'N/A' ? styles.bgYellow : styles.bgGray]}>
                        <Text style={styles.checkTxt}>N/A</Text>
                      </TouchableOpacity>
                    </View>

                    <Text style={{ fontSize: 9, marginTop: 5, color: BRAND.colors.textMuted }}>Observacion (PDF):</Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                      <TouchableOpacity
                        onPress={() => updateDevice('estrovocopicas', item.id, 'observacion', 'SI')}
                        style={[styles.checkBtn, (item.observacion || 'N/A') === 'SI' ? styles.bgGreen : styles.bgGray]}
                      >
                        <Text style={styles.checkTxt}>Si</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => updateDevice('estrovocopicas', item.id, 'observacion', 'NO')}
                        style={[styles.checkBtn, (item.observacion || 'N/A') === 'NO' ? styles.bgRed : styles.bgGray]}
                      >
                        <Text style={styles.checkTxt}>No</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => updateDevice('estrovocopicas', item.id, 'observacion', 'N/A')}
                        style={[styles.checkBtn, (item.observacion || 'N/A') === 'N/A' ? styles.bgYellow : styles.bgGray]}
                      >
                        <Text style={styles.checkTxt}>N/A</Text>
                      </TouchableOpacity>
                    </View>

                    <TextInput
                      style={[styles.input, { height: 36, marginBottom: 0 }]}
                      placeholder="Comentario"
                      value={item.comentario}
                      onChangeText={t => updateDevice('estrovocopicas', item.id, 'comentario', t)}
                    />

                    <View style={styles.row}>
                      {['Antes', 'Durante', 'Después'].map((label, i) => (
                        <TouchableOpacity key={i} style={styles.photoBoxSmall} onPress={() => pickImage(i, 'estrovocopicas', item.id)}>
                          {item.fotos[i] ? <Image source={{ uri: item.fotos[i] }} style={styles.imgPreview} onError={() => { item.fotos[i] = null; }} /> : <Text style={{ fontSize: 8 }}>{label}</Text>}
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                );
              }}
              initialNumToRender={12}
              maxToRenderPerBatch={12}
              updateCellsBatchingPeriod={40}
              windowSize={7}
              removeClippedSubviews={true}
              scrollEnabled={false}
              nestedScrollEnabled={true}
              contentContainerStyle={{ paddingBottom: 20 }}
            />
            {canLoadMoreDevices('estrovocopicas') && (
              <TouchableOpacity style={[styles.btnLoadMore, { marginHorizontal: 15 }]} onPress={() => loadMoreDevices('estrovocopicas')}>
                <Text style={styles.btnLoadMoreText}>CARGAR 200 MAS</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* PESTAÑA: PANEL */}
        {activeTab === 'panel' && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Datos del Panel</Text>
            {renderInput("Ubicación Panel", "p_ubi")}
            <View style={styles.row}>
              {renderInput("Fabricante", "p_fab", "", "48%")}
              {renderInput("Modelo", "p_mod", "", "48%")}
            </View>
            <View style={styles.row}>
              {renderInput("Voltaje Prim.", "p_vprim", "", "48%")}
              {renderInput("Voltaje Sec.", "p_vsec", "", "48%")}
            </View>

            <Text style={[styles.cardTitle, { marginTop: 15 }]}>Fuente de Poder</Text>
            {renderInput("Marca Fuente Poder", "fp_marca")}
            {renderInput("Modelo", "fp_mod")}
            {renderInput("Ubicación APS", "fp_ubicacion")}
            <View style={styles.row}>
              {renderInput("Voltaje Primario", "fp_vprim", "", "48%")}
              {renderInput("Voltaje Secundario", "fp_vsec", "", "48%")}
            </View>
            <View style={styles.row}>
              {renderInput("Voltaje Batería 1 y 2", "fp_vbat", "", "48%")}
              {renderInput("Voltaje Nac 1-2-3", "fp_vnac", "", "48%")}
            </View>
            <View style={styles.row}>
              {renderInput("Fuente sist. normal?", "fp_normal", "", "48%")}
              {renderInput("Problema nac's 1 y 2?", "fp_prob_nac12", "", "48%")}
            </View>
            <View style={styles.row}>
              {renderInput("Problema nac's 3 y 4?", "fp_prob_nac34", "", "48%")}
              {renderInput("Problema de batería?", "fp_prob_bat", "", "48%")}
            </View>
            <View style={styles.row}>
              {renderInput("Fallo a tierra?", "fp_fallo_tierra", "", "48%")}
            </View>
            {renderInput("Ubic. Tablero y No. Térmico", "fp_ubic_tablero")}

            {/* CAMBIO: SECCIÓN DE FOTOS PANEL (4 FOTOS) */}
            <Text style={[styles.cardTitle, { marginTop: 15 }]}>Evidencia Fotográfica del Panel (4)</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
              {formData.p_fotos.map((foto, idx) => (
                <TouchableOpacity
                  key={idx}
                  style={{ width: '48%', height: 100, backgroundColor: BRAND.colors.bgAlt, marginBottom: 10, borderRadius: 8, alignItems: 'center', justifyContent: 'center', borderStyle: 'dashed', borderWidth: 1, borderColor: BRAND.colors.border }}
                  onPress={() => pickImage(idx, 'panel')}
                >
                  {foto
                    ? <Image source={{ uri: foto }} style={{ width: '100%', height: '100%', borderRadius: 8 }} onError={() => { }} />
                    : <Text style={{ color: BRAND.colors.textMuted, fontSize: 10 }}>Foto {idx + 1} (+)</Text>
                  }
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Observaciones Generales</Text>
            <TextInput
              style={[styles.input, { height: 60 }]} multiline
              value={formData.p_obs} onChangeText={(v) => setFormData({ ...formData, p_obs: v })}
            />
          </View>
        )}

        {/* PESTAÑA: INCIDENCIAS */}
        {activeTab === 'incidencias' && (
          <View style={{ flex: 1, minHeight: 500 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10, paddingHorizontal: 15 }}>
              <Text style={styles.cardTitle}>REGISTRO DE INCIDENCIAS ({formData.incidencias?.length || 0})</Text>
            </View>

            <FlatList
              data={[...(formData.incidencias || []), { id: '__add__', __add: true }]}
              keyExtractor={(item) => item.id.toString()}
              renderItem={({ item, index }) => {
                if (item.__add) {
                  return (
                    <View style={{ paddingHorizontal: 15, paddingVertical: 10 }}>
                      <TouchableOpacity style={styles.btnAdd} onPress={addIncidencia}>
                        <Text style={{ color: BRAND.colors.ink }}>+ AGREGAR INCIDENCIA</Text>
                      </TouchableOpacity>
                    </View>
                  );
                }

                return (
                  <View style={[styles.deviceItem, { marginHorizontal: 15 }]}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                      <Text style={{ fontWeight: 'bold', color: BRAND.colors.accentStrong }}>Incidencia #{index + 1}</Text>
                      <TouchableOpacity onPress={() => removeIncidencia(item.id)}>
                        <Text style={{ color: BRAND.colors.danger, fontWeight: 'bold' }}>Eliminar</Text>
                      </TouchableOpacity>
                    </View>

                    <Text style={styles.label}>1. Descripción de incidencias:</Text>
                    <TextInput
                      style={[styles.input, { height: 60 }]} multiline
                      value={item.descripcion} onChangeText={t => updateIncidencia(item.id, 'descripcion', t)}
                    />
                    <TouchableOpacity style={[styles.photoBoxSmall, { width: '100%', height: 120, marginBottom: 15 }]} onPress={() => tomarFotoIncidencia(item.id, 0)}>
                      {item.fotos && item.fotos[0] ? <Image source={{ uri: item.fotos[0] }} style={styles.imgPreview} onError={() => { }} /> : <Text style={{ color: BRAND.colors.textMuted }}>+ Foto Evidencia (Descripción)</Text>}
                    </TouchableOpacity>

                    <Text style={styles.label}>2. Pruebas y diagnóstico:</Text>
                    <TextInput
                      style={[styles.input, { height: 60 }]} multiline
                      value={item.pruebas} onChangeText={t => updateIncidencia(item.id, 'pruebas', t)}
                    />
                    <TouchableOpacity style={[styles.photoBoxSmall, { width: '100%', height: 120, marginBottom: 15 }]} onPress={() => tomarFotoIncidencia(item.id, 1)}>
                      {item.fotos && item.fotos[1] ? <Image source={{ uri: item.fotos[1] }} style={styles.imgPreview} onError={() => { }} /> : <Text style={{ color: BRAND.colors.textMuted }}>+ Foto Evidencia (Pruebas)</Text>}
                    </TouchableOpacity>

                    <Text style={styles.label}>3. Solución o recomendación:</Text>
                    <TextInput
                      style={[styles.input, { height: 60 }]} multiline
                      value={item.solucion} onChangeText={t => updateIncidencia(item.id, 'solucion', t)}
                    />
                    <TouchableOpacity style={[styles.photoBoxSmall, { width: '100%', height: 120, marginBottom: 15 }]} onPress={() => tomarFotoIncidencia(item.id, 2)}>
                      {item.fotos && item.fotos[2] ? <Image source={{ uri: item.fotos[2] }} style={styles.imgPreview} onError={() => { }} /> : <Text style={{ color: BRAND.colors.textMuted }}>+ Foto Evidencia (Solución)</Text>}
                    </TouchableOpacity>
                  </View>
                );
              }}
              scrollEnabled={false}
              nestedScrollEnabled={true}
            />
          </View>
        )}

        {/* PESTAÑA: FIRMAS Y GUARDAR */}
        {activeTab === 'firmas' && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Firmas Digitales</Text>

            {/* Firma Cliente */}
            <Text style={styles.label}>Firma del Cliente:</Text>
            <TextInput style={styles.input} placeholder="Nombre de quien firma" placeholderTextColor={BRAND.colors.textMuted} value={formData.nombre_cliente_firma} onChangeText={t => setFormData({ ...formData, nombre_cliente_firma: t })} />
            <TouchableOpacity style={styles.signatureBox} onPress={() => openSignatureModal('cliente')}>
              {typeof formData.firma_cliente === 'string' && formData.firma_cliente
                ? <Image source={{ uri: formData.firma_cliente }} style={{ width: '100%', height: '100%', resizeMode: 'contain' }} onError={() => { }} />
                : <Text>Toca para firmar (Cliente)</Text>}
            </TouchableOpacity>

            {/* Firma Técnico */}
            <Text style={[styles.label, { marginTop: 20 }]}>Firma Técnico (Fire Engineers):</Text>
            <TextInput style={styles.input} placeholder="Nombre Técnico" placeholderTextColor={BRAND.colors.textMuted} value={formData.nombre_tecnico_firma} onChangeText={t => setFormData({ ...formData, nombre_tecnico_firma: t })} />
            <TouchableOpacity style={styles.signatureBox} onPress={() => openSignatureModal('tecnico')}>
              {typeof formData.firma_tecnico === 'string' && formData.firma_tecnico
                ? <Image source={{ uri: formData.firma_tecnico }} style={{ width: '100%', height: '100%', resizeMode: 'contain' }} onError={() => { }} />
                : <Text>Toca para firmar (Técnico)</Text>}
            </TouchableOpacity>

            <TouchableOpacity style={styles.btnSecondary} onPress={reSubirFotos} disabled={saving}>
              <Text style={styles.btnSecondaryText}>
                {saving ? '☁️ SINCRONIZANDO...' : '☁️ FORZAR SINCRONIZACIÓN'}
              </Text>
            </TouchableOpacity>

            {/* BOTÓN AZUL: SOLO GUARDAR (OPCIONAL) */}
            <TouchableOpacity
              style={[styles.btnSecondary, { marginTop: 30, marginBottom: 10 }]}
              onPress={guardarEnHistorial}
              disabled={saving}
            >
              <Text style={styles.btnSecondaryText}>
                {modo === 'editar' ? 'ACTUALIZAR CAMBIOS ' : 'GUARDAR BORRADOR '}
              </Text>
            </TouchableOpacity>

            {/* BOTÓN ROJO: GUARDA Y GENERA PDF */}
                        <TouchableOpacity style={styles.btnPrimary} onPress={generarPDFProfesional} disabled={saving}>
              {saving ? <ActivityIndicator color={BRAND.colors.ink} /> : <Text style={styles.btnPrimaryText}>GENERAR PDF</Text>}
            </TouchableOpacity>

            {/* Botón para generar PDF desde Excel eliminado */}
          </View>
        )}

        {/* COMPONENTE MODAL PARA FIRMAR */}
        <Modal visible={signatureModalVisible} animationType="slide">
          {signatureModalVisible && (
            <View style={{ flex: 1, marginTop: 50, backgroundColor: BRAND.colors.bg }}>
              <View style={{ padding: 20, backgroundColor: BRAND.colors.card, alignItems: 'center' }}>
                <Text style={{ fontSize: 18, fontWeight: 'bold' }}>Firma del {currentSigner === 'cliente' ? 'Cliente' : 'Técnico'}</Text>
              </View>
              <SignatureScreen
                ref={signatureRef}
                onOK={handleSignature}
                webStyle={`.m-signature-pad--footer {display: none; margin: 0px;}`}
                descriptionText="Firme aquí"
              />
              <View style={{ flexDirection: 'row', justifyContent: 'space-around', padding: 20, backgroundColor: BRAND.colors.bgAlt }}>
                <Button title="Borrar" onPress={() => signatureRef.current.clearSignature()} />
                <Button title="Guardar Firma" onPress={() => signatureRef.current.readSignature()} />
              </View>
            </View>
          )}
        </Modal>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BRAND.colors.bg },
  headerApp: { backgroundColor: BRAND.colors.cardAlt, padding: 15, paddingTop: 50, borderBottomWidth: 1, borderBottomColor: BRAND.colors.border },
  headerTitle: { color: BRAND.colors.text, fontSize: 18, fontFamily: BRAND.fonts.title, letterSpacing: 0.6 },

  tabContainer: { flexDirection: 'row', backgroundColor: BRAND.colors.bgAlt, padding: 6, borderBottomWidth: 1, borderBottomColor: BRAND.colors.border },
  tab: { padding: 10, marginRight: 10 },
  activeTab: { borderBottomWidth: 2, borderColor: BRAND.colors.accent },
  tabText: { fontSize: 10, color: BRAND.colors.textMuted, fontFamily: BRAND.fonts.body },
  activeTabText: { color: BRAND.colors.accentStrong, fontFamily: BRAND.fonts.semi },

  content: { flex: 1, padding: 10 },
  card: { backgroundColor: BRAND.colors.card, padding: 15, borderRadius: BRAND.radius.lg, marginBottom: 15, borderWidth: 1, borderColor: BRAND.colors.border },
  cardTitle: { fontFamily: BRAND.fonts.semi, color: BRAND.colors.accentStrong, marginBottom: 10, fontSize: 14 },

  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 10, marginBottom: 5 },
  label: { fontSize: 10, color: BRAND.colors.textMuted, marginBottom: 2, fontFamily: BRAND.fonts.semi },
  input: { borderWidth: 1, borderColor: BRAND.colors.border, borderRadius: BRAND.radius.md, padding: 8, backgroundColor: BRAND.colors.bgAlt, fontSize: 12, marginBottom: 10, color: BRAND.colors.text, fontFamily: BRAND.fonts.body },
  inputCompact: { borderWidth: 1, borderColor: BRAND.colors.border, borderRadius: BRAND.radius.md, padding: 5, backgroundColor: BRAND.colors.bgAlt, fontSize: 11, marginRight: 5, color: BRAND.colors.text, fontFamily: BRAND.fonts.body },

  photoBoxSmall: { width: 70, height: 70, backgroundColor: BRAND.colors.bgAlt, borderRadius: BRAND.radius.sm, alignItems: 'center', justifyContent: 'center', marginTop: 5, borderWidth: 1, borderColor: BRAND.colors.border },
  imgPreview: { width: '100%', height: '100%', borderRadius: BRAND.radius.sm },

  deviceItem: { backgroundColor: BRAND.colors.cardAlt, padding: 10, borderRadius: BRAND.radius.md, marginBottom: 10, borderWidth: 1, borderColor: BRAND.colors.border },
  btnAdd: { backgroundColor: BRAND.colors.accent, paddingHorizontal: 15, paddingVertical: 6, borderRadius: BRAND.radius.md },
  btnLoadMore: { backgroundColor: BRAND.colors.bgAlt, paddingHorizontal: 15, paddingVertical: 8, borderRadius: BRAND.radius.md, marginTop: 10, borderWidth: 1, borderColor: BRAND.colors.border },
  btnLoadMoreText: { color: BRAND.colors.text, textAlign: 'center', fontFamily: BRAND.fonts.semi, fontSize: 12 },

  checkBtn: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: BRAND.radius.sm, marginRight: 6, marginBottom: 6, minWidth: 46, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
  bgGreen: { backgroundColor: '#16a34a', borderColor: '#4ade80' },
  bgRed: { backgroundColor: '#dc2626', borderColor: '#f87171' },
  bgYellow: { backgroundColor: '#ca8a04', borderColor: '#fbbf24' },
  bgGray: { backgroundColor: '#4b5563', borderColor: '#9ca3af' },
  checkTxt: { fontSize: 13, color: '#ffffff', fontWeight: '700' },

  signatureBox: { height: 150, borderWidth: 1, borderColor: BRAND.colors.border, borderStyle: 'dashed', marginTop: 5, alignItems: 'center', justifyContent: 'center', backgroundColor: BRAND.colors.bgAlt },
  btnPrimary: { backgroundColor: BRAND.colors.accent, padding: 15, borderRadius: BRAND.radius.md, alignItems: 'center', marginTop: 10 },
  btnSecondary: { backgroundColor: BRAND.colors.cardAlt, padding: 15, borderRadius: BRAND.radius.md, alignItems: 'center', borderWidth: 1, borderColor: BRAND.colors.border },
  btnPrimaryText: { color: BRAND.colors.ink, fontFamily: BRAND.fonts.semi },
  btnSecondaryText: { color: BRAND.colors.text, fontFamily: BRAND.fonts.semi }
});
