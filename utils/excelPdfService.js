import Constants from 'expo-constants';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import { shareOrDownloadBase64Pdf } from './pdfExport';

const extras = Constants.expoConfig?.extra || Constants.manifest?.extra || {};
const EXCEL_PDF_API_URL = extras.EXCEL_PDF_API_URL || process.env.EXCEL_PDF_API_URL || '';

export function getExcelPdfApiUrl() {
  return EXCEL_PDF_API_URL;
}

function assertApiUrl() {
  if (!EXCEL_PDF_API_URL) {
    throw new Error('EXCEL_PDF_API_URL is not configured in app.config.js/.env');
  }
}

export function buildExcelTemplateKey(report) {
  const tipo = String(report?.tipo || '').toLowerCase();
  if (tipo === 'alarma') return 'alarma';
  if (tipo === 'hidrantes') return 'hidrantes';
  if (tipo === 'bombas') return 'bombas';
  throw new Error(`Unsupported report type for Excel template: ${report?.tipo || 'unknown'}`);
}

export async function requestPdfFromExcelTemplate({ templateKey, reportData, fileName }) {
  assertApiUrl();

  const response = await fetch(`${EXCEL_PDF_API_URL}/render`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      templateKey,
      data: reportData,
      fileName
    })
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok || !payload?.ok) {
    throw new Error(payload?.error || `Excel PDF service failed (${response.status})`);
  }

  if (!payload?.pdfBase64) {
    throw new Error('Excel PDF service returned no pdfBase64');
  }

  return payload;
}

export async function saveAndSharePdfBase64({ pdfBase64, fileName = 'reporte.xlsx.pdf' }) {
  const safeName = fileName.toLowerCase().endsWith('.pdf') ? fileName : `${fileName}.pdf`;

  if (Platform.OS === 'web') {
    await shareOrDownloadBase64Pdf(pdfBase64, safeName);
    return safeName;
  }

  const uri = `${FileSystem.cacheDirectory}${safeName}`;

  await FileSystem.writeAsStringAsync(uri, pdfBase64, {
    encoding: 'base64'
  });

  const canShare = await Sharing.isAvailableAsync();
  if (canShare) {
    await Sharing.shareAsync(uri, {
      mimeType: 'application/pdf',
      dialogTitle: 'Compartir PDF generado desde plantilla Excel'
    });
  }

  return uri;
}

export async function generateAndSharePdfFromExcel({ reportData, templateKey, fileName }) {
  const selectedTemplate = templateKey || buildExcelTemplateKey(reportData);
  const payload = await requestPdfFromExcelTemplate({
    templateKey: selectedTemplate,
    reportData,
    fileName
  });

  const outputUri = await saveAndSharePdfBase64({
    pdfBase64: payload.pdfBase64,
    fileName: payload.fileName || fileName || `reporte-${Date.now()}.pdf`
  });

  return {
    uri: outputUri,
    fileName: payload.fileName || fileName,
    templateKey: selectedTemplate
  };
}
