/**
 * Backend en Google Sheets para "Mi Carrera" (personal-tracker-dashboard).
 *
 * Instalacion (ver README, seccion "Sincronizar con Google Sheets"):
 *   1. Crear un Google Sheet nuevo -> Extensiones -> Apps Script.
 *   2. Pegar este archivo completo y cambiar TOKEN por una clave propia.
 *   3. Implementar -> Nueva implementacion -> Aplicacion web
 *        Ejecutar como: Yo   ·   Quien tiene acceso: Cualquier usuario
 *   4. Copiar la URL (termina en /exec) y pegarla en la pagina junto con
 *      la misma clave.
 *
 * Hojas que genera:
 *   - Materias: una fila por materia (legible, para mirar o graficar).
 *   - Resumen:  porcentajes y promedios.
 *   - _raw:     estado completo en JSON (oculta; es la que lee la pagina).
 */

const TOKEN = "CAMBIAR-POR-TU-CLAVE";

function doPost(e) {
  let body;
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    return json({ ok: false, error: "bad_request" });
  }
  if (!body || TOKEN === "CAMBIAR-POR-TU-CLAVE" || body.token !== TOKEN) {
    return json({ ok: false, error: "unauthorized" });
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();

  if (body.action === "get") {
    const raw = hoja(ss, "_raw").getRange("A1").getValue();
    return json({ ok: true, data: raw ? JSON.parse(raw) : null });
  }

  if (body.action === "save") {
    const lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try {
      hoja(ss, "_raw").getRange("A1").setValue(JSON.stringify(body.data));
      escribirTabla(hoja(ss, "Materias"), body.filas);
      escribirTabla(hoja(ss, "Resumen"), body.resumen);
    } finally {
      lock.releaseLock();
    }
    return json({ ok: true });
  }

  return json({ ok: false, error: "unknown_action" });
}

function hoja(ss, nombre) {
  let sh = ss.getSheetByName(nombre);
  if (!sh) {
    sh = ss.insertSheet(nombre);
    if (nombre === "_raw") {
      try {
        sh.hideSheet();
      } catch (err) {
        // no se puede ocultar si es la unica hoja visible - se ignora
      }
    }
  }
  return sh;
}

function escribirTabla(sh, filas) {
  sh.clearContents();
  if (!filas || !filas.length) return;
  const cols = filas[0].length;
  sh.getRange(1, 1, filas.length, cols).setValues(filas);
  sh.setFrozenRows(1);
  sh.getRange(1, 1, 1, cols).setFontWeight("bold");
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON
  );
}
