import { NFPA_B64, FIRE_B64 } from './logosBase64';

let cachedLogos = null;

const safe = (value, fallback = '') => {
  if (value === null || value === undefined) return fallback;
  const text = String(value).trim();
  return text ? text : fallback;
};

const resolveHeaderFields = (fields = {}) => ({
  fecha: safe(fields.fecha),
  ejecutivo: safe(fields.ejecutivo),
  emailEjecutivo: safe(fields.emailEjecutivo),
  cel: safe(fields.cel),
  telOficina: safe(fields.telOficina),
  tecnico: safe(fields.tecnico),
  sistema: safe(fields.sistema),
  cliente: safe(fields.cliente),
  contacto: safe(fields.contacto),
  departamentoSupervisor: safe(fields.departamentoSupervisor),
  telCliente: safe(fields.telCliente),
  emailCliente: safe(fields.emailCliente),
  predio: safe(fields.predio),
  direccion: safe(fields.direccion),
  cant_det: safe(fields.cant_det),
  cant_mod: safe(fields.cant_mod),
  cant_est: safe(fields.cant_est),
  cant_estr: safe(fields.cant_estr),
  cant_hidrantes: safe(fields.cant_hidrantes),
  horaInicio: safe(fields.horaInicio),
  horaFinal: safe(fields.horaFinal),
  responsableDepto: safe(fields.responsableDepto)
});

export const PDF_EXACT_HEADER_STYLES = `
  .fe-header-container { width: 100%; font-family: Arial, sans-serif; font-size: 9px; margin-bottom: 5px; }
  .fe-logos-table { width: 100%; margin-bottom: 8px; border-collapse: collapse; }
  .fe-logos-table td { text-align: center; vertical-align: middle; width: 33.33%; border: none !important; }
  .logo-left img { height: 55px; object-fit: contain; }
  .logo-center img { height: 60px; object-fit: contain; }
  .logo-right img { height: 50px; object-fit: contain; }

  .fe-main-box { border: 1.5px solid #0070c0; width: 100%; border-collapse: collapse; margin-bottom: 5px; }
  
  .fe-nav-row { background-color: #0070c0; color: #fff; font-weight: bold; text-align: center; font-size: 10px; }
  .fe-nav-row td { padding: 5px; border: 1px solid #0070c0 !important; }

  .fe-address-row td { text-align: center; color: #0000ff; padding: 4px; font-weight: normal; font-size: 9px; background-color: #fff; border: none !important; border-left: 1px solid #0070c0 !important; border-right: 1px solid #0070c0 !important; }
  .fe-title-row td { text-align: center; font-weight: bold; font-size: 16px; padding: 6px; background-color: #fff; border: none !important; border-bottom: 1.5px solid #0070c0 !important; border-left: 1px solid #0070c0 !important; border-right: 1px solid #0070c0 !important; }

  .fe-section-row td { background-color: #0070c0; color: #fff; font-weight: bold; text-align: center; padding: 4px; font-size: 10px; border: 1px solid #0070c0 !important; }

  .fe-data-table { width: 100%; border-collapse: collapse; background-color: #fff; border: 1px solid #0070c0; }
  .fe-data-table td { padding: 4px 6px; font-size: 9px; border: none !important; }
  
  .fe-lbl { font-weight: bold; text-align: left; width: 22%; color: #000; }
  .fe-val { text-align: left; width: 28%; color: #000; border-bottom: 0.5px solid #eee !important; font-size: 11px !important; font-family: Arial, sans-serif !important; }
  .fe-lbl-r { font-weight: bold; text-align: left; width: 22%; color: #000; }
  .fe-val-r { text-align: left; width: 28%; color: #000; border-bottom: 0.5px solid #eee !important; font-size: 11px !important; font-family: Arial, sans-serif !important; }

  .fe-separator-row td { border-top: 1.5px solid #0070c0 !important; padding: 0; height: 1px; }
  .fe-specialist-row td { font-weight: bold; text-align: center; padding: 8px; font-size: 11px !important; font-family: Arial, sans-serif !important; border: none !important; border-top: 1px solid #0070c0 !important; }
  
  .fe-red { color: #d9282a; }
  .fe-blue { color: #0070c0; }
`;

export const PDF_PRINT_SAFE_STYLES = `
  @page {
    size: A4 portrait;
    margin: 12mm 10mm 14mm 10mm;
  }

  html, body {
    width: 100%;
  }

  body {
    margin: 0;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
    counter-reset: page;
  }

  .page-number-header {
    display: table-header-group;
  }
  .page-number-cell {
    text-align: right;
    font-weight: bold;
    font-size: 12px;
    padding-bottom: 5px;
    border: none !important;
  }
  .page-number-cell::after {
    counter-increment: page;
    content: counter(page);
  }
`;

async function getHeaderLogosDataUrl() {
  if (cachedLogos) return cachedLogos;
  cachedLogos = { nfpa: NFPA_B64, fire: FIRE_B64 };
  return cachedLogos;
}

export async function buildExactPdfHeader(options = {}) {
  const logos = await getHeaderLogosDataUrl();
  const fields = resolveHeaderFields(options.fields || {});

  const logoClienteHtml = options.logoCliente
    ? `<img src="${options.logoCliente}" alt="Logo Cliente" />`
    : '';

  const nfpaHtml = logos.nfpa
    ? `<img src="${logos.nfpa}" alt="NFPA" />`
    : '<div style="width:50px;height:50px;background:#eee;display:inline-block;border-radius:25px;line-height:50px;font-size:10px;">NFPA</div>';

  const fireHtml = logos.fire
    ? `<img src="${logos.fire}" alt="Fire Engineers" />`
    : `
      <div style="text-align:center;">
        <div style="font-size:22px;font-weight:900;color:#0070c0;font-family:Arial;">FireEngineers</div>
        <div style="font-size:9px;color:#0070c0;font-style:italic;margin-top:-2px;">Systems for saving lives</div>
      </div>
    `;

  return `
    <div class="fe-header-container">
      <table class="fe-logos-table">
        <tr>
          <td class="logo-left">${nfpaHtml}</td>
          <td class="logo-center">${fireHtml}</td>
          <td class="logo-right">${logoClienteHtml}</td>
        </tr>
      </table>

      <table class="fe-main-box">
        <tr class="fe-nav-row">
          <td>CONSULTORÍA</td>
          <td>DISEÑO</td>
          <td>INSTALACIÓN</td>
          <td>MANTENIMIENTO</td>
        </tr>
        <tr class="fe-address-row">
          <td colspan="4">${options.sucursal === 'Centro' ? 'Fire Engineers S.A de C.V, Calle hidalgo #620 col centro cp 27000' : 'Fire Engineers S.A de C.V, Hidalgo # 8-A, Toluquilla, San Pedro Tlaquepaque, Jalisco, México, C.P 45610'}</td>
        </tr>
        <tr class="fe-title-row">
          <td colspan="4">${safe(options.title, 'REPORTE DE MANTENIMIENTO SISTEMA DE ALARMA DE INCENDIOS')}</td>
        </tr>
        <tr class="fe-section-row">
          <td colspan="2" style="border-right: 1px solid #fff;">DATOS DEL CLIENTE</td>
          <td colspan="2">DATOS DEL CONTRATISTA</td>
        </tr>
        <tr>
          <td colspan="4" style="padding: 0;">
            <table class="fe-data-table">
              <colgroup>
                <col style="width: 22%;">
                <col style="width: 28%;">
                <col style="width: 22%;">
                <col style="width: 28%;">
              </colgroup>
              <tr>
                <td class="fe-lbl">Nombre del Cliente</td>
                <td class="fe-val">${fields.cliente}</td>
                <td class="fe-lbl-r">Nombre de la empresa</td>
                <td class="fe-val-r">Fire Engineers S.A de C.V</td>
              </tr>
              <tr>
                <td class="fe-lbl">Contacto</td>
                <td class="fe-val">${fields.contacto}</td>
                <td class="fe-lbl-r">Representante de la empresa</td>
                <td class="fe-val-r">${fields.ejecutivo}</td>
              </tr>
              <tr>
                <td class="fe-lbl">Teléfono</td>
                <td class="fe-val">${fields.telCliente}</td>
                <td class="fe-lbl-r">Teléfono</td>
                <td class="fe-val-r">${fields.cel || fields.telOficina}</td>
              </tr>
              <tr>
                <td class="fe-lbl">Correo electrónico</td>
                <td class="fe-val">${fields.emailCliente}</td>
                <td class="fe-lbl-r">Correo electrónico</td>
                <td class="fe-val-r">${fields.emailEjecutivo}</td>
              </tr>
              <tr>
                <td class="fe-lbl">Dirección</td>
                <td class="fe-val">${fields.direccion}</td>
                <td class="fe-lbl-r"></td>
                <td class="fe-val-r"></td>
              </tr>

              <tr class="fe-separator-row"><td colspan="4"></td></tr>
              
              <tr>
                <td class="fe-lbl">Fecha</td>
                <td class="fe-val">${fields.fecha}</td>
                <td colspan="2" style="text-align: center; font-weight: bold; font-size: 9px; padding-top: 5px;">Antes de cualquier prueba se le dio aviso a:</td>
              </tr>
              <tr>
                <td class="fe-lbl">Predio del Cliente</td>
                <td class="fe-val">${fields.predio}</td>
                <td class="fe-lbl-r">Departamento</td>
                <td class="fe-val-r">${fields.departamentoSupervisor}</td>
              </tr>
              <tr>
                <td class="fe-lbl">hora de inicio</td>
                <td class="fe-val">${fields.horaInicio || ''}</td>
                <td class="fe-lbl-r">Nombre del Responsable del departamento</td>
                <td class="fe-val-r">${fields.responsableDepto || ''}</td>
              </tr>
              <tr>
                <td class="fe-lbl">hora final</td>
                <td class="fe-val">${fields.horaFinal || ''}</td>
                <td colspan="2"></td>
              </tr>
              ${fields.cant_det ? `
              <tr>
                <td class="fe-lbl">cantidad de Detectores</td>
                <td class="fe-val">${fields.cant_det}</td>
                <td colspan="2"></td>
              </tr>
              ` : ''}
              ${fields.cant_mod ? `
              <tr>
                <td class="fe-lbl">cantidad de Módulos</td>
                <td class="fe-val">${fields.cant_mod}</td>
                <td colspan="2"></td>
              </tr>
              ` : ''}
              ${fields.cant_est ? `
              <tr>
                <td class="fe-lbl">cantidad de Estaciones Manuales</td>
                <td class="fe-val">${fields.cant_est}</td>
                <td colspan="2"></td>
              </tr>
              ` : ''}
              ${fields.cant_estr ? `
              <tr>
                <td class="fe-lbl">cantidad de Estroboscópicas</td>
                <td class="fe-val">${fields.cant_estr}</td>
                <td colspan="2"></td>
              </tr>
              ` : ''}
              ${fields.cant_hidrantes ? `
              <tr>
                <td class="fe-lbl">cantidad de Hidrantes</td>
                <td class="fe-val">${fields.cant_hidrantes}</td>
                <td colspan="2"></td>
              </tr>
              ` : ''}
            </table>
          </td>
        </tr>
        <tr class="fe-specialist-row">
          <td colspan="4">
            Nombre del Especialista 
            <span class="fe-red">Fire</span> 
            <span class="fe-blue">Engineers</span>:
            <span style="font-weight: normal; 
            margin-left: 5px; 
            border-bottom: 1px solid #ccc; 
            display: inline-block; 
            min-width: 150px; 
            text-align: left;">
            ${fields.tecnico}</span>
          </td>
        </tr>
      </table>
    </div>
  `;
}
