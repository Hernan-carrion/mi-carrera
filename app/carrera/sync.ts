"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useLocalStorage } from "../lib/useLocalStorage";

/* =========================================================================
 * SINCRONIZACION CON GOOGLE SHEETS (via Apps Script, ver apps-script/Code.gs)
 * localStorage sigue siendo la copia de trabajo: la pagina anda sin
 * conexion y sube los cambios cuando puede. Gana la version con el
 * `updatedAt` mas reciente.
 * La URL y la clave se guardan solo en este navegador (el repo es publico).
 * ========================================================================= */

export interface SyncConfig {
  url: string;
  token: string;
}

export type SyncStatus = "off" | "conectando" | "ok" | "guardando" | "pendiente" | "error";

export interface SheetPayload {
  filas: (string | number)[][];
  resumen: (string | number)[][];
}

async function call(cfg: SyncConfig, body: Record<string, unknown>) {
  // text/plain evita el preflight CORS, que Apps Script no soporta
  const res = await fetch(cfg.url, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ token: cfg.token, ...body }),
  });
  const json = await res.json();
  if (!json.ok) throw new Error(json.error || "error");
  return json;
}

export function errorLegible(err: unknown) {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg === "unauthorized") return "Clave incorrecta (o no cambiaste TOKEN en el script).";
  if (msg === "bad_request" || msg === "unknown_action") return "El script respondió algo inesperado. ¿Pegaste la última versión de Code.gs?";
  return "No se pudo conectar. Revisá la URL, que la implementación tenga acceso para “Cualquier usuario”, y tu conexión.";
}

/** Prueba una URL/clave antes de guardarla. */
export async function probarConexion(cfg: SyncConfig) {
  await call(cfg, { action: "get" });
}

export function useSheetSync<T extends { updatedAt?: number }>(
  data: T,
  replace: (d: T) => void,
  hydrated: boolean,
  payload: () => SheetPayload
) {
  const [cfg, setCfg, cfgHydrated] = useLocalStorage<SyncConfig | null>("carrera.sync", null);
  const [status, setStatus] = useState<SyncStatus>("off");
  const [error, setError] = useState<string | null>(null);
  const [lastSync, setLastSync] = useState<Date | null>(null);

  const dataRef = useRef(data);
  dataRef.current = data;
  const payloadRef = useRef(payload);
  payloadRef.current = payload;
  const ready = useRef(false); // no subir nada antes de leer la hoja
  const synced = useRef(""); // JSON que coincide con lo guardado en la hoja
  const inFlight = useRef(false);
  const again = useRef(false);

  const fail = (err: unknown) => {
    setStatus(typeof navigator !== "undefined" && !navigator.onLine ? "pendiente" : "error");
    setError(errorLegible(err));
  };
  const done = () => {
    setStatus("ok");
    setError(null);
    setLastSync(new Date());
  };

  const push = useCallback(async () => {
    if (!cfg || !ready.current) return;
    if (inFlight.current) {
      again.current = true;
      return;
    }
    const snapshot = dataRef.current;
    const json = JSON.stringify(snapshot);
    if (json === synced.current) return;
    inFlight.current = true;
    setStatus("guardando");
    try {
      await call(cfg, { action: "save", data: snapshot, ...payloadRef.current() });
      synced.current = json;
      done();
    } catch (err) {
      fail(err);
    } finally {
      inFlight.current = false;
      if (again.current) {
        again.current = false;
        push();
      }
    }
  }, [cfg]);

  /** Lee la hoja y se queda con la version mas nueva (local o remota). */
  const sincronizar = useCallback(async () => {
    if (!cfg) return;
    if (ready.current && JSON.stringify(dataRef.current) !== synced.current) {
      // hay cambios locales sin subir: primero subirlos
      return push();
    }
    if (!ready.current) setStatus("conectando");
    try {
      const { data: remote } = (await call(cfg, { action: "get" })) as { data: T | null };
      ready.current = true;
      const local = dataRef.current;
      if (remote && (remote.updatedAt ?? 0) > (local.updatedAt ?? 0)) {
        synced.current = JSON.stringify(remote);
        replace(remote);
        done();
      } else if (!remote || (local.updatedAt ?? 0) > (remote.updatedAt ?? 0)) {
        await push();
      } else {
        synced.current = JSON.stringify(local);
        done();
      }
    } catch (err) {
      fail(err);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cfg, push]);

  // Al abrir la pagina (o cambiar la configuracion): leer la hoja
  useEffect(() => {
    if (!hydrated || !cfgHydrated) return;
    ready.current = false;
    synced.current = "";
    if (!cfg) {
      setStatus("off");
      setError(null);
      return;
    }
    sincronizar();
  }, [cfg, hydrated, cfgHydrated, sincronizar]);

  // Cada cambio local se sube a los 1.5 s
  useEffect(() => {
    if (!cfg || !ready.current) return;
    const t = setTimeout(push, 1500);
    return () => clearTimeout(t);
  }, [data, cfg, push]);

  // Reintentar al recuperar conexion y traer cambios de otro dispositivo al volver a la pestana
  useEffect(() => {
    if (!cfg) return;
    const onVisible = () => document.visibilityState === "visible" && sincronizar();
    window.addEventListener("online", sincronizar);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("online", sincronizar);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [cfg, sincronizar]);

  return { cfg, setCfg, status, error, lastSync, sincronizar };
}
