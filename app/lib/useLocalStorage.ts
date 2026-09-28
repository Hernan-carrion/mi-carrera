"use client";

import { useEffect, useState } from "react";

/* =========================================================================
 * PERSISTENCIA LOCAL (localStorage)
 * La app no tiene backend: todo vive en el navegador del celular/PC donde
 * se abre. Cada valor se guarda bajo su propia clave para poder cargarlos
 * de forma independiente.
 * ========================================================================= */

export function useLocalStorage<T>(key: string, initialValue: T) {
  const [value, setValue] = useState<T>(initialValue);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw !== null) setValue(JSON.parse(raw) as T);
    } catch {
      // localStorage no disponible (modo privado, SSR, etc.) - se ignora
    }
    setHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // almacenamiento lleno o bloqueado - se ignora
    }
  }, [key, value, hydrated]);

  return [value, setValue, hydrated] as const;
}
