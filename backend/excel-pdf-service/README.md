# Excel -> PDF Service (FireReport)

This service receives report JSON, fills an Excel template, converts it to PDF with LibreOffice, and returns the PDF as base64.

## 1) Requirements

- Node.js 18+
- LibreOffice installed
- `soffice` available in PATH (or set `SOFFICE_BIN`)

## 2) Folder structure

- `templates/alarma.xlsx`
- `templates/hidrantes.xlsx`
- `templates/bombas.xlsx`

## 3) Run locally

```bash
cd backend/excel-pdf-service
cp .env.example .env
npm install
npm run dev
```

Default URL: `http://localhost:5050`

## 4) API

### `GET /health`

Returns health payload.

### `POST /render`

Body:

```json
{
  "templateKey": "alarma",
  "fileName": "reporte-123",
  "data": {
    "h_cliente": "Cliente Demo",
    "h_contacto": "Juan"
  }
}
```

Response:

```json
{
  "ok": true,
  "fileName": "reporte-123.pdf",
  "pdfBase64": "JVBERi0xLjQK..."
}
```

## 5) Mapping source

Cell mapping is in `src/mappers.js`.

If your Excel template changes, update those mapped cells.

## 6) Production notes

- Put this service behind HTTPS.
- Add API auth (token/JWT).
- Add request size limits and rate limiting.
- Keep template keys whitelisted (already enforced in practice via filename).
