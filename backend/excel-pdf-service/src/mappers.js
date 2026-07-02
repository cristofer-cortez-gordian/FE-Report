function safe(value) {
  return value === undefined || value === null ? '' : String(value);
}

function setCells(worksheet, map) {
  for (const [cell, value] of Object.entries(map)) {
    worksheet.getCell(cell).value = safe(value);
  }
}

function fillAlarma(workbook, data) {
  const ws = workbook.getWorksheet('ALARMAS') || workbook.worksheets[0];

  setCells(ws, {
    B2: data.h_fecha,
    B3: data.h_cliente,
    B4: data.h_contacto,
    B5: data.h_tel,
    B6: data.h_email,
    D2: data.h_tecnico,
    D3: data.h_predio,
    D4: data.h_direccion,
    D5: data.g_manto_lazo,
    D6: data.p_obs,
    B8: data.g_cant_det,
    C8: data.g_cant_mod,
    D8: data.g_cant_est
  });

  const detectores = Array.isArray(data.detectores) ? data.detectores : [];
  const modulos = Array.isArray(data.modulos) ? data.modulos : [];
  const estaciones = Array.isArray(data.estaciones) ? data.estaciones : [];

  let row = 12;
  for (const item of detectores) {
    ws.getCell(`A${row}`).value = safe(item?.id || row - 11);
    ws.getCell(`B${row}`).value = safe(item?.ubicacion || item?.descripcion);
    ws.getCell(`C${row}`).value = safe(item?.estado || item?.observacion);
    row += 1;
  }

  row = 12;
  for (const item of modulos) {
    ws.getCell(`E${row}`).value = safe(item?.id || row - 11);
    ws.getCell(`F${row}`).value = safe(item?.ubicacion || item?.descripcion);
    ws.getCell(`G${row}`).value = safe(item?.estado || item?.observacion);
    row += 1;
  }

  row = 12;
  for (const item of estaciones) {
    ws.getCell(`I${row}`).value = safe(item?.id || row - 11);
    ws.getCell(`J${row}`).value = safe(item?.ubicacion || item?.descripcion);
    ws.getCell(`K${row}`).value = safe(item?.estado || item?.observacion);
    row += 1;
  }
}

function fillHidrantes(workbook, data) {
  const ws = workbook.getWorksheet('HIDRANTES') || workbook.worksheets[0];

  setCells(ws, {
    B2: data.fecha,
    B3: data.cliente_nombre,
    B4: data.predio,
    B5: data.cliente_contacto,
    B6: data.cliente_telefono,
    D3: data.empresa_nombre,
    D4: data.empresa_representante,
    D5: data.empresa_telefono,
    D6: data.observaciones_finales
  });

  const hidrantes = Array.isArray(data.hidrantes) ? data.hidrantes : [];
  let row = 10;
  for (const h of hidrantes) {
    ws.getCell(`A${row}`).value = safe(h?.numero);
    ws.getCell(`B${row}`).value = safe(h?.presion);
    ws.getCell(`C${row}`).value = safe(h?.ubicacion);
    ws.getCell(`D${row}`).value = safe(h?.manguera);
    ws.getCell(`E${row}`).value = safe(h?.obstruido);
    ws.getCell(`F${row}`).value = safe(h?.sin_dano);
    ws.getCell(`G${row}`).value = safe(h?.valvula);
    ws.getCell(`H${row}`).value = safe(h?.accesorios);
    ws.getCell(`I${row}`).value = safe(h?.identificado);
    ws.getCell(`J${row}`).value = safe(h?.espuma_dosificador);
    ws.getCell(`K${row}`).value = safe(h?.cristal);
    ws.getCell(`L${row}`).value = safe(h?.obs_id);
    row += 1;
  }
}

function fillBombas(workbook, data) {
  const ws = workbook.getWorksheet('BOMBAS') || workbook.worksheets[0];

  setCells(ws, {
    B2: data.h_fecha,
    B3: data.h_cliente,
    B4: data.h_contacto,
    B5: data.h_tel,
    B6: data.h_email,
    D2: data.h_tecnico,
    D3: data.h_predio,
    D4: data.h_direccion,
    D5: data.g_depto,
    D6: data.g_resp
  });

  const tableIg = Array.isArray(data.table_ig) ? data.table_ig : [];
  const tableMd = Array.isArray(data.table_md) ? data.table_md : [];
  const tableMj = Array.isArray(data.table_mj) ? data.table_mj : [];

  let row = 10;
  for (const item of tableIg) {
    ws.getCell(`A${row}`).value = safe(item?.item || item?.name || row - 9);
    ws.getCell(`B${row}`).value = safe(item?.estado || item?.status);
    ws.getCell(`C${row}`).value = safe(item?.observaciones || item?.obs);
    row += 1;
  }

  row = 10;
  for (const item of tableMd) {
    ws.getCell(`E${row}`).value = safe(item?.item || item?.name || row - 9);
    ws.getCell(`F${row}`).value = safe(item?.estado || item?.status);
    ws.getCell(`G${row}`).value = safe(item?.observaciones || item?.obs);
    row += 1;
  }

  row = 10;
  for (const item of tableMj) {
    ws.getCell(`I${row}`).value = safe(item?.item || item?.name || row - 9);
    ws.getCell(`J${row}`).value = safe(item?.estado || item?.status);
    ws.getCell(`K${row}`).value = safe(item?.observaciones || item?.obs);
    row += 1;
  }
}

export function applyTemplateData(workbook, templateKey, data) {
  const key = String(templateKey || '').toLowerCase();
  if (key === 'alarma') return fillAlarma(workbook, data);
  if (key === 'hidrantes') return fillHidrantes(workbook, data);
  if (key === 'bombas') return fillBombas(workbook, data);
  throw new Error(`Unsupported template key: ${templateKey}`);
}
