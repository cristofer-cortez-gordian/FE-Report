# Flujo exacto: Plantillas Excel -> Datos -> PDF

Este documento deja el flujo completo para tu proyecto `FireReport`.

## 1. Estructura de carpetas de plantillas

Usa esta carpeta en backend:

- `backend/excel-pdf-service/templates/alarma.xlsx`
- `backend/excel-pdf-service/templates/hidrantes.xlsx`
- `backend/excel-pdf-service/templates/bombas.xlsx`

Cada plantilla debe mantener celdas estables para no romper el mapeo.

## 2. Mapeo de campos (actual)

Referencia: `backend/excel-pdf-service/src/mappers.js`

### Alarma (`templateKey: alarma`)

- Encabezado: `h_fecha`, `h_cliente`, `h_contacto`, `h_tel`, `h_email`, `h_tecnico`, `h_predio`, `h_direccion`, `g_manto_lazo`, `p_obs`, `g_cant_det`, `g_cant_mod`, `g_cant_est`
- Tablas:
- `detectores[]` en columnas `A:C`, desde fila `12`
- `modulos[]` en columnas `E:G`, desde fila `12`
- `estaciones[]` en columnas `I:K`, desde fila `12`

### Hidrantes (`templateKey: hidrantes`)

- Encabezado: `fecha`, `cliente_nombre`, `predio`, `cliente_contacto`, `cliente_telefono`, `empresa_nombre`, `empresa_representante`, `empresa_telefono`, `observaciones_finales`
- Tabla `hidrantes[]` desde fila `10` con columnas `A:L`:
- `numero`, `presion`, `ubicacion`, `manguera`, `obstruido`, `sin_dano`, `valvula`, `accesorios`, `identificado`, `espuma_dosificador`, `cristal`, `obs_id`

### Bombas (`templateKey: bombas`)

- Encabezado: `h_fecha`, `h_cliente`, `h_contacto`, `h_tel`, `h_email`, `h_tecnico`, `h_predio`, `h_direccion`, `g_depto`, `g_resp`
- Tablas:
- `table_ig[]` en `A:C`, desde fila `10`
- `table_md[]` en `E:G`, desde fila `10`
- `table_mj[]` en `I:K`, desde fila `10`

## 3. Endpoint backend para convertir a PDF

Ya creado en:

- `backend/excel-pdf-service/src/index.js`
- `POST /render`

Entrada:

```json
{
  "templateKey": "alarma|hidrantes|bombas",
  "fileName": "reporte-<id>",
  "data": { "...": "..." }
}
```

Salida:

```json
{
  "ok": true,
  "fileName": "reporte-123.pdf",
  "pdfBase64": "..."
}
```

## 4. Integracion en Expo (descargar/compartir)

Ya creado helper cliente:

- `utils/excelPdfService.js`

Ya agregado env en Expo config:

- `app.config.js` -> `extra.EXCEL_PDF_API_URL`

### Configurar URL del backend

En `.env` del proyecto principal:

```env
EXCEL_PDF_API_URL=http://TU_IP_LOCAL:5050
```

Luego reconstruye para que Expo tome el `extra`.

### Uso en `reporte_alarma.js`

```javascript
import { generateAndSharePdfFromExcel } from '../utils/excelPdfService';

// Dentro de tu flujo (ya tienes reporteAGuardar)
await generateAndSharePdfFromExcel({
  reportData: reporteAGuardar,
  templateKey: 'alarma',
  fileName: `alarma-${reporteAGuardar.id}`
});
```

### Uso en `reportehidrantes.js`

```javascript
import { generateAndSharePdfFromExcel } from '../utils/excelPdfService';

await generateAndSharePdfFromExcel({
  reportData: reporte,
  templateKey: 'hidrantes',
  fileName: `hidrantes-${reporte.id}`
});
```

### Uso en `ReportesBombas.js`

```javascript
import { generateAndSharePdfFromExcel } from '../utils/excelPdfService';

await generateAndSharePdfFromExcel({
  reportData: reporteAGuardar,
  templateKey: 'bombas',
  fileName: `bombas-${reporteAGuardar.id}`
});
```

## 5. Secuencia recomendada de adopcion

1. Arranca backend y confirma `GET /health`.
2. Crea una plantilla (`alarma.xlsx`) y prueba un solo reporte.
3. Ajusta celdas en `mappers.js` hasta que PDF salga identico.
4. Repite con `hidrantes.xlsx` y `bombas.xlsx`.
5. Cuando quede estable, decide si reemplazas por completo el PDF HTML actual o dejas ambos modos.

## 6. Nota importante de calidad visual

La conversion Excel->PDF depende de LibreOffice y fuentes instaladas en el servidor.

Para que el PDF se vea igual siempre:

- Instala las mismas fuentes en servidor.
- Evita formulas complejas/macros para layout.
- Congela tamanos de columnas/filas en plantilla.
