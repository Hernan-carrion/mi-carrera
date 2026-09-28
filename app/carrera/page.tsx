"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/* La app antes vivia en /carrera; se mantiene esta ruta para que los
 * links y accesos directos viejos sigan funcionando. */
export default function CarreraRedirect() {
  const router = useRouter();
  useEffect(() => router.replace("/"), [router]);
  return null;
}
