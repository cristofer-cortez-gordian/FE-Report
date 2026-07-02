import cors from 'cors';
import 'dotenv/config';
import ExcelJS from 'exceljs';
import express from 'express';
import morgan from 'morgan';
import { existsSync } from 'node:fs';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { convertXlsxToPdf } from './convertToPdf.js';
import { applyTemplateData } from './mappers.js';

const app = express();
const port = Number(process.env.PORT || 5050);
const sofficeBin = process.env.SOFFICE_BIN || 'soffice';

app.use(cors());
app.use(express.json({ limit: '20mb' }));
app.use(morgan('dev'));

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'excel-pdf-service' });
});

app.post('/render', async (req, res) => {
  const { templateKey, data, fileName } = req.body || {};

  if (!templateKey) {
    return res.status(400).json({ ok: false, error: 'templateKey is required' });
  }

  const normalizedTemplate = String(templateKey).toLowerCase().replace(/[^a-z0-9_-]/g, '');
  const templatePath = path.resolve(process.cwd(), 'templates', `${normalizedTemplate}.xlsx`);

  if (!existsSync(templatePath)) {
    return res.status(404).json({ ok: false, error: `Template not found: ${normalizedTemplate}.xlsx` });
  }

  const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'excel-pdf-'));
  const outputXlsx = path.join(tmpRoot, `${normalizedTemplate}-${Date.now()}.xlsx`);

  try {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(templatePath);
    applyTemplateData(workbook, normalizedTemplate, data || {});
    await workbook.xlsx.writeFile(outputXlsx);

    await convertXlsxToPdf({
      sofficeBin,
      inputXlsxPath: outputXlsx,
      outputDir: tmpRoot
    });

    const outputPdf = outputXlsx.replace(/\.xlsx$/i, '.pdf');
    const pdfBuffer = await fs.readFile(outputPdf);
    const pdfBase64 = pdfBuffer.toString('base64');

    const safeBaseName = String(fileName || `${normalizedTemplate}-${Date.now()}`)
      .replace(/[^a-zA-Z0-9-_]/g, '_')
      .replace(/_+/g, '_');

    return res.json({
      ok: true,
      fileName: `${safeBaseName}.pdf`,
      pdfBase64
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error?.message || 'Unknown rendering error'
    });
  } finally {
    await fs.rm(tmpRoot, { recursive: true, force: true });
  }
});

app.listen(port, () => {
  console.log(`[excel-pdf-service] running on http://localhost:${port}`);
});
