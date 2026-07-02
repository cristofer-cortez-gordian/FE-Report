import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import * as FileSystem from 'expo-file-system';
import * as ImageManipulator from 'expo-image-manipulator';
import * as MediaLibrary from 'expo-media-library';
import { decode } from 'base64-arraybuffer';
import supabase, { SUPABASE_STORAGE_BUCKET } from '../supabase';
import { Alert } from 'react-native';

const SIGNATURES_DIR = `${FileSystem.documentDirectory}signatures/`;
const PHOTOS_DIR = `${FileSystem.documentDirectory}photos/`;
const USER_DATA_TABLE = 'user_data';
const USER_DATA_EXCLUDE_KEYS = new Set([
  '@user_session',
  'users_db',
  'reporte_temporal',
  'pending_backups'
]);

export async function getSafeMisReportes() {
  try {
    const json = await AsyncStorage.getItem('mis_reportes');
    if (!json) return [];
    let parsed = [];
    try {
      parsed = JSON.parse(json);
    } catch(e) {
      return [];
    }
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    const msg = e?.message || '';
    if (msg.includes('CursorWindow')) {
      console.warn("CursorWindow error leyendo mis_reportes, borrándolo para recuperar la app.");
      Alert.alert(
        "Almacenamiento Lleno",
        "Tus reportes guardados en este dispositivo excedieron el límite de memoria (2MB). Se tuvo que limpiar el historial local para que la app funcione. (Tus reportes en la nube están a salvo)."
      );
      try {
        await AsyncStorage.removeItem('mis_reportes');
      } catch(err){}
      return [];
    }
    console.warn("Error reading mis_reportes", e);
    return [];
  }
}

async function getCurrentUserId() {
  try {
    if (!supabase?.auth?.getUser) return null;
    const { data, error } = await supabase.auth.getUser();
    if (error) return null;
    return data?.user?.id || null;
  } catch (e) {
    return null;
  }
}

async function ensureSignaturesDir() {
  try {
    await FileSystem.makeDirectoryAsync(SIGNATURES_DIR, { intermediates: true });
  } catch (e) {
    // Directory may already exist.
  }
}

async function ensurePhotosDir() {
  try {
    await FileSystem.makeDirectoryAsync(PHOTOS_DIR, { intermediates: true });
  } catch (e) {
    // Directory may already exist.
  }
}

export async function savePhotoToGallery(uri) {
  try {
    if (!uri || typeof uri !== 'string') return false;
    const perms = await MediaLibrary.getPermissionsAsync();
    if (perms.status !== 'granted') {
      const req = await MediaLibrary.requestPermissionsAsync();
      if (req.status !== 'granted') return false;
    }
    await MediaLibrary.createAssetAsync(uri);
    return true;
  } catch (e) {
    console.warn('savePhotoToGallery failed', e);
    return false;
  }
}

function inferImageExtension(uri) {
  try {
    if (!uri || typeof uri !== 'string') return '.jpg';
    const clean = uri.split('?')[0];
    const lower = clean.toLowerCase();
    if (lower.startsWith('content://')) return '.jpg';
    if (lower.endsWith('.png')) return '.png';
    if (lower.endsWith('.webp')) return '.webp';
    if (lower.endsWith('.gif')) return '.gif';
    if (lower.endsWith('.jpeg')) return '.jpeg';
    if (lower.endsWith('.jpg')) return '.jpg';
    return '.jpg';
  } catch (e) {
    return '.jpg';
  }
}

export async function persistSignatureDataUrl(dataUrl, reportId, signer) {
  try {
    if (!dataUrl || typeof dataUrl !== 'string') return null;
    if (!dataUrl.startsWith('data:image')) return dataUrl;

    await ensureSignaturesDir();
    const safeId = String(reportId || Date.now()).replace(/[^a-zA-Z0-9_-]/g, '');
    const safeSigner = String(signer || 'sig').replace(/[^a-zA-Z0-9_-]/g, '');
    const fileName = `sig_${safeId}_${safeSigner}_${Date.now()}.png`;
    const path = `${SIGNATURES_DIR}${fileName}`;
    const base64 = dataUrl.replace(/^data:image\/\w+;base64,/, '');
    await FileSystem.writeAsStringAsync(path, base64, { encoding: 'base64' });
    return path;
  } catch (e) {
    console.warn('persistSignatureDataUrl failed', e);
    // Fallback to raw base64 if saving failed so signatures are not lost
    return dataUrl;
  }
}

export async function signatureUriToDataUrl(uri) {
  try {
    if (!uri || typeof uri !== 'string') return null;
    if (uri.startsWith('data:')) return uri;
    if (uri.startsWith('file://') || uri.startsWith('content://') || uri.startsWith('asset://')) {
      const manipResult = await ImageManipulator.manipulateAsync(
        uri,
        [],
        { base64: true }
      );
      const base64 = manipResult.base64 || '';
      return `data:image/png;base64,${base64}`;
    }
    return uri;
  } catch (e) {
    console.warn('signatureUriToDataUrl failed', e);
    return null;
  }
}

function inferImageMimeType(uri) {
  try {
    if (!uri || typeof uri !== 'string') return 'image/jpeg';
    const lower = uri.toLowerCase();
    if (lower.startsWith('content://')) return 'image/jpeg';
    if (lower.endsWith('.png')) return 'image/png';
    if (lower.endsWith('.webp')) return 'image/webp';
    if (lower.endsWith('.gif')) return 'image/gif';
    return 'image/jpeg';
  } catch (e) {
    return 'image/jpeg';
  }
}

export async function imageUriToDataUrl(uri, options = {}) {
  try {
    if (!uri || typeof uri !== 'string') return null;
    if (uri.startsWith('data:')) return uri;

    if (REMOTE_URI_REGEX.test(uri)) {
      // Devolver la URL de internet directamente en lugar de descargarla y convertirla a Base64.
      // Esto evita que la app se crashee (Out Of Memory) al generar PDFs con cientos de fotos.
      return uri;
    }

    const isLocal = uri.startsWith('file://') || uri.startsWith('content://') || uri.startsWith('asset://');
    if (isLocal) {
      const maxWidth = Number(options.maxWidth) || 1200;
      const compress = typeof options.compress === 'number' ? options.compress : 0.6;
      const format = options.format || ImageManipulator.SaveFormat.JPEG;

      try {
        const manip = await ImageManipulator.manipulateAsync(
          uri,
          maxWidth > 0 ? [{ resize: { width: maxWidth } }] : [],
          { compress, format, base64: true }
        );
        if (manip?.base64) {
          const mime = format === ImageManipulator.SaveFormat.PNG ? 'image/png' : 'image/jpeg';
          return `data:${mime};base64,${manip.base64}`;
        }
      } catch (resizeErr) {
        console.warn('imageUriToDataUrl resize failed. Returning null to prevent Out of Memory crash.', resizeErr);
        return null;
      }
      
      // We should NOT fallback to readAsStringAsync here because it will read a 5MB image into memory
      // and crash the app. The image manipulation should have succeeded if the image was valid.
      return null;
    }

    return uri;
  } catch (e) {
    console.warn('imageUriToDataUrl failed', e);
    return null;
  }
}

export async function imageUriToLocalUri(uri, options = {}) {
  try {
    if (!uri || typeof uri !== 'string') return null;
    if (uri.startsWith('data:')) return uri;

    const maxWidth = Number(options.maxWidth) || 200;
    const compress = typeof options.compress === 'number' ? options.compress : 0.6;
    const format = options.format || ImageManipulator.SaveFormat.JPEG;

    if (REMOTE_URI_REGEX.test(uri)) {
      try {
        const ext = inferImageExtension(uri);
        const tmpPath = `${FileSystem.cacheDirectory}remote_local_${Date.now()}${ext}`;
        const result = await FileSystem.downloadAsync(uri, tmpPath);
        const localUri = result?.uri || tmpPath;
        const manip = await ImageManipulator.manipulateAsync(
          localUri,
          maxWidth > 0 ? [{ resize: { width: maxWidth } }] : [],
          { compress, format, base64: false }
        );
        try { await FileSystem.deleteAsync(localUri, { idempotent: true }); } catch (_) {}
        return manip.uri;
      } catch (e) {
        return uri;
      }
    }

    const isLocal = uri.startsWith('file://') || uri.startsWith('content://') || uri.startsWith('asset://');
    if (isLocal) {
      try {
        const manip = await ImageManipulator.manipulateAsync(
          uri,
          maxWidth > 0 ? [{ resize: { width: maxWidth } }] : [],
          { compress, format, base64: false }
        );
        return manip.uri;
      } catch (resizeErr) {
        return uri; // Return original local URI if resize fails
      }
    }
    return uri;
  } catch (e) {
    return uri;
  }
}

export async function persistPhotoUri(uri, reportId, label) {
  try {
    if (!uri || typeof uri !== 'string') return null;
    if (uri.startsWith('http') || uri.startsWith('data:')) return uri;
    const normalizeFileUri = (value) => {
      if (!value) return value;
      if (value.startsWith('file://') || value.startsWith('content://') || value.startsWith('asset://')) {
        return value;
      }
      if (value.startsWith('/')) return `file://${value}`;
      if (value.startsWith(FileSystem.documentDirectory)) return `file://${value}`;
      return value;
    };

    const normalizedUri = normalizeFileUri(uri);
    const normalizedPlain = String(normalizedUri || '').replace(/^file:\/\//, '');
    const isManagedPath =
      normalizedUri.startsWith(PHOTOS_DIR) ||
      normalizedUri.startsWith(SIGNATURES_DIR) ||
      normalizedPlain.includes('/files/photos/') ||
      normalizedPlain.includes('/files/signatures/');

    if (isManagedPath) {
      return normalizedUri;
    }

    await ensurePhotosDir();
    const safeId = String(reportId || Date.now()).replace(/[^a-zA-Z0-9_-]/g, '');
    const safeLabel = String(label || 'photo').replace(/[^a-zA-Z0-9_-]/g, '');
    const ext = inferImageExtension(uri);
    const fileName = `photo_${safeId}_${safeLabel}_${Date.now()}${ext}`;
    const path = `${PHOTOS_DIR}${fileName}`;

    if (normalizedUri.startsWith('file://') || normalizedUri.startsWith('content://') || normalizedUri.startsWith('asset://')) {
      try {
        await FileSystem.copyAsync({ from: normalizedUri, to: path });
        return path;
      } catch (copyErr) {
        try {
          const base64 = await FileSystem.readAsStringAsync(normalizedUri, { encoding: 'base64' });
          await FileSystem.writeAsStringAsync(path, base64, { encoding: 'base64' });
          return path;
        } catch (readErr) {
          console.warn('persistPhotoUri failed to copy content uri', readErr);
        }
      }
    }

    return uri;
  } catch (e) {
    console.warn('persistPhotoUri failed', e);
    return uri;
  }
}

const REMOTE_URI_REGEX = /^https?:\/\//i;
const SUPABASE_PUBLIC_URL_REGEX = /\/storage\/v1\/object\/public\/([^/]+)\/(.+)$/i;

function base64ToUint8Array(base64) {
  try {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
    const clean = String(base64 || '').replace(/\s+/g, '');
    const buffer = [];
    let bs = 0;
    let bc = 0;
    let idx = 0;

    for (; idx < clean.length; idx++) {
      const char = clean.charAt(idx);
      const val = chars.indexOf(char);
      if (val === -1) continue;
      bs = (bc % 4 === 0) ? val : (bs * 64 + val);
      if (bc % 4) {
        const byte = 255 & (bs >> ((-2 * bc) & 6));
        buffer.push(byte);
      }
      bc++;
    }

    return new Uint8Array(buffer);
  } catch (e) {
    console.warn('base64ToUint8Array failed', e);
    return new Uint8Array();
  }
}

async function downloadRemoteImage(uri, reportId, label, dir, retries = 2) {
  try {
    if (!uri || typeof uri !== 'string') return uri;
    if (!REMOTE_URI_REGEX.test(uri)) return uri;

    if (dir === SIGNATURES_DIR) {
      await ensureSignaturesDir();
    } else {
      await ensurePhotosDir();
    }

    const safeId = String(reportId || Date.now()).replace(/[^a-zA-Z0-9_-]/g, '');
    const safeLabel = String(label || 'asset').replace(/[^a-zA-Z0-9_-]/g, '');
    const ext = inferImageExtension(uri);
    const fileName = `dl_${safeId}_${safeLabel}_${Date.now()}${ext}`;
    const path = `${dir}${fileName}`;

    const trySignedUrl = async () => {
      if (!supabase?.storage?.from) return null;
      const match = uri.match(SUPABASE_PUBLIC_URL_REGEX);
      if (!match) return null;
      const bucket = match[1];
      const objectPath = decodeURIComponent(match[2] || '');
      if (!bucket || !objectPath) return null;
      const { data, error } = await supabase.storage.from(bucket).createSignedUrl(objectPath, 60 * 60);
      if (error) return null;
      return data?.signedUrl || null;
    };

    const attemptDownload = async (sourceUri) => {
      const result = await FileSystem.downloadAsync(sourceUri, path);
      if (result?.status && (result.status < 200 || result.status >= 300)) {
        throw new Error(`download status ${result.status}`);
      }
      return result?.uri || path;
    };

    let lastError = null;
    for (let attempt = 0; attempt <= retries; attempt += 1) {
      try {
        return await attemptDownload(uri);
      } catch (err) {
        lastError = err;
      }

      try {
        const signedUrl = await trySignedUrl();
        if (signedUrl) {
          return await attemptDownload(signedUrl);
        }
      } catch (signedErr) {
        lastError = signedErr;
      }
    }

    if (lastError) {
      console.warn('downloadRemoteImage failed after retries', lastError);
    }
    return uri;
  } catch (e) {
    console.warn('downloadRemoteImage failed', e);
    return uri;
  }
}

export async function downloadReportAssets(report) {
  try {
    if (!report || typeof report !== 'object') return report;
    const safeReportId = report.id || Date.now();
    const updated = JSON.parse(JSON.stringify(report));
    const failures = [];

    const trackDownload = async (uri, label, dir) => {
      if (!uri || typeof uri !== 'string') return uri;
      const downloaded = await downloadRemoteImage(uri, safeReportId, label, dir, 2);
      if (REMOTE_URI_REGEX.test(uri) && downloaded === uri) {
        failures.push({ uri, label });
      }
      return downloaded;
    };

    if (updated.firma_cliente) {
      updated.firma_cliente = await trackDownload(updated.firma_cliente, 'firma_cliente', SIGNATURES_DIR);
    }
    if (updated.firma_tecnico) {
      updated.firma_tecnico = await trackDownload(updated.firma_tecnico, 'firma_tecnico', SIGNATURES_DIR);
    }
    if (updated.logo_cliente) {
      updated.logo_cliente = await trackDownload(updated.logo_cliente, 'logo_cliente', PHOTOS_DIR);
    }

    if (updated.evidencias && typeof updated.evidencias === 'object') {
      for (const key of Object.keys(updated.evidencias)) {
        updated.evidencias[key] = await trackDownload(updated.evidencias[key], `evidencia_${key}`, PHOTOS_DIR);
      }
    }

    if (updated.p_fotos && Array.isArray(updated.p_fotos)) {
      for (let i = 0; i < updated.p_fotos.length; i++) {
        updated.p_fotos[i] = await trackDownload(updated.p_fotos[i], `panel_${i}`, PHOTOS_DIR);
      }
    }

    const tableKeys = ['table_ig', 'table_md', 'table_me', 'table_mj', 'table_supresion'];
    for (const key of tableKeys) {
      if (Array.isArray(updated[key])) {
        for (let i = 0; i < updated[key].length; i++) {
          const row = updated[key][i];
          if (row && row.imagen) {
            row.imagen = await trackDownload(row.imagen, `${key}_${i}_imagen`, PHOTOS_DIR);
          }
        }
      }
    }

    // Descargar imágenes en arrays anidados (reportes de Bombas)
    const nestedArrayKeys = [
      { arrayKey: 'cuartos', tableKey: 'table_ig' },
      { arrayKey: 'motores_diesel', tableKey: 'table_md' },
      { arrayKey: 'motores_electricos', tableKey: 'table_me' },
      { arrayKey: 'bombas_jockey', tableKey: 'table_mj' }
    ];
    for (const { arrayKey, tableKey } of nestedArrayKeys) {
      if (!Array.isArray(updated[arrayKey])) continue;
      for (let arrIdx = 0; arrIdx < updated[arrayKey].length; arrIdx++) {
        const arrItem = updated[arrayKey][arrIdx];
        if (!arrItem || !Array.isArray(arrItem[tableKey])) continue;
        for (let rowIdx = 0; rowIdx < arrItem[tableKey].length; rowIdx++) {
          const row = arrItem[tableKey][rowIdx];
          if (row && row.imagen) {
            row.imagen = await trackDownload(
              row.imagen,
              `${arrayKey}_${arrIdx}_${tableKey}_${rowIdx}_imagen`,
              PHOTOS_DIR
            );
          }
        }
      }
    }

    if (Array.isArray(updated.hidrantes)) {
      for (let i = 0; i < updated.hidrantes.length; i++) {
        const h = updated.hidrantes[i];
        if (h && h.fotos && typeof h.fotos === 'object') {
          h.fotos.antes = await trackDownload(h.fotos.antes, `hidrante_${i}_antes`, PHOTOS_DIR);
          h.fotos.prueba = await trackDownload(h.fotos.prueba, `hidrante_${i}_prueba`, PHOTOS_DIR);
          h.fotos.despues = await trackDownload(h.fotos.despues, `hidrante_${i}_despues`, PHOTOS_DIR);
        }
      }
    }

    if (Array.isArray(updated.incidencias)) {
      for (let i = 0; i < updated.incidencias.length; i++) {
        const inc = updated.incidencias[i];
        if (inc && Array.isArray(inc.fotos)) {
          for (let j = 0; j < inc.fotos.length; j++) {
            inc.fotos[j] = await trackDownload(inc.fotos[j], `incidencia_${i}_${j}`, PHOTOS_DIR);
          }
        }
      }
    }

    const deviceKeys = ['detectores', 'modulos', 'estaciones', 'estrovocopicas'];
    for (const key of deviceKeys) {
      if (Array.isArray(updated[key])) {
        for (let i = 0; i < updated[key].length; i++) {
          const item = updated[key][i];
          if (item && Array.isArray(item.fotos)) {
            for (let j = 0; j < item.fotos.length; j++) {
              item.fotos[j] = await trackDownload(item.fotos[j], `${key}_${i}_${j}`, PHOTOS_DIR);
            }
          }
        }
      }
    }

    return { report: updated, failures };
  } catch (e) {
    console.warn('downloadReportAssets failed', e);
    return { report, failures: [], error: true };
  }
}

export async function migrateReportPhotoUris(report, reportId) {
  try {
    if (!report || typeof report !== 'object') return report;
    const safeReportId = reportId || report.id || Date.now();
    const updated = JSON.parse(JSON.stringify(report));

    if (updated.p_fotos && Array.isArray(updated.p_fotos)) {
      for (let i = 0; i < updated.p_fotos.length; i++) {
        updated.p_fotos[i] = await persistPhotoUri(updated.p_fotos[i], safeReportId, `panel_${i}`);
      }
    }

    if (updated.logo_cliente) {
      updated.logo_cliente = await persistPhotoUri(updated.logo_cliente, safeReportId, `logo_cliente`);
    }

    if (updated.evidencias && typeof updated.evidencias === 'object') {
      for (const key of Object.keys(updated.evidencias)) {
        updated.evidencias[key] = await persistPhotoUri(updated.evidencias[key], safeReportId, `evidencia_${key}`);
      }
    }

    const deviceKeys = ['detectores', 'modulos', 'estaciones', 'estrovocopicas'];
    for (const key of deviceKeys) {
      if (Array.isArray(updated[key])) {
        for (let i = 0; i < updated[key].length; i++) {
          const item = updated[key][i];
          if (item && Array.isArray(item.fotos)) {
            for (let j = 0; j < item.fotos.length; j++) {
              item.fotos[j] = await persistPhotoUri(item.fotos[j], safeReportId, `${key}_${i}_${j}`);
            }
          }
        }
      }
    }

    if (Array.isArray(updated.hidrantes)) {
      for (let i = 0; i < updated.hidrantes.length; i++) {
        const h = updated.hidrantes[i];
        if (h && h.fotos && typeof h.fotos === 'object') {
          h.fotos.antes = await persistPhotoUri(h.fotos.antes, safeReportId, `hidrante_${i}_antes`);
          h.fotos.prueba = await persistPhotoUri(h.fotos.prueba, safeReportId, `hidrante_${i}_prueba`);
          h.fotos.despues = await persistPhotoUri(h.fotos.despues, safeReportId, `hidrante_${i}_despues`);
        }
      }
    }

    if (Array.isArray(updated.incidencias)) {
      for (let i = 0; i < updated.incidencias.length; i++) {
        const inc = updated.incidencias[i];
        if (inc && Array.isArray(inc.fotos)) {
          for (let j = 0; j < inc.fotos.length; j++) {
            inc.fotos[j] = await persistPhotoUri(inc.fotos[j], safeReportId, `incidencia_${i}_${j}`);
          }
        }
      }
    }

    const tableKeys = ['table_ig', 'table_md', 'table_me', 'table_mj', 'table_supresion'];
    for (const key of tableKeys) {
      if (Array.isArray(updated[key])) {
        for (let i = 0; i < updated[key].length; i++) {
          const row = updated[key][i];
          if (row && row.imagen) {
            row.imagen = await persistPhotoUri(row.imagen, safeReportId, `${key}_${i}_imagen`);
          }
        }
      }
    }

    // Migrar URIs en arrays anidados (reportes de Bombas)
    const nestedArrayKeys = [
      { arrayKey: 'cuartos', tableKey: 'table_ig' },
      { arrayKey: 'motores_diesel', tableKey: 'table_md' },
      { arrayKey: 'motores_electricos', tableKey: 'table_me' },
      { arrayKey: 'bombas_jockey', tableKey: 'table_mj' }
    ];
    for (const { arrayKey, tableKey } of nestedArrayKeys) {
      if (!Array.isArray(updated[arrayKey])) continue;
      for (let arrIdx = 0; arrIdx < updated[arrayKey].length; arrIdx++) {
        const arrItem = updated[arrayKey][arrIdx];
        if (!arrItem || !Array.isArray(arrItem[tableKey])) continue;
        for (let rowIdx = 0; rowIdx < arrItem[tableKey].length; rowIdx++) {
          const row = arrItem[tableKey][rowIdx];
          if (row && row.imagen) {
            row.imagen = await persistPhotoUri(
              row.imagen,
              safeReportId,
              `${arrayKey}_${arrIdx}_${tableKey}_${rowIdx}_imagen`
            );
          }
        }
      }
    }

    return updated;
  } catch (e) {
    console.warn('migrateReportPhotoUris failed', e);
    return report;
  }
}

function parseLocalPhotoFilename(name) {
  try {
    if (!name || typeof name !== 'string') return null;
    if (!name.startsWith('photo_')) return null;
    const base = name.replace(/\.[^.]+$/, '');
    const parts = base.split('_');
    if (parts.length < 4) return null;
    const ts = parts[parts.length - 1];
    if (!/^\d+$/.test(ts)) return null;
    const id = parts[1];
    const label = parts.slice(2, -1).join('_');
    if (!id || !label) return null;
    return { id, label, ts: Number(ts) };
  } catch (e) {
    return null;
  }
}

function parseLocalSignatureFilename(name) {
  try {
    if (!name || typeof name !== 'string') return null;
    if (!name.startsWith('sig_')) return null;
    const base = name.replace(/\.[^.]+$/, '');
    const parts = base.split('_');
    if (parts.length < 4) return null;
    const ts = parts[parts.length - 1];
    if (!/^\d+$/.test(ts)) return null;
    const id = parts[1];
    const signer = parts[2];
    if (!id || !signer) return null;
    return { id, signer, ts: Number(ts) };
  } catch (e) {
    return null;
  }
}

function setIfMissing(container, key, uri) {
  if (!container) return false;
  const current = container[key];
  if (!current || current === true || typeof current !== 'string') {
    container[key] = uri;
    return true;
  }
  return false;
}

function recoverLabelIntoReport(report, label, uri) {
  if (!report || !label || !uri) return false;
  let changed = false;

  if (label.startsWith('panel_')) {
    const idx = Number(label.replace('panel_', ''));
    if (Number.isFinite(idx)) {
      if (!Array.isArray(report.p_fotos)) report.p_fotos = [];
      if (!report.p_fotos[idx]) {
        report.p_fotos[idx] = uri;
        return true;
      }
    }
    return false;
  }

  if (label.startsWith('evidencia_')) {
    const key = label.replace('evidencia_', '');
    if (!report.evidencias || typeof report.evidencias !== 'object') report.evidencias = {};
    return setIfMissing(report.evidencias, key, uri);
  }

  const tableKeys = ['table_ig', 'table_md', 'table_mj'];
  for (const key of tableKeys) {
    if (label.startsWith(`${key}_`) && label.endsWith('_imagen')) {
      const mid = label.slice(key.length + 1, -'_imagen'.length);
      const idx = Number(mid);
      if (!Number.isFinite(idx)) return false;
      if (!Array.isArray(report[key])) return false;
      const row = report[key][idx];
      if (row && !row.imagen) {
        row.imagen = uri;
        return true;
      }
      return false;
    }
  }

  if (label.startsWith('hidrante_')) {
    const parts = label.split('_');
    const idx = Number(parts[1]);
    const fotoKey = parts[2];
    if (!Number.isFinite(idx) || !fotoKey) return false;
    if (!Array.isArray(report.hidrantes)) return false;
    const h = report.hidrantes[idx];
    if (!h || !h.fotos) return false;
    if (!h.fotos[fotoKey]) {
      h.fotos[fotoKey] = uri;
      return true;
    }
    return false;
  }

  if (label.startsWith('incidencia_')) {
    const parts = label.split('_');
    const idx = Number(parts[1]);
    const fotoIdx = Number(parts[2]);
    if (!Number.isFinite(idx) || !Number.isFinite(fotoIdx)) return false;
    if (!Array.isArray(report.incidencias)) return false;
    const inc = report.incidencias[idx];
    if (!inc) return false;
    if (!Array.isArray(inc.fotos)) inc.fotos = [];
    if (!inc.fotos[fotoIdx]) {
      inc.fotos[fotoIdx] = uri;
      return true;
    }
    return false;
  }

  const deviceKeys = ['detectores', 'modulos', 'estaciones', 'estrovocopicas'];
  for (const key of deviceKeys) {
    if (label.startsWith(`${key}_`)) {
      const parts = label.split('_');
      const idx = Number(parts[1]);
      const fotoIdx = Number(parts[2]);
      if (!Number.isFinite(idx) || !Number.isFinite(fotoIdx)) return false;
      if (!Array.isArray(report[key])) return false;
      const item = report[key][idx];
      if (!item) return false;
      if (!Array.isArray(item.fotos)) item.fotos = [];
      if (!item.fotos[fotoIdx]) {
        item.fotos[fotoIdx] = uri;
        return true;
      }
      return false;
    }
  }

  return changed;
}

export async function recoverLocalAssetsOnStartup() {
  try {
    await ensurePhotosDir();
    await ensureSignaturesDir();

    const photoFiles = await FileSystem.readDirectoryAsync(PHOTOS_DIR).catch(() => []);
    const sigFiles = await FileSystem.readDirectoryAsync(SIGNATURES_DIR).catch(() => []);

    const photosByReport = new Map();
    for (const name of photoFiles) {
      const parsed = parseLocalPhotoFilename(name);
      if (!parsed) continue;
      const uri = `${PHOTOS_DIR}${name}`;
      const bucket = photosByReport.get(parsed.id) || new Map();
      const existing = bucket.get(parsed.label);
      if (!existing || parsed.ts > existing.ts) {
        bucket.set(parsed.label, { uri, ts: parsed.ts });
      }
      photosByReport.set(parsed.id, bucket);
    }

    const sigByReport = new Map();
    for (const name of sigFiles) {
      const parsed = parseLocalSignatureFilename(name);
      if (!parsed) continue;
      const uri = `${SIGNATURES_DIR}${name}`;
      const bucket = sigByReport.get(parsed.id) || new Map();
      const existing = bucket.get(parsed.signer);
      if (!existing || parsed.ts > existing.ts) {
        bucket.set(parsed.signer, { uri, ts: parsed.ts });
      }
      sigByReport.set(parsed.id, bucket);
    }

    const reports = await getSafeMisReportes();
    if (reports.length === 0) return { recovered: 0, total: 0 };

    let recovered = 0;
    let changed = false;

    for (const report of reports) {
      if (!report || report.id == null) continue;
      const id = String(report.id);
      const photoBucket = photosByReport.get(id);
      const sigBucket = sigByReport.get(id);

      if (sigBucket) {
        const cliente = sigBucket.get('cliente');
        if (cliente && (!report.firma_cliente || report.firma_cliente === true || typeof report.firma_cliente !== 'string')) {
          report.firma_cliente = cliente.uri;
          recovered += 1;
          changed = true;
        }
        const tecnico = sigBucket.get('tecnico');
        if (tecnico && (!report.firma_tecnico || report.firma_tecnico === true || typeof report.firma_tecnico !== 'string')) {
          report.firma_tecnico = tecnico.uri;
          recovered += 1;
          changed = true;
        }
      }

      if (photoBucket) {
        for (const [label, item] of photoBucket.entries()) {
          const did = recoverLabelIntoReport(report, label, item.uri);
          if (did) {
            recovered += 1;
            changed = true;
          }
        }
      }
    }

    if (changed) {
      await saveWithSpaceCheck('mis_reportes', JSON.stringify(reports));
    }

    return { recovered, total: reports.length };
  } catch (e) {
    console.warn('recoverLocalAssetsOnStartup failed', e);
    return { recovered: 0, total: 0, error: true };
  }
}

async function uploadIfLocal(uri, path) {
  try {
    if (!uri) return null;
    if (uri.startsWith('http')) return uri;

    let base64 = '';
    if (uri.startsWith('data:')) {
      base64 = uri.replace(/^data:image\/\w+;base64,/, '');
    } else {
      try {
        // Usar ImageManipulator para obtener el base64 de forma ultra robusta y evitar bugs de FileSystem en Android
        const manipResult = await ImageManipulator.manipulateAsync(
          uri,
          [], // Sin redimensionar ni alterar la imagen original
          { base64: true }
        );
        base64 = manipResult.base64 || '';
        if (!base64) {
          throw new Error('ImageManipulator no devolvió base64');
        }
      } catch (readErr) {
        console.warn('Fallo al leer foto local, se ignorará y continuará:', readErr.message, uri);
        return null;
      }
    }

    let arrayBuffer;
    try {
      arrayBuffer = decode(base64);
    } catch (decErr) {
      console.warn('Fallo al decodificar base64, se ignorará y continuará:', decErr.message);
      return null;
    }

    const mimeType = inferImageMimeType(uri);

    const { error } = await supabase.storage
      .from(SUPABASE_STORAGE_BUCKET)
      .upload(path, arrayBuffer, {
        contentType: mimeType,
        upsert: true,
      });

    if (error) {
      console.warn('supabase upload error', error);
      Alert.alert(
        'Error de Carga Supabase',
        `Supabase rechazó la subida de la foto:\n\nCódigo: ${error.statusCode || error.status || 'Desconocido'}\nMensaje: ${error.message}\nPath: ${path}`
      );
      return null;
    }

    const { data, error: urlError } = supabase.storage
      .from(SUPABASE_STORAGE_BUCKET)
      .getPublicUrl(path);

    if (urlError) {
      console.warn('supabase getPublicUrl error', urlError);
      Alert.alert(
        'Error de URL Supabase',
        `Se subió la foto pero falló al obtener su URL pública:\n\n${urlError.message}`
      );
      return null;
    }

    return data?.publicUrl || null;
  } catch (e) {
    console.warn('uploadIfLocal supabase failed', e);
    Alert.alert(
      'Fallo Crítico de Carga',
      `Excepción en uploadIfLocal:\n\n${e.message}`
    );
    return null;
  }
}

const countLocalImagesInReport = (report) => {
  try {
    const isLocalImage = (val) =>
      typeof val === 'string' &&
      (val.startsWith('file://') || val.startsWith('content://') || val.startsWith('asset://') || val.startsWith('data:'));

    const walk = (val) => {
      if (!val) return 0;
      if (isLocalImage(val)) return 1;
      if (Array.isArray(val)) return val.reduce((sum, v) => sum + walk(v), 0);
      if (typeof val === 'object') return Object.values(val).reduce((sum, v) => sum + walk(v), 0);
      return 0;
    };

    return walk(report);
  } catch (e) {
    console.warn('countLocalImagesInReport failed', e);
    return 0;
  }
};

export async function backupReport(report) {
  try {
    const userId = await getCurrentUserId();
    const reportCopy = JSON.parse(JSON.stringify(report));
    const basePath = userId ? `${userId}/reports/${reportCopy.id}` : `reports/${reportCopy.id}`;
    console.log('backupReport: starting backup', report && report.id);
    const localBefore = countLocalImagesInReport(reportCopy);

    if (reportCopy.id) {
      try {
        const { data: existingRows, error: fetchError } = await supabase
          .from('reports')
          .select('id,last_backup,data')
          .eq('id', reportCopy.id)
          .limit(1);

        if (!fetchError && Array.isArray(existingRows) && existingRows.length > 0) {
          const existing = existingRows[0];
          const localTs = new Date(reportCopy.ultimoCambio || reportCopy.lastBackup || 0).getTime();
          const remoteTs = new Date(existing?.data?.ultimoCambio || existing?.last_backup || 0).getTime();

          if (remoteTs && localTs && remoteTs > localTs) {
            const oldId = reportCopy.id;
            reportCopy._conflictOf = oldId;
            reportCopy.id = Date.now();
            console.warn('backupReport: conflict detected, duplicating report', { oldId, newId: reportCopy.id });
          }
        }
      } catch (conflictErr) {
        console.warn('backupReport: conflict check failed', conflictErr);
      }
    }

    // Subir evidencias
    if (reportCopy.evidencias) {
      for (const k of Object.keys(reportCopy.evidencias)) {
        const uri = reportCopy.evidencias[k];
        if (uri) {
          const path = `${basePath}/${k}.jpg`;
          const uploaded = await uploadIfLocal(uri, path);
          if (uploaded) reportCopy.evidencias[k] = uploaded;
        }
      }
    }

    // Subir tablas/arrays con imágenes (nivel raíz)
    const tableKeys = [
      'table_ig',
      'table_md',
      'table_me',
      'table_mj',
      'table_supresion',
      'p_fotos',
      'hidrantes',
      'incidencias',
      'detectores',
      'modulos',
      'estaciones',
      'estrovocopicas'
    ];
    for (const key of tableKeys) {
      if (Array.isArray(reportCopy[key])) {
        for (let i = 0; i < reportCopy[key].length; i++) {
          const row = reportCopy[key][i];
          if (typeof row === 'string') {
            const uploaded = await uploadIfLocal(row, `${basePath}/${key}_${i}.jpg`);
            if (uploaded) reportCopy[key][i] = uploaded;
            continue;
          }
          if (!row) continue;
          if (row.imagen) {
            const uploaded = await uploadIfLocal(row.imagen, `${basePath}/${key}_${i}_imagen.jpg`);
            if (uploaded) row.imagen = uploaded;
          }
          if (row.fotos && Array.isArray(row.fotos)) {
            for (let j = 0; j < row.fotos.length; j++) {
              const furi = row.fotos[j];
              if (furi) {
                const uploaded = await uploadIfLocal(furi, `${basePath}/${key}_${i}_foto_${j}.jpg`);
                if (uploaded) row.fotos[j] = uploaded;
              }
            }
          }
          if (row.fotos && !Array.isArray(row.fotos) && typeof row.fotos === 'object') {
            for (const fotoKey of Object.keys(row.fotos)) {
              const furi = row.fotos[fotoKey];
              if (furi) {
                const uploaded = await uploadIfLocal(
                  furi,
                  `${basePath}/${key}_${i}_${fotoKey}.jpg`
                );
                if (uploaded) row.fotos[fotoKey] = uploaded;
              }
            }
          }
        }
      }
    }

    // Subir imágenes en arrays anidados (reportes de Bombas: cuartos, motores_diesel, motores_electricos, bombas_jockey)
    const nestedArrayKeys = [
      { arrayKey: 'cuartos', tableKey: 'table_ig' },
      { arrayKey: 'motores_diesel', tableKey: 'table_md' },
      { arrayKey: 'motores_electricos', tableKey: 'table_me' },
      { arrayKey: 'bombas_jockey', tableKey: 'table_mj' }
    ];
    for (const { arrayKey, tableKey } of nestedArrayKeys) {
      if (!Array.isArray(reportCopy[arrayKey])) continue;
      for (let arrIdx = 0; arrIdx < reportCopy[arrayKey].length; arrIdx++) {
        const arrItem = reportCopy[arrayKey][arrIdx];
        if (!arrItem || !Array.isArray(arrItem[tableKey])) continue;
        for (let rowIdx = 0; rowIdx < arrItem[tableKey].length; rowIdx++) {
          const row = arrItem[tableKey][rowIdx];
          if (row && row.imagen) {
            const uploaded = await uploadIfLocal(
              row.imagen,
              `${basePath}/${arrayKey}_${arrIdx}_${tableKey}_${rowIdx}_imagen.jpg`
            );
            if (uploaded) row.imagen = uploaded;
          }
        }
      }
    }

    // Subir logo_cliente si es local
    if (reportCopy.logo_cliente) {
      const path = `${basePath}/logo_cliente.jpg`;
      const uploaded = await uploadIfLocal(reportCopy.logo_cliente, path);
      if (uploaded) reportCopy.logo_cliente = uploaded;
    }

    // Subir firmas si son locales
    if (reportCopy.firma_cliente) {
      const localSig = await persistSignatureDataUrl(reportCopy.firma_cliente, reportCopy.id, 'cliente');
      const uploaded = await uploadIfLocal(localSig, `${basePath}/firma_cliente.png`);
      if (uploaded) reportCopy.firma_cliente = uploaded;
      else if (localSig) reportCopy.firma_cliente = localSig;
    }
    if (reportCopy.firma_tecnico) {
      const localSig = await persistSignatureDataUrl(reportCopy.firma_tecnico, reportCopy.id, 'tecnico');
      const uploaded = await uploadIfLocal(localSig, `${basePath}/firma_tecnico.png`);
      if (uploaded) reportCopy.firma_tecnico = uploaded;
      else if (localSig) reportCopy.firma_tecnico = localSig;
    }

    // Guardar/actualizar en tabla 'reports' de Supabase
    reportCopy.lastBackup = new Date().toISOString();
    
    // Asegurar que el reporte tenga un ID antes de subir
    if (!reportCopy.id) {
      reportCopy.id = Date.now();
      console.warn('backupReport: reportCopy.id was missing, generated new one:', reportCopy.id);
    }

    const payload = {
      id: reportCopy.id,
      user_id: userId || null,
      client: reportCopy.cliente || null,
      tipo: reportCopy.tipo || null,
      data: reportCopy,
      last_backup: reportCopy.lastBackup
    };

    console.log('backupReport: payload prepared, sending to Supabase', { id: payload.id, client: payload.client });
    const { data, error, status, statusText } = await supabase
      .from('reports')
      .upsert(payload, { onConflict: 'id' });
    if (error) {
      console.error('backupReport: supabase upsert error (raw):', error);
      console.error('backupReport: supabase upsert error (status):', { status, statusText });
      try {
        const errStr = JSON.stringify(error, Object.getOwnPropertyNames(error || {}), 2);
        console.error('backupReport: supabase upsert error (full):', errStr);
      } catch (err) {
        console.error('backupReport: supabase upsert error (could not stringify):', error);
      }
      throw error;
    }
    console.log('backupReport: Backup saved in Supabase', data);
    const localAfter = countLocalImagesInReport(reportCopy);
    return {
      report: reportCopy,
      totalLocal: localBefore,
      remainingLocal: localAfter,
      uploadedCount: Math.max(localBefore - localAfter, 0)
    };
  } catch (e) {
    console.warn('backupReport supabase failed', e);
    throw e;
  }
}

export async function reuploadReportAssets(report) {
  return backupReport(report);
}

export async function listBackups(options = {}) {
  try {
    const includeAll = options?.includeAll === true;
    const userId = await getCurrentUserId();
    if (!includeAll && !userId) return [];

    let query = supabase.from('reports').select('*').order('last_backup', { ascending: false });
    if (!includeAll) {
      query = query.eq('user_id', userId);
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data || []).map((row) => {
      const report = row?.data && typeof row.data === 'object' ? row.data : {};
      return {
        ...report,
        id: report.id ?? row.id,
        cliente: report.cliente ?? row.client ?? row.cliente,
        tipo: report.tipo ?? row.tipo,
        lastBackup: row.last_backup ?? report.lastBackup,
        ownerId: row.user_id ?? report.user_id ?? null,
        _raw: row
      };
    });
  } catch (e) {
    console.warn('listBackups failed', e);
    return [];
  }
}

export async function deleteBackupById(id) {
  if (!id) throw new Error('Missing backup id');
  try {
    const { error } = await supabase.from('reports').delete().eq('id', id);
    if (error) throw error;
    return true;
  } catch (e) {
    console.warn('deleteBackupById failed', e);
    throw e;
  }
}

export async function saveUserSnapshot() {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return false;
    const keys = await AsyncStorage.getAllKeys();
    const filtered = keys.filter((key) => !USER_DATA_EXCLUDE_KEYS.has(key));
    const entries = await AsyncStorage.multiGet(filtered);
    const data = {};
    for (const [key, value] of entries) {
      if (typeof value !== 'string') continue;
      if (key === 'mis_reportes') {
        try {
          const parsed = JSON.parse(value);
          // Limit to max 30 to avoid blowing up user snapshot
          const limited = Array.isArray(parsed) ? parsed.slice(-30) : [];
          const sanitized = sanitizeReportsForStorage(limited);
          data[key] = JSON.stringify(sanitized);
          continue;
        } catch (e) {
          // Fall back to raw value if parsing fails.
        }
      }
      data[key] = value;
    }
    const payload = {
      user_id: userId,
      data,
      updated_at: new Date().toISOString()
    };
    const { error } = await supabase.from(USER_DATA_TABLE).upsert(payload, { onConflict: 'user_id' });
    if (error) throw error;
    return true;
  } catch (e) {
    console.warn('saveUserSnapshot failed', e);
    return false;
  }
}

export async function restoreUserSnapshot() {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return false;
    const { data, error } = await supabase
      .from(USER_DATA_TABLE)
      .select('data')
      .eq('user_id', userId)
      .single();
    if (error || !data?.data) return false;
    const entries = Object.entries(data.data).filter(([, value]) => typeof value === 'string');
    if (entries.length === 0) return false;

    const parseJsonArray = (value) => {
      try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : [];
      } catch (e) {
        return [];
      }
    };

    const mergeClients = (localList, remoteList) => {
      const map = new Map();
      for (const item of localList) {
        const key = item?.id || item?.nombre || '';
        if (key) map.set(String(key).toLowerCase(), item);
      }
      for (const item of remoteList) {
        const key = item?.id || item?.nombre || '';
        const normalized = String(key || '').toLowerCase();
        if (!normalized) continue;
        if (!map.has(normalized)) map.set(normalized, item);
      }
      return Array.from(map.values());
    };

    const getReportTs = (item) => {
      const raw = item?.ultimoCambio || item?.fechaGuardado || item?.lastBackup || item?.g_fecha || '';
      const ts = new Date(raw).getTime();
      return Number.isFinite(ts) ? ts : 0;
    };

    const mergeReports = (localList, remoteList) => {
      const map = new Map();
      for (const item of localList) {
        if (item?.id == null) continue;
        map.set(String(item.id), item);
      }
      for (const item of remoteList) {
        if (item?.id == null) continue;
        const key = String(item.id);
        if (!map.has(key)) {
          map.set(key, item);
          continue;
        }
        const current = map.get(key);
        const currentCount = countImagesInReport(current);
        const remoteCount = countImagesInReport(item);
        if (remoteCount > currentCount) {
          map.set(key, item);
          continue;
        }
        const pick = getReportTs(item) > getReportTs(current) ? item : current;
        map.set(key, pick);
      }
      return Array.from(map.values());
    };

    const updates = [];
    for (const [key, value] of entries) {
      if (key === '@lista_clientes') {
        const localValue = await AsyncStorage.getItem(key);
        const localList = parseJsonArray(localValue || '[]');
        const remoteList = parseJsonArray(value);
        const merged = mergeClients(localList, remoteList);
        updates.push([key, JSON.stringify(merged)]);
        continue;
      }
      if (key === 'mis_reportes') {
        const localValue = await AsyncStorage.getItem(key);
        const localList = parseJsonArray(localValue || '[]');
        const remoteList = parseJsonArray(value);
        const merged = mergeReports(localList, remoteList);
        updates.push([key, JSON.stringify(merged)]);
        continue;
      }
      updates.push([key, value]);
    }

    if (updates.length === 0) return false;
    await AsyncStorage.multiSet(updates);
    return true;
  } catch (e) {
    console.warn('restoreUserSnapshot failed', e);
    return false;
  }
}

export async function restoreToLocal(reportsArray) {
  try {
    if (!Array.isArray(reportsArray)) return;
    await saveWithSpaceCheck('mis_reportes', JSON.stringify(reportsArray));
    console.log('Restored reports to local storage');
  } catch (e) {
    console.warn('restoreToLocal failed', e);
  }
}

// Guarda en AsyncStorage y, si se detecta SQLITE_FULL, limpia borradores vacíos y reintenta.
export async function saveWithSpaceCheck(key, value) {
  try {
    await AsyncStorage.setItem(key, value);
    return true;
  } catch (e) {
    const msg = e?.message || '';
    const isFull = msg.includes('SQLITE_FULL') || msg.includes('database or disk is full') || msg.includes('CursorWindow');
    if (isFull) {
      console.warn('saveWithSpaceCheck: disk full or CursorWindow limit detected, running cleanupLocalStorage');
      try {
        await cleanupLocalStorage();
        await AsyncStorage.setItem(key, value);
        return true;
      } catch (retryErr) {
        console.warn('saveWithSpaceCheck: retry after cleanup failed', retryErr);
        if (msg.includes('CursorWindow')) {
          throw new Error('El reporte o el historial es muy grande para guardarlo localmente (Límite Android 2MB). Borra reportes antiguos.');
        }
        throw retryErr;
      }
    }
    throw e;
  }
}

/**
 * Limpiar datos temporales y caché de AsyncStorage para liberar espacio
 * Elimina: reporte_temporal, borradores viejos (sin fotos subidas)
 */
export async function cleanupLocalStorage() {
  try {
    console.log('cleanupLocalStorage: starting cleanup');
    
    // Eliminar archivo temporal de edición
    await AsyncStorage.removeItem('reporte_temporal');
    console.log('cleanupLocalStorage: removed reporte_temporal');
    
    // Obtener todos los reportes guardados de forma segura
    let reportes = await getSafeMisReportes();
    const initialCount = reportes.length;
    
    // Filtrar: mantener solo reportes con datos (no borradores vacíos)
    // Un borrador vacío típicamente solo tiene campos de fecha y cliente sin tablas completadas
    reportes = reportes.filter(r => {
      const hasTables = (r.table_ig && r.table_ig.length > 0) ||
                        (r.table_md && r.table_md.length > 0) ||
                        (r.table_mj && r.table_mj.length > 0) ||
                        (r.p_fotos && r.p_fotos.length > 0) ||
                        (r.hidrantes && r.hidrantes.length > 0) ||
                        (r.incidencias && r.incidencias.length > 0) ||
                        (r.detectores && r.detectores.length > 0) ||
                        (r.modulos && r.modulos.length > 0) ||
                        (r.estaciones && r.estaciones.length > 0);
      const hasSignatures = r.firma_cliente || r.firma_tecnico;
      const hasEvidences = r.evidencias && Object.values(r.evidencias).some(e => e);
      const hasNotes = typeof r.p_obs === 'string' && r.p_obs.trim().length > 0;
      return hasTables || hasSignatures || hasEvidences || hasNotes;
    });
    
    // Limitar el máximo total de reportes en local a 50 para evitar CursorWindow a largo plazo
    if (reportes.length > 50) {
      // Ordenar por ultimoCambio / fechaGuardado (asumiendo que están o por ID)
      // Recortar dejando solo los últimos 50 (más recientes)
      reportes = reportes.slice(-50);
    }

    const removed = initialCount - reportes.length;
    await AsyncStorage.setItem('mis_reportes', JSON.stringify(reportes));
    console.log('cleanupLocalStorage: removed', removed, 'empty/excess drafts, kept', reportes.length);
    
    return { cleaned: true, removed, kept: reportes.length };
  } catch (e) {
    console.warn('cleanupLocalStorage failed', e);
    throw e;
  }
}

/**
 * Obtener tamaño aproximado del almacenamiento local (en bytes)
 */
export async function getLocalStorageSize() {
  try {
    const allKeys = await AsyncStorage.getAllKeys();
    let totalSize = 0;
    
    for (const key of allKeys) {
      const value = await AsyncStorage.getItem(key);
      if (value) {
        totalSize += value.length;
      }
    }
    
    return {
      bytes: totalSize,
      kb: (totalSize / 1024).toFixed(2),
      mb: (totalSize / (1024 * 1024)).toFixed(2)
    };
  } catch (e) {
    console.warn('getLocalStorageSize failed', e);
    return { bytes: 0, kb: '0', mb: '0' };
  }
}

/**
 * Optimizar y comprimir un reporte antes de guardar localmente
 * Elimina URIs de fotos locales, mantiene solo URLs de Supabase
 */
export function optimizeReportForStorage(report, options = {}) {
  try {
    const optimized = JSON.parse(JSON.stringify(report));
    const keepLocal = options?.keepLocal === true;

    const keepRemoteOnly = (uri) => {
      if (!uri || typeof uri !== 'string') return null;
      // Strip massive base64 strings to prevent Android SQLite CursorWindow crashes (2MB limit)
      if (uri.startsWith('data:image') && uri.length > 30000) return null;
      if (keepLocal) return uri;
      // Keep only remote URLs so snapshots work on other devices.
      if (uri.startsWith('http://') || uri.startsWith('https://')) return uri;
      return null;
    };
    
    // Eliminar URIs locales de evidencias (mantener solo URLs de Supabase)
    if (optimized.evidencias) {
      for (const key in optimized.evidencias) {
        const uri = optimized.evidencias[key];
        // Si comienza con 'http', es URL de Supabase; si es 'file://', eliminarlo
        optimized.evidencias[key] = keepRemoteOnly(uri);
      }
    }
    
    // Eliminar URIs locales de imágenes en tablas (nivel raíz)
    const tableKeys = [
      'table_ig',
      'table_md',
      'table_me',
      'table_mj',
      'table_supresion',
      'p_fotos',
      'hidrantes',
      'incidencias',
      'detectores',
      'modulos',
      'estaciones'
    ];
    for (const key of tableKeys) {
      if (Array.isArray(optimized[key])) {
        for (let i = 0; i < optimized[key].length; i++) {
          const row = optimized[key][i];
          if (typeof row === 'string') {
            optimized[key][i] = keepRemoteOnly(row);
            continue;
          }
          if (!row) continue;
          
          // Limpiar imagen en tabla
          if (row.imagen) row.imagen = keepRemoteOnly(row.imagen);
          
          // Limpiar fotos en arrays
          if (row.fotos && Array.isArray(row.fotos)) {
            row.fotos = row.fotos.map((f) => keepRemoteOnly(f));
          }

          if (row.fotos && !Array.isArray(row.fotos) && typeof row.fotos === 'object') {
            Object.keys(row.fotos).forEach((k) => {
              row.fotos[k] = keepRemoteOnly(row.fotos[k]);
            });
          }
        }
      }
    }

    // Limpiar imágenes en arrays anidados (reportes de Bombas)
    const nestedArrayKeys = [
      { arrayKey: 'cuartos', tableKey: 'table_ig' },
      { arrayKey: 'motores_diesel', tableKey: 'table_md' },
      { arrayKey: 'motores_electricos', tableKey: 'table_me' },
      { arrayKey: 'bombas_jockey', tableKey: 'table_mj' }
    ];
    for (const { arrayKey, tableKey } of nestedArrayKeys) {
      if (!Array.isArray(optimized[arrayKey])) continue;
      for (let arrIdx = 0; arrIdx < optimized[arrayKey].length; arrIdx++) {
        const arrItem = optimized[arrayKey][arrIdx];
        if (!arrItem || !Array.isArray(arrItem[tableKey])) continue;
        for (let rowIdx = 0; rowIdx < arrItem[tableKey].length; rowIdx++) {
          const row = arrItem[tableKey][rowIdx];
          if (row && row.imagen) {
            row.imagen = keepRemoteOnly(row.imagen);
          }
        }
      }
    }
    
    // Eliminar firmas base64 locales (muy pesadas, guardar solo booleano de que existen)
    // Esto reduce drásticamente el tamaño cuando no se conserva local.
    if (optimized.firma_cliente && typeof optimized.firma_cliente === 'string') {
      optimized.firma_cliente = keepRemoteOnly(optimized.firma_cliente) || (keepLocal ? optimized.firma_cliente : true);
    }
    if (optimized.firma_tecnico && typeof optimized.firma_tecnico === 'string') {
      optimized.firma_tecnico = keepRemoteOnly(optimized.firma_tecnico) || (keepLocal ? optimized.firma_tecnico : true);
    }

    if (optimized.logo_cliente && typeof optimized.logo_cliente === 'string') {
      optimized.logo_cliente = keepRemoteOnly(optimized.logo_cliente);
    }
    
    return optimized;
  } catch (e) {
    console.warn('optimizeReportForStorage failed', e);
    return report; // Fallback: devolver original si hay error
  }
}

export function sanitizeReportsForStorage(reports, options = {}) {
  try {
    if (!Array.isArray(reports)) return [];
    return reports.map((r) => optimizeReportForStorage(r, options)).filter(Boolean);
  } catch (e) {
    console.warn('sanitizeReportsForStorage failed', e);
    return Array.isArray(reports) ? reports : [];
  }
}

export const MAX_IMAGES_PER_REPORT = 1500;

export function countImagesInReport(report) {
  try {
    const isImageString = (val) =>
      typeof val === 'string' && (val.startsWith('http') || val.startsWith('file:') || val.startsWith('data:'));

    const walk = (val) => {
      if (!val) return 0;
      if (isImageString(val)) return 1;
      if (Array.isArray(val)) return val.reduce((sum, v) => sum + walk(v), 0);
      if (typeof val === 'object') {
        return Object.values(val).reduce((sum, v) => sum + walk(v), 0);
      }
      return 0;
    };

    return walk(report);
  } catch (e) {
    console.warn('countImagesInReport failed', e);
    return 0;
  }
}

// Sin límite: función obsoleta, siempre permite agregar
export function canAddImage(report, extra = 1) {
  return true;
}

/**
 * Enforce image limit on a report
 * Alerts user if limit exceeded and optionally removes oldest images
 * @param {Object} report - Report object to validate
 * @param {number} maxImages - Maximum images allowed (default 1500)
 * @returns {Object} Result object with warnings
 */
export function enforceImageLimit(report, maxImages = MAX_IMAGES_PER_REPORT) {
  // Sin límite: no aplica restricción
  return {
    current: countImagesInReport(report),
    maxImages: Infinity,
    exceeds: false,
    excess: 0
  };
}

const PENDING_BACKUPS_KEY = 'pending_backups';

export async function enqueueBackup(report) {
  try {
    const json = await AsyncStorage.getItem(PENDING_BACKUPS_KEY);
    const pending = json ? JSON.parse(json) : [];
    const id = report?.id || Date.now();

    const existingIndex = pending.findIndex((p) => String(p.id) === String(id));
    const payload = { id, report, queuedAt: new Date().toISOString() };

    if (existingIndex >= 0) {
      pending[existingIndex] = payload;
    } else {
      pending.push(payload);
    }

    await AsyncStorage.setItem(PENDING_BACKUPS_KEY, JSON.stringify(pending));

    const state = await NetInfo.fetch();
    const hasInternet = state.isConnected === true;
    if (hasInternet) {
      await syncPendingBackups();
    }

    return { queued: true, count: pending.length };
  } catch (e) {
    console.warn('enqueueBackup failed', e);
    throw e;
  }
}

export async function syncPendingBackups() {
  try {
    const state = await NetInfo.fetch();
    const hasInternet = state.isConnected === true;
    if (!hasInternet) {
      return { synced: 0, remaining: -1, skipped: true };
    }

    const json = await AsyncStorage.getItem(PENDING_BACKUPS_KEY);
    const pending = json ? JSON.parse(json) : [];
    if (!pending.length) return { synced: 0, remaining: 0 };

    const remaining = [];
    let synced = 0;

    for (const item of pending) {
      try {
        await backupReport(item.report);
        synced += 1;
      } catch (e) {
        remaining.push(item);
      }
    }

    await AsyncStorage.setItem(PENDING_BACKUPS_KEY, JSON.stringify(remaining));
    return { synced, remaining: remaining.length };
  } catch (e) {
    console.warn('syncPendingBackups failed', e);
    return { synced: 0, remaining: -1 };
  }
}

export async function migrateLocalReportsToUser(options = {}) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return { migrated: 0, queued: 0, skipped: true, reason: 'no-user' };

    const migrationKey = `@reports_migrated_${userId}`;
    if (!options.force) {
      const done = await AsyncStorage.getItem(migrationKey);
      if (done === '1') return { migrated: 0, queued: 0, skipped: true, reason: 'already' };
    }

    const state = await NetInfo.fetch();
    const hasInternet = state.isConnected === true;
    if (!hasInternet) {
      return { migrated: 0, queued: 0, skipped: true, reason: 'offline' };
    }

    const list = await getSafeMisReportes();
    if (list.length === 0) {
      await AsyncStorage.setItem(migrationKey, '1');
      return { migrated: 0, queued: 0, skipped: false };
    }

    const maxReports = Number(options.maxReports) || 0;
    const reports = maxReports > 0 ? list.slice(0, maxReports) : list;
    let queued = 0;

    for (const report of reports) {
      try {
        await enqueueBackup(report);
        queued += 1;
      } catch (e) {
        // Keep going; failed items stay local.
      }
    }

    await AsyncStorage.setItem(migrationKey, '1');
    return { migrated: 0, queued };
  } catch (e) {
    console.warn('migrateLocalReportsToUser failed', e);
    return { migrated: 0, queued: 0, skipped: true, reason: 'error' };
  }
}

export function startAutoSync() {
  const unsubscribe = NetInfo.addEventListener((state) => {
    if (state.isConnected && state.isInternetReachable === true) {
      syncPendingBackups();
    }
  });

  return unsubscribe;
}

export async function diagnoseSupabase() {
  const status = {
    netinfo: 'Desconocido',
    supabaseInit: 'No',
    dbConnection: 'Fallido',
    authSession: 'No autenticado',
    storageAccess: 'Fallido',
    details: ''
  };

  try {
    const netState = await NetInfo.fetch();
    status.netinfo = `Conectado: ${netState.isConnected ? 'SÍ' : 'NO'}, Tipo: ${netState.type}, Internet accesible: ${netState.isInternetReachable !== false ? 'SÍ' : 'NO'}`;

    if (supabase) {
      status.supabaseInit = 'SÍ';
    } else {
      status.supabaseInit = 'NO (Faltan credenciales)';
      return status;
    }

    try {
      const { data, error, status: httpStatus } = await supabase.from('reports').select('id').limit(1);
      if (error) {
        status.dbConnection = `Error (HTTP ${httpStatus}): ${error.message}`;
      } else {
        status.dbConnection = `Exitosa (HTTP ${httpStatus}), Filas encontradas: ${data?.length}`;
      }
    } catch (dbErr) {
      status.dbConnection = `Excepción: ${dbErr.message}`;
    }

    try {
      const { data: { user }, error: authErr } = await supabase.auth.getUser();
      if (authErr || !user) {
        status.authSession = 'No autenticado (Usuario Anónimo)';
      } else {
        status.authSession = `Autenticado: ${user.email} (ID: ${user.id})`;
      }
    } catch (authErr) {
      status.authSession = `Excepción al verificar auth: ${authErr.message}`;
    }

    try {
      const { data, error: storageErr } = await supabase.storage.from(SUPABASE_STORAGE_BUCKET).list('', { limit: 1 });
      if (storageErr) {
        status.storageAccess = `Error: ${storageErr.message}`;
      } else {
        status.storageAccess = `Exitosa. Bucket '${SUPABASE_STORAGE_BUCKET}' accesible. Archivos listados: ${data?.length}`;
      }
    } catch (storErr) {
      status.storageAccess = `Excepción: ${storErr.message}`;
    }

  } catch (e) {
    status.details = `Error general de diagnóstico: ${e.message}`;
  }

  return status;
}
