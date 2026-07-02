import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Image, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
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
import { getSafeMisReportes, downloadReportAssets, enqueueBackup, imageUriToDataUrl, imageUriToLocalUri, migrateReportPhotoUris, optimizeReportForStorage, persistPhotoUri, persistSignatureDataUrl, reuploadReportAssets, sanitizeReportsForStorage, savePhotoToGallery, saveUserSnapshot, saveWithSpaceCheck, signatureUriToDataUrl } from '../utils/backup';
import { buildExactPdfHeader, PDF_EXACT_HEADER_STYLES, PDF_PRINT_SAFE_STYLES } from '../utils/pdfHeader';
import { printHtmlToPdf, sharePdfUri } from '../utils/pdfExport';

export default function ReporteHidrantes() {
  const { cliente, datosPrevios, modo, idOriginal, logoCliente } = useLocalSearchParams();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('general');
  const [signatureModalVisible, setSignatureModalVisible] = useState(false);
  const [currentSigner, setCurrentSigner] = useState(null);
  const signatureRef = useRef();
  const resolvedIdRef = useRef(null);
  const LIST_PAGE_SIZE = 200;
  const [listPages, setListPages] = useState({ hidrantes: 1, incidencias: 1 });

  // --- ESTADO DEL FORMULARIO ---
  const [formData, setFormData] = useState({
    fecha: '',
    logo_cliente: logoCliente || null,

    // 1. GENERAL - Datos del cliente
    cliente_nombre: '',
    cliente_direccion: '',
    cliente_contacto: '',
    cliente_telefono: '',
    cliente_correo: '',
    sucursal: 'Norte',

    // Datos de la empresa que presta el servicio
    empresa_nombre: '',
    empresa_representante: '',
    empresa_telefono: '',
    empresa_correo: '',
    empresa_especialista: '',
    h_ejecutivo: '',
    h_email_ejecutivo: '',
    h_cel: '',
    h_tel_oficina: '',
    h_tecnico: '',
    h_sistema: 'RED DE HIDRANTES',

    // Datos del servicio
    predio: '',
    hora_inicio: '',
    hora_final: '',
    cantidad_hidrantes: '',

    // Aviso previo
    aviso_departamento: '',
    aviso_responsable: '',
    logo_cliente: null,
    sucursal: 'Matriz Toluquilla',

    // 4. FIRMAS
    observaciones_finales: '',

    // 2. HIDRANTES
    hidrantes: [
      {
        id: 1,
        numero: '',
        presion: '',
        ubicacion: '',
        manguera: '',
        obstruido: '',
        sin_dano: '',
        valvula: '',
        accesorios: '',
        identificado: '',
        espuma_dosificador: '',
        cristal: '',
        obs_id: '',
        fotos: { antes: null, prueba: null, despues: null }
      }
    ],

    // 3. INCIDENCIAS
    incidencias: [
      { id: 1, descripcion: '', pruebas: '', solucion: '', fotos_descripcion: [], fotos_pruebas: [], fotos_solucion: [] }
    ],

    firma_cliente: null,
    firma_tecnico: null,
    nombre_cliente_firma: '',
    nombre_tecnico_firma: ''
  });

  // Actualizar automáticamente la cantidad de hidrantes
  useEffect(() => {
    setFormData(prevFormData => ({
      ...prevFormData,
      cantidad_hidrantes: (prevFormData.hidrantes?.length || 0).toString()
    }));
  }, [formData.hidrantes?.length]);

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
      console.warn('saveHydratedToLocal failed (hidrantes)', e);
    }
  };

  useEffect(() => {
    const cargarDatosTemporales = async () => {
      try {
        const datosTemporales = await AsyncStorage.getItem('reporte_temporal');

        if (datosTemporales) {
          const datos = JSON.parse(datosTemporales);
          await AsyncStorage.removeItem('reporte_temporal');

          // Asegurar que los arrays existan
          const datosCorregidos = {
            ...datos,
            logo_cliente: datos?.logo_cliente || null,
            sucursal: datos?.sucursal || 'Matriz Toluquilla',
            hidrantes: Array.isArray(datos.hidrantes) ? datos.hidrantes : [{ id: 1, numero: '', presion: '', ubicacion: '', manguera: '', obstruido: '', sin_dano: '', valvula: '', accesorios: '', identificado: '', espuma_dosificador: '', cristal: '', obs_id: '', fotos: { antes: null, prueba: null, despues: null } }],
            incidencias: Array.isArray(datos.incidencias) ? datos.incidencias : [{ id: 1, descripcion: '', pruebas: '', solucion: '', fotos_descripcion: [], fotos_pruebas: [], fotos_solucion: [] }]
          };

          const migrated = await migrateReportPhotoUris(datosCorregidos, datosCorregidos.id || idOriginal);
          const downloadResult = await downloadReportAssets(migrated);
          const hydrated = downloadResult?.report || migrated;

          if (modo === 'clonar') {
            const cloned = {
              ...hydrated,
              id: Date.now(),
              fecha: new Date().toLocaleDateString(),
              firma_cliente: null,
              firma_tecnico: null,
              logo_cliente: hydrated?.logo_cliente || null,
              sucursal: hydrated?.sucursal || 'Matriz Toluquilla',
              hidrantes: hydrated.hidrantes.map(h => ({ ...h, numero: h?.numero ?? '', fotos: { antes: null, prueba: null, despues: null } })),
              incidencias: [{ id: 1, descripcion: '', pruebas: '', solucion: '', fotos_descripcion: [], fotos_pruebas: [], fotos_solucion: [] }]
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
      } catch (e) {
        console.log(e);
      }
    };

    cargarDatosTemporales();
  }, [modo]);

  // Si se crea un nuevo reporte, jalar automáticamente el nombre del cliente
  useEffect(() => {
    if (cliente && modo !== 'editar' && modo !== 'clonar') {
      setFormData(prev => ({
        ...prev,
        cliente_nombre: cliente
      }));
    }
  }, [cliente, modo]);

  // --- FUNCIONES HIDRANTES ---
  const agregarHidrante = () => {
    const nuevoId = formData.hidrantes.length + 1;
    const nextList = [...formData.hidrantes, {
      id: nuevoId,
      numero: '',
      presion: '',
      ubicacion: '',
      manguera: '',
      obstruido: '',
      sin_dano: '',
      valvula: '',
      accesorios: '',
      identificado: '',
      espuma_dosificador: '',
      cristal: '',
      obs_id: '',
      fotos: { antes: null, prueba: null, despues: null }
    }];
    setFormData({
      ...formData,
      hidrantes: nextList
    });
    const pagesNeeded = Math.ceil(nextList.length / LIST_PAGE_SIZE) || 1;
    setListPages((prev) => {
      const current = prev.hidrantes || 1;
      return pagesNeeded > current ? { ...prev, hidrantes: pagesNeeded } : prev;
    });
  };

  const eliminarHidrante = (index) => {
    Alert.alert("Eliminar", "¿Borrar este hidrante?", [
      { text: "Cancelar" },
      {
        text: "Sí", onPress: () => {
          const nuevaLista = [...formData.hidrantes];
          nuevaLista.splice(index, 1);
          const listaRenumerada = nuevaLista.map((item, idx) => ({ ...item, id: idx + 1 }));
          setFormData({ ...formData, hidrantes: listaRenumerada });
        }
      }
    ]);
  };

  const updateHidrante = (index, field, value) => {
    const nuevaLista = [...formData.hidrantes];
    nuevaLista[index][field] = value;
    setFormData({ ...formData, hidrantes: nuevaLista });
  };

  const tomarFotoHidrante = async (index, tipoFoto) => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (permission.status !== 'granted') {
      Alert.alert("Permiso denegado", "Se necesita acceso a la cámara.");
      return;
    }
    let result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.5,
      base64: false,
    });
    if (!result.canceled) {
      const nuevaLista = [...formData.hidrantes];
      const reportKey = resolveReportId();
      await savePhotoToGallery(result.assets[0].uri);
      const storedUri = await persistPhotoUri(result.assets[0].uri, reportKey, `hidrante_${index}_${tipoFoto}`);
      nuevaLista[index].fotos[tipoFoto] = storedUri;
      setFormData({ ...formData, hidrantes: nuevaLista });
    }
  };

  // --- FUNCIONES INCIDENCIAS ---
  const agregarIncidencia = () => {
    const nuevoId = formData.incidencias.length + 1;
    const nextList = [...formData.incidencias, { id: nuevoId, descripcion: '', pruebas: '', solucion: '', fotos_descripcion: [], fotos_pruebas: [], fotos_solucion: [] }];
    setFormData({
      ...formData,
      incidencias: nextList
    });
    const pagesNeeded = Math.ceil(nextList.length / LIST_PAGE_SIZE) || 1;
    setListPages((prev) => {
      const current = prev.incidencias || 1;
      return pagesNeeded > current ? { ...prev, incidencias: pagesNeeded } : prev;
    });
  };

  const eliminarIncidencia = (index) => {
    Alert.alert("Eliminar", "¿Borrar esta incidencia?", [
      { text: "Cancelar" },
      {
        text: "Sí", onPress: () => {
          const nuevaLista = [...formData.incidencias];
          nuevaLista.splice(index, 1);
          const listaRenumerada = nuevaLista.map((item, idx) => ({ ...item, id: idx + 1 }));
          setFormData({ ...formData, incidencias: listaRenumerada });
        }
      }
    ]);
  };

  const updateIncidencia = (index, field, value) => {
    const nuevaLista = [...formData.incidencias];
    nuevaLista[index][field] = value;
    setFormData({ ...formData, incidencias: nuevaLista });
  };

  const tomarFotoIncidencia = async (index, tipo) => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (permission.status !== 'granted') return Alert.alert("Error", "Se requiere cámara.");

    let result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.5,
      base64: false,
    });

    if (!result.canceled) {
      const nuevaLista = [...formData.incidencias];
      const reportKey = resolveReportId();
      await savePhotoToGallery(result.assets[0].uri);
      const fotoList = nuevaLista[index][tipo] || [];
      const storedUri = await persistPhotoUri(result.assets[0].uri, reportKey, `incidencia_${index}_${tipo}_${fotoList.length}`);
      fotoList.push(storedUri);
      nuevaLista[index][tipo] = fotoList;
      setFormData({ ...formData, incidencias: nuevaLista });
    }
  };

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

  const getListPage = (key) => listPages[key] || 1;
  const getVisibleList = (key) => (formData[key] || []).slice(0, getListPage(key) * LIST_PAGE_SIZE);
  const canLoadMoreList = (key) => (formData[key]?.length || 0) > getListPage(key) * LIST_PAGE_SIZE;
  const loadMoreList = (key) => {
    setListPages((prev) => ({ ...prev, [key]: (prev[key] || 1) + 1 }));
  };
  const getListWithAddButton = (key) => {
    const visible = getVisibleList(key);
    if (visible.length === 0) return [{ id: `__add__${key}`, __add: true }];
    const insertIndex = Math.max(visible.length - 1, 0);
    const next = [...visible];
    next.splice(insertIndex, 0, { id: `__add__${key}`, __add: true });
    return next;
  };

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

  // --- GUARDADO ---
  const guardar = async () => {
    if (!formData.cliente_nombre) return Alert.alert("Error", "Falta nombre cliente");
    setSaving(true);
    try {
      const reporte = {
        ...formData,
        cliente: formData.cliente_nombre,
        g_fecha: formData.fecha,
        g_predio: formData.predio,
        id: resolveReportId(),
        titulo: `Hidrantes - ${formData.cliente_nombre}`,
        tipo: 'Hidrantes',
        fechaGuardado: new Date().toLocaleString(),
        ultimoCambio: new Date().toISOString()
      };

      // Sin límite de imágenes: se permite agregar todas las necesarias

      let historial = await getSafeMisReportes();
      historial = sanitizeReportsForStorage(historial, { keepLocal: true });

      // Optimizar el reporte antes de guardar (reduce tamaño drasticamente: remove base64 firmas, local URIs)
      const reporteOptimizado = optimizeReportForStorage(reporte, { keepLocal: true });

      const reportId = resolveReportId();
      const idx = historial.findIndex(r => String(r.id) === String(reportId));
      if (idx >= 0) historial[idx] = reporteOptimizado;
      else historial.push(reporteOptimizado);

      await saveWithSpaceCheck('mis_reportes', JSON.stringify(historial));
      try { await saveUserSnapshot(); } catch (e) { }

      // Encolar el reporte para sincronización en la nube cuando haya internet
      enqueueBackup(reporte).catch(e => console.warn('Backup queue failed:', e));

      Alert.alert("Éxito", "Reporte guardado localmente. Se sincronizará con la nube cuando tengas internet.");
    } catch (e) {
      Alert.alert("Error", e.message);
    } finally {
      setSaving(false);
    }
  };

  // --- PDF GENERATOR ---
  const generarPDF = async () => {

    setSaving(true);

    try {
      const reporte = {
        ...formData,
        cliente: formData.cliente_nombre,
        g_fecha: formData.fecha,
        g_predio: formData.predio,
        id: resolveReportId(),
        titulo: `Hidrantes - ${formData.cliente_nombre}`,
        tipo: 'Hidrantes',
        fechaGuardado: new Date().toLocaleString(),
        ultimoCambio: new Date().toISOString()
      };

      try {
        enqueueBackup(reporte).catch(e => console.warn('Backup queue failed:', e));
      } catch (e) {
        console.warn('Backup queue failed (hidrantes pdf):', e);
      }

      const firmaCliente = await signatureUriToDataUrl(formData.firma_cliente);
      const firmaTecnico = await signatureUriToDataUrl(formData.firma_tecnico);

      const hidrantesPdf = [];
      for (let i = 0; i < (formData.hidrantes || []).length; i++) {
        const h = formData.hidrantes[i];
        hidrantesPdf.push({
          ...h,
          fotos: {
            antes: await imageUriToDataUrl(h?.fotos?.antes, { maxWidth: 200, compress: 0.4 }),
            prueba: await imageUriToDataUrl(h?.fotos?.prueba, { maxWidth: 200, compress: 0.4 }),
            despues: await imageUriToDataUrl(h?.fotos?.despues, { maxWidth: 200, compress: 0.4 })
          }
        });
        // Delay to allow Garbage Collector to free up native memory
        if (i % 2 === 0) await new Promise(resolve => setTimeout(resolve, 50));
      }

      const incidenciasPdf = [];
      for (let i = 0; i < (formData.incidencias || []).length; i++) {
        const inc = formData.incidencias[i];
        const fotos_descripcion = [];
        for (const uri of (inc.fotos_descripcion || [])) {
          fotos_descripcion.push(await imageUriToDataUrl(uri, { maxWidth: 200, compress: 0.4 }));
        }
        const fotos_pruebas = [];
        for (const uri of (inc.fotos_pruebas || [])) {
          fotos_pruebas.push(await imageUriToDataUrl(uri, { maxWidth: 200, compress: 0.4 }));
        }
        const fotos_solucion = [];
        for (const uri of (inc.fotos_solucion || [])) {
          fotos_solucion.push(await imageUriToDataUrl(uri, { maxWidth: 200, compress: 0.4 }));
        }
        incidenciasPdf.push({
          ...inc,
          fotos_descripcion,
          fotos_pruebas,
          fotos_solucion
        });
        // Delay to allow Garbage Collector to free up native memory
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      const hidrantesHeader = `
      <thead>
        <tr>
          <th colspan="14" class="stair-banner">Cuestionario de revisión a Cañones monitor e hidrantes de banqueta</th>
        </tr>
        <tr>
          <th rowspan="12" class="stair-col col-white">A</th>
          <th colspan="13" class="stair-row col-white text-right" style="color: #000;">A: Numero de hidrante</th>
        </tr>
        <tr>
          <th rowspan="11" class="stair-col col-blue">B</th>
          <th colspan="12" class="stair-row col-blue text-right" style="color: #0070c0;">B: Tiene llave para ajustar coples o para abrir el hidrante?</th>
        </tr>
        <tr>
          <th rowspan="10" class="stair-col col-white">C</th>
          <th colspan="11" class="stair-row col-white text-right" style="color: #000;">C: Ubicación de Hidrante</th>
        </tr>
        <tr>
          <th rowspan="9" class="stair-col col-blue">D</th>
          <th colspan="10" class="stair-row col-blue text-right" style="color: #0070c0;">D: La Boquilla esta en buenas condiciones libre de daño fisico o meteria extraña?</th>
        </tr>
        <tr>
          <th rowspan="8" class="stair-col col-white">E</th>
          <th colspan="9" class="stair-row col-white text-right" style="color: #000;">E: El Hidrante está obstruido?</th>
        </tr>
        <tr>
          <th rowspan="7" class="stair-col col-blue">F</th>
          <th colspan="8" class="stair-row col-blue text-right" style="color: #0070c0;">F: El hidrantes esta libre de daño físico o materia extraña?</th>
        </tr>
        <tr>
          <th rowspan="6" class="stair-col col-white">G</th>
          <th colspan="7" class="stair-row col-white text-right" style="color: #000;">G: La Válvula esta libre de fugas y/o daño físico?</th>
        </tr>
        <tr>
          <th rowspan="5" class="stair-col col-blue">H</th>
          <th colspan="6" class="stair-row col-blue text-right" style="color: #0070c0;">H: El hidrante esta engrasado correctamente? (Rotar el Cañon monitor)</th>
        </tr>
        <tr>
          <th rowspan="4" class="stair-col col-white">I</th>
          <th colspan="5" class="stair-row col-white text-right" style="color: #000;">I: El hidrante cuenta con señalamiento , numeración o zona?</th>
        </tr>
        <tr>
          <th rowspan="3" class="stair-col col-blue">J</th>
          <th colspan="4" class="stair-row col-blue text-right" style="color: #0070c0;">J: Concentrado de espuma y dosificador están en buenas condiciones</th>
        </tr>
        <tr>
          <th rowspan="2" class="stair-col col-white">K</th>
          <th colspan="3" class="stair-row col-white text-right" style="color: #000;">K: No. De observación. (detallar al final del reporte)?</th>
        </tr>
        <tr>
          <th class="stair-col col-white" style="font-size:7px; color:#000;">ANTES O PRUEBA</th>
          <th class="stair-col col-white" style="font-size:7px; color:#000;">DURANTE</th>
          <th class="stair-col col-white" style="font-size:7px; color:#000;">DESPUÉS</th>
        </tr>
      </thead>
    `;

      const hidrantesHeaderSimple = `
      <thead>
        <tr>
          <th class="stair-col col-white">A</th>
          <th class="stair-col col-blue">B</th>
          <th class="stair-col col-white">C</th>
          <th class="stair-col col-blue">D</th>
          <th class="stair-col col-white">E</th>
          <th class="stair-col col-blue">F</th>
          <th class="stair-col col-white">G</th>
          <th class="stair-col col-blue">H</th>
          <th class="stair-col col-white">I</th>
          <th class="stair-col col-blue">J</th>
          <th class="stair-col col-white">K</th>
          <th class="stair-col col-white" style="font-size:7px; color:#000;">ANTES O PRUEBA</th>
          <th class="stair-col col-white" style="font-size:7px; color:#000;">DURANTE</th>
          <th class="stair-col col-white" style="font-size:7px; color:#000;">DESPUÉS</th>
        </tr>
      </thead>
    `;

      const hidrantesColgroup = `
      <colgroup>
        <col style="width:4.808%" />
        <col style="width:5.021%" />
        <col style="width:24.038%" />
        <col style="width:4.487%" />
        <col style="width:4.487%" />
        <col style="width:4.487%" />
        <col style="width:4.487%" />
        <col style="width:4.487%" />
        <col style="width:4.487%" />
        <col style="width:4.487%" />
        <col style="width:3.846%" />
        <col style="width:10.363%" />
        <col style="width:10.256%" />
        <col style="width:10.256%" />
      </colgroup>
    `;

      const hidrantesFilas = hidrantesPdf.map(h => `
        <tr class="hidrantes-answer">
          <td class="center">${h.numero || ''}</td>
          <td class="center">${h.presion}</td>
          <td>${h.ubicacion}</td>
          <td class="center">${h.manguera}</td>
          <td class="center">${h.obstruido}</td>
          <td class="center">${h.sin_dano}</td>
          <td class="center">${h.valvula}</td>
          <td class="center">${h.accesorios}</td>
          <td class="center">${h.identificado}</td>
          <td class="center">${h.espuma_dosificador || '-'}</td>
          <td class="center">${h.cristal || '-'}</td>
          <td>
            <div>${h.obs_id || ''}</div>
            <div>${h.fotos.antes ? `<img src="${h.fotos.antes}" style="width:40px;height:40px;object-fit:cover;">` : '-'}</div>
          </td>
          <td class="center">${h.fotos.prueba ? `<img src="${h.fotos.prueba}" style="width:40px;height:40px;object-fit:cover;">` : '-'}</td>
          <td class="center">${h.fotos.despues ? `<img src="${h.fotos.despues}" style="width:40px;height:40px;object-fit:cover;">` : '-'}</td>
        </tr>
      `).join('');

      const hidrantesTables = `
        <table class="hidrantes-table" style="page-break-inside: auto;">
          ${hidrantesColgroup}
          ${hidrantesHeader}
          <tbody>
            ${hidrantesFilas}
          </tbody>
        </table>
      `;

      const incidenciasHeader = `
      <thead>
        <tr style="background-color: #d9d9d9;">
          <th width="5%" class="center" style="color: #0070c0;">No.</th>
          <th width="31%" class="center">DESCRIPCION DE INCIDENCIAS/ EVIDENCIA GRAFICA</th>
          <th width="31%" class="center">PRUEBAS Y DIAGNOSTICO / EVIDENCIAS GRAFICA</th>
          <th width="33%" class="center">SOLUCIÓN O RECOMENDACIÓN / EVIDENCIA GRAFICA</th>
        </tr>
      </thead>
    `;

      const incidenciasTables = incidenciasPdf.map(inc => {
        const fotosDescripcionHtml = (inc.fotos_descripcion || []).map(foto => `<img src="${foto}" style="width:60px;height:60px;margin:2px;object-fit:cover;">`).join('');
        const fotosPruebasHtml = (inc.fotos_pruebas || []).map(foto => `<img src="${foto}" style="width:60px;height:60px;margin:2px;object-fit:cover;">`).join('');
        const fotosSolucionHtml = (inc.fotos_solucion || []).map(foto => `<img src="${foto}" style="width:60px;height:60px;margin:2px;object-fit:cover;">`).join('');
        const row = `
          <tr>
            <td class="center" style="color: #0070c0; font-weight: bold; vertical-align: middle; height: 80px;">${inc.id}</td>
            <td style="vertical-align:top; text-align:left; padding:5px;">${inc.descripcion || ''}</td>
            <td style="vertical-align:top; text-align:left; padding:5px;">${inc.pruebas || ''}</td>
            <td style="vertical-align:top; text-align:left; padding:5px;">${inc.solucion || ''}</td>
          </tr>
          <tr>
            <td class="center" style="color: #0070c0; vertical-align: middle; font-size: 8px; height: 100px;">IMAGEN</td>
            <td style="vertical-align:middle; text-align:center; padding:5px;">${fotosDescripcionHtml || ''}</td>
            <td style="vertical-align:middle; text-align:center; padding:5px;">${fotosPruebasHtml || ''}</td>
            <td style="vertical-align:middle; text-align:center; padding:5px;">${fotosSolucionHtml || ''}</td>
          </tr>
        `;
        return `
          <table class="incidencias-table" style="page-break-inside: avoid; margin-bottom: 12px;">
            ${incidenciasHeader}
            <tbody>
              ${row}
            </tbody>
          </table>
        `;
      }).join('');

      const clienteLogoData = await imageUriToDataUrl(formData.logo_cliente, { maxWidth: 700, compress: 0.9 });

      const generalDesignHtml = await buildExactPdfHeader({
        title: 'REPORTE DE MANTENIMIENTO RED DE HIDRANTE',
        logoCliente: clienteLogoData,
        sucursal: formData.sucursal,
        meta: `${formData.fecha || formData.h_fecha || ''} | ${formData.cliente_nombre || formData.h_cliente || '-'} | ${formData.empresa_nombre || '-'}`,
        fields: {
          fecha: formData.fecha,
          ejecutivo: formData.h_ejecutivo || formData.empresa_representante,
          emailEjecutivo: formData.h_email_ejecutivo || formData.empresa_correo,
          cel: formData.h_cel,
          telOficina: formData.h_tel_oficina || formData.empresa_telefono,
          tecnico: formData.h_tecnico || formData.empresa_especialista,
          sistema: formData.h_sistema || 'RED DE HIDRANTES',
          cliente: formData.cliente_nombre,
          contacto: formData.cliente_contacto,
          departamentoSupervisor: formData.aviso_departamento,
          telCliente: formData.cliente_telefono,
          emailCliente: formData.cliente_correo,
          predio: formData.predio,
          direccion: formData.cliente_direccion,
          horaInicio: formData.hora_inicio,
          horaFinal: formData.hora_final,
          responsableDepto: formData.aviso_responsable,
          cant_hidrantes: formData.cantidad_hidrantes
        }
      });

      const htmlHidrantes = `
      <html>
      <head>
        <style>
          ${PDF_PRINT_SAFE_STYLES}
          body { font-family: Arial, sans-serif; font-size: 10px; padding: 0; color: #111827; }
          ${PDF_EXACT_HEADER_STYLES}
          .fe-data-table, .fe-data-table td, .fe-data-table th, .fe-specialist-row td { font-size: 10px !important; }
          .fe-title-row th { font-size: 12px !important; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 4px; page-break-inside: auto; }
          thead { display: table-header-group; }
          tbody { display: table-row-group; }
          tr { page-break-inside: avoid; page-break-after: auto; break-inside: avoid; }
          td, th { break-inside: avoid; }
          td, th { border: 1px solid #000; padding: 2px; vertical-align: middle; font-size: 9px; }
          .report-header { text-align: center; margin-bottom: 5px; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px; }
          .brand { font-size: 16px; font-weight: bold; }
            .brand-fire { color: #ff6b6b; }
          .brand-eng { color: #1f4aa8; }
          .brand-sub { font-size: 10px; color: #6b7280; }
          .report-title { font-size: 12px; font-weight: bold; color: #1f2937; margin-top: 4px; }
          .meta { font-size: 10px; color: #6b7280; margin-top: 2px; }

          .label { background: #f3f4f6; font-weight: bold; width: 12%; text-align: right; padding-right:5px; color: #111827; font-size: 10px; }
          .value { width: 38%; padding-left:5px; font-size: 10px; }
          .center { text-align: center; }
          .blue-header { background-color: #f3f4f6; color: #111827; font-weight: bold; text-align: center; font-size: 10px; }
          .hidrantes-table { table-layout: fixed; page-break-inside: auto; }
          .stair-banner { background-color: #0070c0; color: white; border: 1px solid #000; text-align: center; padding: 2px; font-weight: bold; font-size: 11px; }
          .stair-row { font-size: 9px; font-weight: bold; text-align: right; padding-right: 4px; border: 1px solid #000; height: 10px; }
          .stair-col { font-size: 9px; font-weight: bold; text-align: center; vertical-align: bottom; border: 1px solid #000; padding: 1px; color: #0070c0; }
          .col-blue { background-color: #c0d8f0 !important; }
          .col-white { background-color: #ffffff !important; }
          .text-right { text-align: right; }
          .hidrantes-answer { page-break-inside: avoid; break-inside: avoid; }
          .hidrantes-answer td { height: 42px; vertical-align: top; background: #f8f8f8; }
          @page { margin: 5mm 5mm 5mm 5mm !important; }
          .hidrantes-answer td:nth-child(2),
          .hidrantes-answer td:nth-child(4),
          .hidrantes-answer td:nth-child(6),
          .hidrantes-answer td:nth-child(8),
          .hidrantes-answer td:nth-child(10) { background: #c0d8f0; }
          .hidrantes-answer td:nth-child(12),
          .hidrantes-answer td:nth-child(13),
          .hidrantes-answer td:nth-child(14) { background: #ffffff; }
          .red-header { background-color: #f3f4f6; color: #111827; font-weight: bold; text-align: center; font-size: 10px; }
          .obs-box { border: 1px solid #e5e7eb; min-height: 40px; padding: 4px; margin-bottom: 0; border-bottom: none; }
          .report-footer { margin-top: 10px; page-break-inside: avoid; }
          .footer-note { font-size: 10px; color: #374151; text-align: center; margin-bottom: 8px; }
          .signatures-table { width: 100%; margin-top: 12px; page-break-inside: avoid; }
          .sig-cell { width: 45%; text-align: center; vertical-align: bottom; height: 100px; }
          .sig-line { border-top: 1px solid #111827; width: 80%; margin: 0 auto; padding-top: 5px; color: #111827; font-weight: bold; }
          .sig-img { height: 80px; max-width: 200px; }

          .gen-wrap { border: 1px solid #0d6fb8; margin-bottom: 10px; }
          .gen-top-logos { width: 100%; border-collapse: collapse; margin: 0; }
          .gen-top-logos td { border: none; height: 70px; text-align: center; vertical-align: middle; }
          .logo-cell { width: 33.33%; }
          .nfpa-logo { max-height: 62px; max-width: 95%; object-fit: contain; }
          .fire-logo { max-height: 62px; max-width: 95%; object-fit: contain; }
          .client-logo { max-height: 62px; max-width: 95%; object-fit: contain; }
          .client-logo-empty { color: #6b7280; font-size: 10px; font-weight: bold; }

        </style>
      </head>
      <body>
        <table style="width: 100%; border: none;">
          <thead class="page-number-header">
            <tr><td class="page-number-cell"></td></tr>
          </thead>
          <tbody>
            <tr>
              <td style="border: none; padding: 0;">
                ${generalDesignHtml}
                ${hidrantesTables}
                <br>
                <div class="obs-box">
                    <b>observaciones:</b><br/>
                    ${formData.observaciones_finales}
                </div>
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
              </td>
            </tr>
          </tbody>
        </table>
      </body>
      </html>
    `;
      const htmlIncidencias = `
      <html>
      <head>
        <style>
          ${PDF_PRINT_SAFE_STYLES}
          body { font-family: Arial, sans-serif; font-size: 10px; padding: 0; color: #111827; }
          ${PDF_EXACT_HEADER_STYLES}
          table { width: 100%; border-collapse: collapse; margin-bottom: 4px; page-break-inside: auto; }
          thead { display: table-header-group; }
          tbody { display: table-row-group; }
          tr { page-break-inside: avoid; page-break-after: auto; break-inside: avoid; }
          td, th { break-inside: avoid; }
          td, th { border: 1px solid #e5e7eb; padding: 4px; vertical-align: middle; }
          .report-header { text-align: center; margin-bottom: 10px; border-bottom: 1px solid #e5e7eb; padding-bottom: 6px; }
          .brand { font-size: 16px; font-weight: bold; }
            .brand-fire { color: #ff6b6b; }
          .brand-eng { color: #1f4aa8; }
          .brand-sub { font-size: 9px; color: #6b7280; }
          .report-title { font-size: 12px; font-weight: bold; color: #1f2937; margin-top: 4px; }
          .meta { font-size: 9px; color: #6b7280; margin-top: 2px; }

          .label { background: #f3f4f6; font-weight: bold; width: 12%; text-align: right; padding-right:5px; color: #111827; }
          .value { width: 38%; padding-left:5px; }
          .center { text-align: center; }
          .red-header { background-color: #f3f4f6; color: #111827; font-weight: bold; text-align: center; font-size: 9px; }
          .obs-box { border: 1px solid #e5e7eb; min-height: 50px; padding: 6px; margin-bottom: 0; border-bottom: none; }
          .report-footer { margin-top: 24px; page-break-inside: avoid; }
          .footer-note { font-size: 8px; color: #374151; text-align: center; margin-bottom: 8px; }
          .signatures-table { width: 100%; margin-top: 12px; page-break-inside: avoid; }
          .sig-cell { width: 45%; text-align: center; vertical-align: bottom; height: 100px; }
          .sig-line { border-top: 1px solid #111827; width: 80%; margin: 0 auto; padding-top: 5px; color: #111827; font-weight: bold; }
          .sig-img { height: 80px; max-width: 200px; }

          .gen-wrap { border: 1px solid #0d6fb8; margin-bottom: 10px; }
          .gen-top-logos { width: 100%; border-collapse: collapse; margin: 0; }
          .gen-top-logos td { border: none; height: 70px; text-align: center; vertical-align: middle; }
          .logo-cell { width: 33.33%; }
          .nfpa-logo { max-height: 62px; max-width: 95%; object-fit: contain; }
          .fire-logo { max-height: 62px; max-width: 95%; object-fit: contain; }
          .client-logo { max-height: 62px; max-width: 95%; object-fit: contain; }
          .client-logo-empty { color: #6b7280; font-size: 10px; font-weight: bold; }
          .gen-band-table { width: 100%; border-collapse: collapse; margin: 0; }
          .gen-band-table td { background: #0d6fb8; color: #fff; font-weight: bold; text-align: center; border: 1px solid #0d5ca8; padding: 3px; font-size: 9px; }
          .gen-address { text-align: center; font-size: 9px; color: #1d4ed8; border-bottom: 1px solid #0d6fb8; padding: 2px 6px; }
          .gen-title { text-align: center; font-size: 16px; font-weight: 900; border-bottom: 1px solid #0d6fb8; padding: 4px; }
          .gen-sections { width: 100%; border-collapse: collapse; margin: 0; }
          .gen-sections th { background: #0d6fb8; color: #fff; border: 1px solid #0d6fb8; text-align: center; font-size: 9px; padding: 2px; }
          .gen-sections td { border: 1px solid #0d6fb8; vertical-align: top; padding: 5px 8px; font-size: 11px; line-height: 1.45; }
          .gen-specialist { border-top: 1px solid #0d6fb8; padding: 4px 8px; font-size: 11px; text-align: center; }
        </style>
      </head>
      <body>
        <table style="width: 100%; border: none;">
          <thead class="page-number-header">
            <tr><td class="page-number-cell"></td></tr>
          </thead>
          <tbody>
            <tr>
              <td style="border: none; padding: 0;">
                ${generalDesignHtml}
        
                <h3 style="text-align:center; color:#ff6b6b; margin:5px;">Incidencias</h3>
                ${incidenciasTables}
        
                <div class="obs-box">
                    <b>observaciones:</b><br/>
                    ${formData.observaciones_finales}
                </div>
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
              </td>
            </tr>
          </tbody>
        </table>
      </body>
      </html>
    `;
      const { uri: hidrantesUri } = await printHtmlToPdf({ html: htmlHidrantes, fileName: `hidrantes-${formData.id || Date.now()}.pdf` });
      await sharePdfUri(hidrantesUri);

      // We cannot fire a second shareAsync automatically because Android will kill the app 
      // if it tries to start an Activity from the background (which happens once the first share dialog opens).
      // Instead, we ask the user to share the second PDF via an interactive prompt upon returning.
      Alert.alert(
        "PDF Generado",
        "El reporte principal ha sido generado. ¿Deseas generar y compartir el PDF de Incidencias?",
        [
          {
            text: "No",
            style: "cancel",
            onPress: () => setSaving(false)
          },
          {
            text: "Sí, compartir incidencias",
            onPress: async () => {
              try {
                const { uri: incidenciasUri } = await printHtmlToPdf({ html: htmlIncidencias, fileName: `hidrantes-incidencias-${formData.id || Date.now()}.pdf` });
                await sharePdfUri(incidenciasUri);
              } catch (e) {
                Alert.alert("Error", "No se pudo generar incidencias: " + e.message);
              } finally {
                setSaving(false);
              }
            }
          }
        ]
      );
    } catch (e) {
      Alert.alert("Error", "No se pudo generar el PDF: " + e.message);
      setSaving(false);
    }
    // Note: setSaving(false) is now handled inside the Alert callbacks.
  };

  const reSubirFotos = async () => {
    if (!formData.cliente_nombre) {
      return Alert.alert("Error", "Falta nombre cliente");
    }
    setSaving(true);
    try {
      const reporte = {
        ...formData,
        cliente: formData.cliente_nombre,
        g_fecha: formData.fecha,
        g_predio: formData.predio,
        id: resolveReportId(),
        titulo: `Hidrantes - ${formData.cliente_nombre}`,
        tipo: 'Hidrantes',
        fechaGuardado: new Date().toLocaleString()
      };
      const result = await reuploadReportAssets(reporte);
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
          console.warn('reSubirFotos: failed to update local history (hidrantes)', saveErr);
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
      enqueueBackup({
          ...formData,
          cliente: formData.cliente_nombre,
          g_fecha: formData.fecha,
          g_predio: formData.predio,
          id: resolveReportId(),
          titulo: `Hidrantes - ${formData.cliente_nombre}`,
          tipo: 'Hidrantes',
          fechaGuardado: new Date().toLocaleString()
      }).catch(queueErr => {});
      Alert.alert("En cola", "Las fotos se re-subiran cuando haya internet.");
    } finally {
      setSaving(false);
    }
  };

  const handleSign = async (sig) => {
    const reportId = (modo === 'editar' && idOriginal) ? idOriginal : Date.now();
    const stored = await persistSignatureDataUrl(sig, reportId, currentSigner || 'firma');
    setFormData(prev => ({
      ...prev,
      [currentSigner === 'cliente' ? 'firma_cliente' : 'firma_tecnico']: stored
    }));
    setSignatureModalVisible(false);
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[styles.container, { paddingBottom: insets.bottom }]}
    >
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Reporte Hidrantes</Text>
        <TouchableOpacity onPress={guardar}><Text style={{ color: 'white', fontWeight: 'bold' }}>GUARDAR</Text></TouchableOpacity>
      </View>

      <View style={styles.tabContainer}>
        {['general', 'hidrantes', 'incidencias', 'firma'].map(t => (
          <TouchableOpacity key={t} onPress={() => setActiveTab(t)} style={[styles.tab, activeTab === t && styles.activeTab]}>
            <Text style={[styles.tabText, activeTab === t && styles.activeTabText]}>{t.toUpperCase()}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 24) }}>

        {/* 1. GENERAL */}
        {activeTab === 'general' && (
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
              <View style={{ flex: 1 }}><InputRow label="Cliente / razón social" val={formData.cliente_nombre || ''} setVal={t => setFormData({ ...formData, cliente_nombre: t })} /></View>
              <View style={{ flex: 1 }}><InputRow label="Contacto del cliente" val={formData.cliente_contacto || ''} setVal={t => setFormData({ ...formData, cliente_contacto: t })} /></View>
            </View>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}><InputRow label="Teléfono del cliente" val={formData.cliente_telefono || ''} setVal={t => setFormData({ ...formData, cliente_telefono: t })} kbd="phone-pad" /></View>
              <View style={{ flex: 1 }}><InputRow label="Correo del cliente" val={formData.cliente_correo || ''} setVal={t => setFormData({ ...formData, cliente_correo: t })} kbd="email-address" /></View>
            </View>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}><InputRow label="Predio / ubicación del cliente" val={formData.predio || ''} setVal={t => setFormData({ ...formData, predio: t })} /></View>
              <View style={{ flex: 1 }}><InputRow label="Dirección del sitio" val={formData.cliente_direccion || ''} setVal={t => setFormData({ ...formData, cliente_direccion: t })} /></View>
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
              <View style={{ flex: 1 }}><InputRow label="Técnico" val={formData.h_tecnico || formData.empresa_especialista || ''} setVal={t => setFormData({ ...formData, h_tecnico: t, empresa_especialista: t })} /></View>
              <View style={{ flex: 1 }}><InputRow label="Departamento supervisor" val={formData.aviso_departamento || ''} setVal={t => setFormData({ ...formData, aviso_departamento: t })} /></View>
            </View>

            <Text style={styles.cardTitle}>Datos del servicio</Text>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}><InputRow label="Fecha" val={formData.fecha || ''} setVal={t => setFormData({ ...formData, fecha: t })} /></View>
              <View style={{ flex: 1 }}><InputRow label="Sistema" val={formData.h_sistema || 'RED DE HIDRANTES'} setVal={t => setFormData({ ...formData, h_sistema: t })} /></View>
            </View>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}><InputRow label="Hora de inicio" val={formData.hora_inicio || ''} setVal={t => setFormData({ ...formData, hora_inicio: t })} /></View>
              <View style={{ flex: 1 }}><InputRow label="Hora final" val={formData.hora_final || ''} setVal={t => setFormData({ ...formData, hora_final: t })} /></View>
            </View>
            <InputRow label="Nombre del Responsable del departamento" val={formData.aviso_responsable || ''} setVal={t => setFormData({ ...formData, aviso_responsable: t })} />

            <Text style={styles.cardTitle}>Cantidad Automática</Text>
            <View style={{ width: '48%' }}>
              <Text style={styles.label}>Cant. Hidrantes</Text>
              <View style={[styles.input, { backgroundColor: '#f3f4f6', justifyContent: 'center' }]}>
                <Text>{formData.cantidad_hidrantes || '0'}</Text>
              </View>
            </View>
          </View>
        )}

        {/* 2. HIDRANTES */}
        {activeTab === 'hidrantes' && (
          <View style={{ flex: 1 }}>
            <FlatList
              data={getListWithAddButton('hidrantes')}
              keyExtractor={(h) => (h.__add ? h.id : h.id.toString())}
              renderItem={({ item: h }) => {
                if (h.__add) {
                  return (
                    <View style={{ paddingHorizontal: 10, paddingVertical: 10 }}>
                      <TouchableOpacity style={styles.btnAdd} onPress={agregarHidrante}>
                        <Text style={{ color: 'white', fontWeight: 'bold' }}>+ AGREGAR HIDRANTE ({formData.hidrantes.length})</Text>
                      </TouchableOpacity>
                    </View>
                  );
                }
                const realIndex = formData.hidrantes.findIndex(item => item.id === h.id);
                const idx = realIndex >= 0 ? realIndex : 0;
                return (
                  <View style={styles.hidranteCard}>
                    <View style={styles.hidranteHeader}>
                      <Text style={styles.hidranteTitle}>Hidrante #{h.id}</Text>
                      <TouchableOpacity onPress={() => eliminarHidrante(idx)}><Text style={{ color: BRAND.colors.danger, fontWeight: 'bold' }}>Eliminar</Text></TouchableOpacity>
                    </View>
                    <InputRow label="Numero de hidrante" val={h.numero} setVal={t => updateHidrante(idx, 'numero', t)} ph="Ej. 3" />
                    <InputRow label="Ubicacion de Hidrante" val={h.ubicacion} setVal={t => updateHidrante(idx, 'ubicacion', t)} ph="Ej. Pasillo Central" />
                    <View style={styles.rowWrapper}>
                      <View style={{ flex: 1 }}>
                        <InputRow label="Presion del manometro (PSI)" val={h.presion} setVal={t => updateHidrante(idx, 'presion', t)} kbd="numeric" ph="Ej. 125" />
                      </View>
                      <View style={{ flex: 1, marginLeft: 10 }}>
                        <InputRow label="El hidrante esta identificado con numeracion o zona?" val={h.identificado} setVal={t => updateHidrante(idx, 'identificado', t)} ph="Escriba su respuesta" />
                      </View>
                    </View>
                    <InputRow label="La manguera esta en buenas condiciones?" val={h.manguera} setVal={t => updateHidrante(idx, 'manguera', t)} ph="Escriba su respuesta" />
                    <InputRow label="El Hidrante esta obstruido?" val={h.obstruido} setVal={t => updateHidrante(idx, 'obstruido', t)} ph="Escriba su respuesta" />
                    <InputRow label="El hidrante esta libre de daño fisico o materia extrana?" val={h.sin_dano} setVal={t => updateHidrante(idx, 'sin_dano', t)} ph="Escriba su respuesta" />
                    <InputRow label="La valvula angular esta libre de fugas y/o daño fisico?" val={h.valvula} setVal={t => updateHidrante(idx, 'valvula', t)} ph="Escriba su respuesta" />
                    <InputRow label="El hidrante cuenta con: Vidrio, Chiflon y Llave universal?" val={h.accesorios} setVal={t => updateHidrante(idx, 'accesorios', t)} ph="Escriba su respuesta" />
                    <InputRow label="Estado de espuma y dosificador estan en buenas condiciones?" val={h.espuma_dosificador} setVal={t => updateHidrante(idx, 'espuma_dosificador', t)} ph="Escriba su respuesta" />
                    <InputRow label="El Cristal se encuentra libre de daño y etiquetado?" val={h.cristal} setVal={t => updateHidrante(idx, 'cristal', t)} ph="Escriba su respuesta" />
                    <InputRow label="Observacion (detallar al final del reporte)" val={h.obs_id} setVal={t => updateHidrante(idx, 'obs_id', t)} ph="Escriba su respuesta" />
                    <View style={styles.photoContainer}>
                      <TouchableOpacity style={styles.photoBtn} onPress={() => tomarFotoHidrante(idx, 'antes')}>
                        {h.fotos.antes ? <Image source={{ uri: h.fotos.antes }} style={styles.thumb} onError={() => { }} /> : <Text style={styles.photoText}>OBSERVACION</Text>}
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.photoBtn} onPress={() => tomarFotoHidrante(idx, 'prueba')}>
                        {h.fotos.prueba ? <Image source={{ uri: h.fotos.prueba }} style={styles.thumb} onError={() => { }} /> : <Text style={styles.photoText}>PRUEBA</Text>}
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.photoBtn} onPress={() => tomarFotoHidrante(idx, 'despues')}>
                        {h.fotos.despues ? <Image source={{ uri: h.fotos.despues }} style={styles.thumb} onError={() => { }} /> : <Text style={styles.photoText}>DESPUES</Text>}
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              }}
              initialNumToRender={10}
              maxToRenderPerBatch={10}
              updateCellsBatchingPeriod={40}
              windowSize={7}
              removeClippedSubviews={true}
              scrollEnabled={false}
              nestedScrollEnabled={true}
              contentContainerStyle={{ paddingHorizontal: 10 }}
            />
            {canLoadMoreList('hidrantes') && (
              <TouchableOpacity style={[styles.btnLoadMore, { marginHorizontal: 10 }]} onPress={() => loadMoreList('hidrantes')}>
                <Text style={styles.btnLoadMoreText}>CARGAR 200 MAS</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* 3. INCIDENCIAS */}
        {activeTab === 'incidencias' && (
          <View style={{ flex: 1 }}>
            <FlatList
              data={getListWithAddButton('incidencias')}
              keyExtractor={(inc) => (inc.__add ? inc.id : inc.id.toString())}
              renderItem={({ item: inc }) => {
                if (inc.__add) {
                  return (
                    <View style={{ paddingHorizontal: 10, paddingVertical: 10 }}>
                      <TouchableOpacity style={[styles.btnAdd, { backgroundColor: BRAND.colors.danger }]} onPress={agregarIncidencia}>
                        <Text style={{ color: 'white', fontWeight: 'bold' }}>+ AGREGAR INCIDENCIA ({formData.incidencias.length})</Text>
                      </TouchableOpacity>
                    </View>
                  );
                }
                const realIndex = formData.incidencias.findIndex(item => item.id === inc.id);
                const idx = realIndex >= 0 ? realIndex : 0;
                return (
                  <View style={[styles.hidranteCard, { borderLeftColor: BRAND.colors.danger, marginHorizontal: 10 }]}>
                    <View style={styles.hidranteHeader}>
                      <Text style={[styles.hidranteTitle, { color: BRAND.colors.danger }]}>Incidencia #{inc.id}</Text>
                      <TouchableOpacity onPress={() => eliminarIncidencia(idx)}><Text style={{ color: BRAND.colors.danger, fontWeight: 'bold' }}>Eliminar</Text></TouchableOpacity>
                    </View>
                    <InputRow label="Descripcion de incidencias" val={inc.descripcion} setVal={t => updateIncidencia(idx, 'descripcion', t)} multiline={true} numberOfLines={3} style={[styles.writeInput, { height: 60 }]} boxed={true} />
                    <Text style={[styles.smallLabel, { color: BRAND.colors.danger }]}>Evidencia grafica (descripcion)</Text>
                    <ScrollView horizontal style={{ flexDirection: 'row', marginBottom: 10 }}>
                      {(inc.fotos_descripcion || []).map((f, i) => f ? <Image key={i} source={{ uri: f }} style={{ width: 80, height: 80, marginRight: 5, borderRadius: 5 }} onError={() => { }} /> : <View key={i} style={{ width: 80, height: 80, marginRight: 5, borderRadius: 5, backgroundColor: BRAND.colors.bgAlt, justifyContent: 'center', alignItems: 'center' }}><Text style={{ color: BRAND.colors.textMuted }}>Sin foto</Text></View>)}
                      <TouchableOpacity style={[styles.photoBtn, { width: 80, height: 80, backgroundColor: 'rgba(255,107,107,0.15)', borderColor: BRAND.colors.danger }]} onPress={() => tomarFotoIncidencia(idx, 'fotos_descripcion')}>
                        <Text style={{ color: BRAND.colors.danger, fontSize: 20 }}>+</Text>
                      </TouchableOpacity>
                    </ScrollView>

                    <InputRow label="Pruebas y diagnostico" val={inc.pruebas} setVal={t => updateIncidencia(idx, 'pruebas', t)} multiline={true} numberOfLines={3} style={[styles.writeInput, { height: 60 }]} boxed={true} />
                    <Text style={[styles.smallLabel, { color: BRAND.colors.danger }]}>Evidencias graficas (pruebas)</Text>
                    <ScrollView horizontal style={{ flexDirection: 'row', marginBottom: 10 }}>
                      {(inc.fotos_pruebas || []).map((f, i) => f ? <Image key={i} source={{ uri: f }} style={{ width: 80, height: 80, marginRight: 5, borderRadius: 5 }} onError={() => { }} /> : <View key={i} style={{ width: 80, height: 80, marginRight: 5, borderRadius: 5, backgroundColor: BRAND.colors.bgAlt, justifyContent: 'center', alignItems: 'center' }}><Text style={{ color: BRAND.colors.textMuted }}>Sin foto</Text></View>)}
                      <TouchableOpacity style={[styles.photoBtn, { width: 80, height: 80, backgroundColor: 'rgba(255,107,107,0.15)', borderColor: BRAND.colors.danger }]} onPress={() => tomarFotoIncidencia(idx, 'fotos_pruebas')}>
                        <Text style={{ color: BRAND.colors.danger, fontSize: 20 }}>+</Text>
                      </TouchableOpacity>
                    </ScrollView>

                    <InputRow label="Solucion o recomendacion" val={inc.solucion} setVal={t => updateIncidencia(idx, 'solucion', t)} multiline={true} numberOfLines={3} style={[styles.writeInput, { height: 60 }]} boxed={true} />
                    <Text style={[styles.smallLabel, { color: BRAND.colors.danger }]}>Evidencia grafica (solucion)</Text>
                    <ScrollView horizontal style={{ flexDirection: 'row', marginBottom: 10 }}>
                      {(inc.fotos_solucion || []).map((f, i) => f ? <Image key={i} source={{ uri: f }} style={{ width: 80, height: 80, marginRight: 5, borderRadius: 5 }} onError={() => { }} /> : <View key={i} style={{ width: 80, height: 80, marginRight: 5, borderRadius: 5, backgroundColor: BRAND.colors.bgAlt, justifyContent: 'center', alignItems: 'center' }}><Text style={{ color: BRAND.colors.textMuted }}>Sin foto</Text></View>)}
                      <TouchableOpacity style={[styles.photoBtn, { width: 80, height: 80, backgroundColor: 'rgba(255,107,107,0.15)', borderColor: BRAND.colors.danger }]} onPress={() => tomarFotoIncidencia(idx, 'fotos_solucion')}>
                        <Text style={{ color: BRAND.colors.danger, fontSize: 20 }}>+</Text>
                      </TouchableOpacity>
                    </ScrollView>
                  </View>
                );
              }}
              initialNumToRender={8}
              maxToRenderPerBatch={8}
              updateCellsBatchingPeriod={40}
              windowSize={7}
              removeClippedSubviews={true}
              scrollEnabled={false}
              nestedScrollEnabled={true}
            />
            {canLoadMoreList('incidencias') && (
              <TouchableOpacity style={[styles.btnLoadMore, { marginHorizontal: 10 }]} onPress={() => loadMoreList('incidencias')}>
                <Text style={styles.btnLoadMoreText}>CARGAR 200 MAS</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* 4. FIRMA */}
        {activeTab === 'firma' && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Cierre y Firmas</Text>

            <Text style={styles.label}>Observaciones:</Text>
            <TextInput style={[styles.input, styles.writeInput, { height: 100, textAlignVertical: 'top', marginBottom: 15 }]}
              value={formData.observaciones_finales}
              onChangeText={t => setFormData({ ...formData, observaciones_finales: t })}
              multiline={true}
              placeholderTextColor={BRAND.colors.textMuted}
              placeholder="Escriba aquí las observaciones generales..." />

            <View style={styles.legalBox}>
              <Text style={styles.legalText}>
                &quot;Las pruebas y mantenimientos se realizaron de acuerdo a las recomendaciones de la Norma Internacional NFPA 25. Así como del fabricante. Las mismas fueron supervisadas y validas, por un representante que el cliente asigno y es quien firma este documento.&quot;
              </Text>
            </View>

            <View style={styles.divider} />

            <Text style={styles.sectionHeader}>Por Parte Del Cliente</Text>
            <InputRow label="Nombre quien recibe" val={formData.nombre_cliente_firma} setVal={t => setFormData({ ...formData, nombre_cliente_firma: t })} ph="Ej. Ing. Samantha Dominguez" />
            <TouchableOpacity style={styles.signBox} onPress={() => { setCurrentSigner('cliente'); setSignatureModalVisible(true); }}>
              {typeof formData.firma_cliente === 'string' && formData.firma_cliente
                ? <Image source={{ uri: formData.firma_cliente }} style={{ width: '100%', height: '100%', resizeMode: 'contain' }} onError={() => { }} />
                : <Text style={{ color: BRAND.colors.textMuted }}>Toque para firmar</Text>}
            </TouchableOpacity>

            <Text style={styles.sectionHeader}>Por Parte de Fire Engineers</Text>
            <InputRow label="Nombre del Técnico" val={formData.nombre_tecnico_firma} setVal={t => setFormData({ ...formData, nombre_tecnico_firma: t })} ph="Ej. Octavio Cortez" />
            <TouchableOpacity style={styles.signBox} onPress={() => { setCurrentSigner('tecnico'); setSignatureModalVisible(true); }}>
              {typeof formData.firma_tecnico === 'string' && formData.firma_tecnico
                ? <Image source={{ uri: formData.firma_tecnico }} style={{ width: '100%', height: '100%', resizeMode: 'contain' }} onError={() => { }} />
                : <Text style={{ color: BRAND.colors.textMuted }}>Toque para firmar</Text>}
            </TouchableOpacity>

            <TouchableOpacity style={styles.btnSecondary} onPress={reSubirFotos} disabled={saving}>
              <Text style={styles.btnSecondaryText}>{saving ? "☁️ SINCRONIZANDO..." : "☁️ FORZAR SINCRONIZACIÓN"}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.btnSecondary} onPress={guardar}>
              <Text style={styles.btnSecondaryText}>GUARDAR BORRADOR</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.btnPrimary, { marginTop: 20 }]}
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
        )}
      </ScrollView>

      {/* MODAL FIRMA */}
      <Modal visible={signatureModalVisible} animationType="slide">
        {signatureModalVisible && (
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Firmar - {currentSigner === 'cliente' ? 'Cliente' : 'Técnico'}</Text>
          </View>
          <View style={styles.signatureArea}>
            <SignatureScreen ref={signatureRef} onOK={handleSign} webStyle={`.m-signature-pad--footer {display: none;} .m-signature-pad {box-shadow:none; border:none;}`} />
          </View>
          <View style={styles.modalButtons}>
            <TouchableOpacity style={[styles.modalBtn, styles.btnGray]} onPress={() => signatureRef.current.clearSignature()}>
              <Text style={styles.modalBtnText}>Borrar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.modalBtn, styles.btnBlueModal]} onPress={() => signatureRef.current.readSignature()}>
              <Text style={styles.modalBtnText}>Guardar Firma</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={styles.btnCloseModal} onPress={() => setSignatureModalVisible(false)}>
            <Text style={{ color: 'white', fontWeight: 'bold' }}>CANCELAR</Text>
          </TouchableOpacity>
        </View>
        )}
      </Modal>
    </KeyboardAvoidingView>
  );
}

// --- COMPONENTES AUXILIARES ---

const InputRow = ({ label, val, setVal, ph, kbd = 'default', boxed = false, ...props }) => (
  <View style={[{ marginBottom: 8 }, boxed && styles.writeBox]}>
    <Text style={[styles.label, boxed && { color: BRAND.colors.accent, marginBottom: 5 }]}>{label}</Text>
    <TextInput
      style={[styles.input, boxed && styles.writeInput, props.style]}
      value={val}
      onChangeText={setVal}
      placeholder={ph}
      placeholderTextColor={BRAND.colors.textMuted}
      keyboardType={kbd}
      {...props}
    />
  </View>
);

const ToggleBtn = ({ options, current, onSelect }) => (
  <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
    {options.map(op => (
      <TouchableOpacity key={op} onPress={() => onSelect(op)}
        style={[styles.toggleBtn, current === op && styles.toggleBtnActive, { backgroundColor: current === op ? (['NO', 'SI', '1', '2', 'A', 'B'].includes(op) && (op === 'NO' || op === 'SI' || op === '1' || op === '2') ? BRAND.colors.danger : BRAND.colors.success) : BRAND.colors.bgAlt }]}>
        <Text style={[styles.toggleText, current === op && { color: BRAND.colors.text }]}>{op}</Text>
      </TouchableOpacity>
    ))}
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BRAND.colors.bg },
  header: { backgroundColor: BRAND.colors.cardAlt, padding: 15, paddingTop: 50, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: BRAND.colors.border },
  headerTitle: { color: BRAND.colors.text, fontSize: 18, fontFamily: BRAND.fonts.title },
  tabContainer: { flexDirection: 'row', backgroundColor: BRAND.colors.bgAlt, paddingHorizontal: 10, borderBottomWidth: 1, borderBottomColor: BRAND.colors.border },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center', borderBottomWidth: 3, borderColor: 'transparent' },
  activeTab: { borderColor: BRAND.colors.accent },
  tabText: { color: BRAND.colors.textMuted, fontSize: 11, fontFamily: BRAND.fonts.body },
  activeTabText: { color: BRAND.colors.accentStrong, fontFamily: BRAND.fonts.semi },
  content: { flex: 1, padding: 10 },
  card: { backgroundColor: BRAND.colors.card, padding: 15, borderRadius: BRAND.radius.lg, marginBottom: 15, borderWidth: 1, borderColor: BRAND.colors.border },
  hidranteCard: { backgroundColor: BRAND.colors.cardAlt, padding: 15, borderRadius: BRAND.radius.lg, marginBottom: 15, borderLeftWidth: 4, borderLeftColor: BRAND.colors.accent, borderWidth: 1, borderColor: BRAND.colors.border },
  hidranteHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15, borderBottomWidth: 1, borderColor: BRAND.colors.border, paddingBottom: 10 },
  hidranteTitle: { fontSize: 14, fontFamily: BRAND.fonts.semi, color: BRAND.colors.accentStrong },
  cardTitle: { fontSize: 14, fontFamily: BRAND.fonts.semi, color: BRAND.colors.accentStrong, marginBottom: 12 },
  label: { fontSize: 10, color: BRAND.colors.textMuted, marginBottom: 5, fontFamily: BRAND.fonts.semi },
  input: { borderWidth: 1, borderColor: BRAND.colors.border, padding: 10, borderRadius: BRAND.radius.md, backgroundColor: BRAND.colors.bgAlt, fontSize: 12, color: BRAND.colors.text, fontFamily: BRAND.fonts.body },
  writeBox: { borderWidth: 1, borderColor: BRAND.colors.accent, borderRadius: BRAND.radius.md, padding: 6, backgroundColor: BRAND.colors.bgAlt },
  writeInput: { borderWidth: 2, borderColor: BRAND.colors.accent, backgroundColor: '#ffffff', color: '#111827' },
  divider: { height: 1, backgroundColor: BRAND.colors.border, marginVertical: 15 },
  sectionHeader: { fontSize: 12, fontFamily: BRAND.fonts.semi, marginTop: 10, marginBottom: 8, color: BRAND.colors.text },
  legalBox: { backgroundColor: BRAND.colors.bgAlt, padding: 10, borderRadius: BRAND.radius.md, borderWidth: 1, borderColor: BRAND.colors.border },
  legalText: { fontSize: 10, fontStyle: 'italic', color: BRAND.colors.textMuted, textAlign: 'justify' },

  // Hidrantes / Incidencias
  smallLabel: { fontSize: 10, color: BRAND.colors.textMuted, marginTop: 8, marginBottom: 4, fontFamily: BRAND.fonts.semi },
  smallInput: { borderWidth: 1, borderColor: BRAND.colors.border, padding: 8, borderRadius: BRAND.radius.md, backgroundColor: BRAND.colors.bgAlt, textAlign: 'center', fontSize: 11, color: BRAND.colors.text, fontFamily: BRAND.fonts.body },
  rowWrapper: { flexDirection: 'row', marginBottom: 5 },
  toggleBtn: { paddingVertical: 8, paddingHorizontal: 12, borderWidth: 1, borderColor: BRAND.colors.border, borderRadius: BRAND.radius.md, marginRight: 5, marginBottom: 5, minWidth: 45, alignItems: 'center', backgroundColor: BRAND.colors.bgAlt },
  toggleBtnActive: { borderColor: 'transparent' },
  toggleText: { fontSize: 11, color: BRAND.colors.textMuted, fontFamily: BRAND.fonts.semi },

  // Fotos
  photoContainer: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10, gap: 8 },
  photoBtn: { flex: 1, aspectRatio: 1, backgroundColor: BRAND.colors.bgAlt, justifyContent: 'center', alignItems: 'center', borderRadius: BRAND.radius.md, borderWidth: 1, borderColor: BRAND.colors.border, borderStyle: 'dashed', overflow: 'hidden' },
  photoText: { fontSize: 9, color: BRAND.colors.textMuted, textAlign: 'center', marginTop: 5, fontFamily: BRAND.fonts.semi },
  thumb: { width: '100%', height: '100%' },

  btnAdd: { backgroundColor: BRAND.colors.accent, padding: 12, borderRadius: BRAND.radius.md, alignItems: 'center', marginTop: 10 },
  btnAddText: { color: BRAND.colors.ink, fontFamily: BRAND.fonts.semi, fontSize: 12 },
  btnLoadMore: { backgroundColor: BRAND.colors.bgAlt, padding: 10, borderRadius: BRAND.radius.md, marginTop: 10, borderWidth: 1, borderColor: BRAND.colors.border },
  btnLoadMoreText: { color: BRAND.colors.text, textAlign: 'center', fontFamily: BRAND.fonts.semi, fontSize: 12 },
  logoPicker: { height: 120, borderWidth: 1, borderColor: BRAND.colors.border, borderStyle: 'dashed', borderRadius: BRAND.radius.md, backgroundColor: BRAND.colors.bgAlt, justifyContent: 'center', alignItems: 'center', marginTop: 6, marginBottom: 12, overflow: 'hidden' },
  logoPickerText: { color: BRAND.colors.textMuted, fontFamily: BRAND.fonts.semi, fontSize: 11, textAlign: 'center', paddingHorizontal: 12 },
  logoPreview: { width: '100%', height: '100%' },
  signBox: { height: 150, borderWidth: 1, borderStyle: 'dashed', borderColor: BRAND.colors.border, justifyContent: 'center', alignItems: 'center', marginVertical: 10, borderRadius: BRAND.radius.md, backgroundColor: BRAND.colors.bgAlt },
  btnPrimary: { backgroundColor: BRAND.colors.accent, padding: 15, borderRadius: BRAND.radius.md, alignItems: 'center', marginTop: 15 },
  btnSecondary: { backgroundColor: BRAND.colors.cardAlt, padding: 15, borderRadius: BRAND.radius.md, alignItems: 'center', marginTop: 10, borderWidth: 1, borderColor: BRAND.colors.border },
  btnPrimaryText: { color: BRAND.colors.ink, fontFamily: BRAND.fonts.semi, fontSize: 14 },
  btnSecondaryText: { color: BRAND.colors.text, fontFamily: BRAND.fonts.semi, fontSize: 14 },

  // Firmas
  signatureLabel: { fontSize: 11, fontFamily: BRAND.fonts.semi, color: BRAND.colors.text, marginTop: 10 },
  inputFirmaNombre: { borderWidth: 1, borderColor: BRAND.colors.border, padding: 10, borderRadius: BRAND.radius.md, marginTop: 5, fontSize: 12, backgroundColor: BRAND.colors.bgAlt, color: BRAND.colors.text, fontFamily: BRAND.fonts.body },
  signatureBox: { height: 150, borderWidth: 1, borderColor: BRAND.colors.border, borderStyle: 'dashed', marginTop: 5, alignItems: 'center', justifyContent: 'center', backgroundColor: BRAND.colors.bgAlt, borderRadius: BRAND.radius.md },

  // Modal
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
