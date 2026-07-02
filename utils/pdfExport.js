import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

function getSafePdfName(fileName = 'reporte.pdf') {
  return fileName.toLowerCase().endsWith('.pdf') ? fileName : `${fileName}.pdf`;
}

function base64ToBlob(pdfBase64) {
  const clean = String(pdfBase64 || '').replace(/^data:application\/pdf;base64,/, '');
  const byteCharacters = atob(clean);
  const byteNumbers = new Array(byteCharacters.length);

  for (let i = 0; i < byteCharacters.length; i += 1) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }

  return new Blob([new Uint8Array(byteNumbers)], { type: 'application/pdf' });
}

async function shareBlobFile(blob, fileName) {
  if (Platform.OS !== 'web' || typeof navigator === 'undefined') return false;
  if (typeof File === 'undefined' || typeof navigator.share !== 'function') return false;

  const file = new File([blob], getSafePdfName(fileName), { type: 'application/pdf' });
  if (typeof navigator.canShare === 'function' && !navigator.canShare({ files: [file] })) {
    return false;
  }

  await navigator.share({
    files: [file],
    title: getSafePdfName(fileName),
    text: 'Reporte PDF'
  });
  return true;
}

function openPrintableHtml(html, title = 'reporte.pdf') {
  if (typeof window === 'undefined') return false;

  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    window.alert?.('Permite ventanas emergentes para imprimir o guardar el PDF.');
    return false;
  }

  const toolbar = `
    <style>
      .web-pdf-toolbar {
        position: fixed;
        top: 12px;
        right: 12px;
        z-index: 99999;
        display: flex;
        gap: 8px;
        font-family: Arial, sans-serif;
      }
      .web-pdf-toolbar button {
        border: 0;
        border-radius: 6px;
        padding: 10px 12px;
        background: #111827;
        color: #fff;
        cursor: pointer;
        font-size: 13px;
        font-weight: 700;
      }
      @media print {
        .web-pdf-toolbar { display: none !important; }
      }
    </style>
    <div class="web-pdf-toolbar">
      <button type="button" onclick="window.print()">Guardar PDF</button>
      <button type="button" onclick="if (navigator.share) navigator.share({ title: document.title, text: 'Reporte PDF' }).catch(function(){}); else window.print();">Compartir</button>
    </div>
  `;
  const htmlWithToolbar = String(html || '').replace(/<body([^>]*)>/i, `<body$1>${toolbar}`);

  printWindow.document.open();
  printWindow.document.write(htmlWithToolbar);
  printWindow.document.title = title;
  printWindow.document.close();
  printWindow.focus();

  setTimeout(() => {
    try {
      printWindow.print();
    } catch (e) {
      console.warn('No se pudo abrir el dialogo de impresion web', e);
    }
  }, 350);

  return true;
}

export async function printHtmlToPdf({ html, fileName = 'reporte.pdf' }) {
  if (Platform.OS === 'web') {
    openPrintableHtml(html, fileName);
    return { uri: null, openedInBrowser: true };
  }

  return Print.printToFileAsync({ html });
}

export async function sharePdfUri(uri, options = {}) {
  if (!uri) return false;

  if (Platform.OS === 'web') {
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({
          title: options.dialogTitle || 'Reporte PDF',
          text: 'Reporte PDF',
          url: uri
        });
        return true;
      } catch (e) {
        if (e?.name === 'AbortError') return false;
      }
    }

    if (typeof window !== 'undefined') window.open(uri, '_blank');
    return true;
  }

  await Sharing.shareAsync(uri, options);
  return true;
}

export function downloadBase64Pdf(pdfBase64, fileName = 'reporte.pdf') {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return false;

  const safeName = getSafePdfName(fileName);
  const link = document.createElement('a');
  link.href = `data:application/pdf;base64,${pdfBase64}`;
  link.download = safeName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  return true;
}

export async function shareOrDownloadBase64Pdf(pdfBase64, fileName = 'reporte.pdf') {
  if (Platform.OS !== 'web') return false;

  try {
    const blob = base64ToBlob(pdfBase64);
    const shared = await shareBlobFile(blob, fileName);
    if (shared) return true;
  } catch (e) {
    if (e?.name === 'AbortError') return false;
    console.warn('No se pudo compartir PDF en web, se descargara el archivo', e);
  }

  return downloadBase64Pdf(pdfBase64, fileName);
}
