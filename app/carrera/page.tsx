"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { useLocalStorage } from "../lib/useLocalStorage";
import { MATERIAS_BY_ID, Materia, NOTA_APROBACION, PLAN, TUP_IDS } from "./plan";
import { SyncConfig, SyncStatus, errorLegible, probarConexion, useSheetSync } from "./sync";

/* =========================================================================
 * ESTADO GUARDADO POR MATERIA
 * Solo se guarda lo que carga el usuario (cursando / regular / libre /
 * aprobada + notas). "Bloqueada" y "Disponible" se calculan siempre a
 * partir de las correlatividades, nunca se guardan.
 * ========================================================================= */

type Estado = "pendiente" | "cursando" | "regular" | "libre" | "aprobada";
type Via = "final" | "promocion" | "libre";

interface Intento {
  fecha: string;
  nota: number;
  tipo: "regular" | "libre";
}

interface MateriaState {
  estado: Estado;
  via?: Via;
  notaCursada?: number;
  notaFinal?: number;
  fechaRegular?: string;
  fechaAprobada?: string;
  intentos: Intento[];
  nombre?: string; // nombre elegido para las electivas
}

interface CarreraData {
  materias: Record<number, MateriaState>;
  practica: boolean;
  updatedAt?: number; // para resolver que version gana al sincronizar
}

const EMPTY: CarreraData = { materias: {}, practica: false };
const DEFAULT_STATE: MateriaState = { estado: "pendiente", intentos: [] };

const hoy = () => new Date().toISOString().slice(0, 10);

/* =========================================================================
 * MOTOR DE CORRELATIVIDADES
 * ========================================================================= */

type Vista =
  | "aprobada"
  | "retenida" // aprobada/promocionada pero con correlativas para rendir sin aprobar
  | "regular"
  | "cursando"
  | "libre"
  | "disponible"
  | "bloqueada";

interface Info {
  vista: Vista;
  aprobada: boolean; // aprobacion efectiva (cuenta para % y correlativas)
  regularizada: boolean; // sirve como correlativa "debil"
  puedeCursar: boolean;
  puedeRendir: boolean;
  faltaCursar: string[]; // motivos por los que no se puede cursar
  faltaRendir: number[]; // materias a aprobar antes de rendir
  inconsistente: boolean; // se cargo avance sin cumplir correlativas
}

function calcular(data: CarreraData): Record<number, Info> {
  const out: Record<number, Info> = {};
  const st = (id: number) => data.materias[id] ?? DEFAULT_STATE;
  // Las correlativas siempre tienen codigo menor, asi que recorrer en orden
  // garantiza que ya estan calculadas.
  for (const mat of PLAN) {
    const s = st(mat.id);
    const apr = (id: number) => out[id]?.aprobada ?? false;
    const reg = (id: number) => out[id]?.regularizada ?? false;

    const faltaCursar: string[] = [];
    for (const c of mat.cursada) if (!reg(c)) faltaCursar.push(`Regularizar ${c} · ${nombre(data, c)}`);
    for (const r of mat.rendida) if (!apr(r)) faltaCursar.push(`Aprobar ${r} · ${nombre(data, r)}`);
    if (mat.requierePractica && !data.practica) faltaCursar.push("Cumplir la Práctica Socio-Educativa");
    const faltaRendir = mat.rendir.filter((r) => !apr(r));

    const puedeCursar = faltaCursar.length === 0;
    const puedeRendir = faltaRendir.length === 0;
    const aprobada = s.estado === "aprobada" && puedeRendir;
    const regularizada = s.estado === "regular" || s.estado === "aprobada";

    let vista: Vista;
    if (s.estado === "aprobada") vista = aprobada ? "aprobada" : "retenida";
    else if (s.estado === "pendiente") vista = puedeCursar ? "disponible" : "bloqueada";
    else vista = s.estado;

    const inconsistente =
      s.estado !== "pendiente" && !(s.estado === "aprobada" && s.via === "libre") && !puedeCursar;

    out[mat.id] = { vista, aprobada, regularizada, puedeCursar, puedeRendir, faltaCursar, faltaRendir, inconsistente };
  }
  return out;
}

function nombre(data: CarreraData, id: number) {
  const mat = MATERIAS_BY_ID[id];
  const custom = data.materias[id]?.nombre?.trim();
  return mat.electiva && custom ? `${mat.nombre}: ${custom}` : mat.nombre;
}

/* Materias que se desbloquean (directamente) gracias a esta. */
const HABILITA: Record<number, number[]> = Object.fromEntries(
  PLAN.map((mat) => [
    mat.id,
    PLAN.filter((o) => o.id !== 39 && (o.cursada.includes(mat.id) || o.rendida.includes(mat.id))).map((o) => o.id),
  ])
);

/* =========================================================================
 * ESTILOS
 * ========================================================================= */

const VISTA_META: Record<Vista, { label: string; pill: string }> = {
  aprobada: { label: "Aprobada", pill: "bg-emerald-600 text-white" },
  retenida: { label: "Aprobada · retenida", pill: "bg-emerald-100 text-emerald-800 ring-1 ring-emerald-300" },
  regular: { label: "Regular", pill: "bg-sky-600 text-white" },
  cursando: { label: "Cursando", pill: "bg-amber-400 text-amber-950" },
  libre: { label: "Libre", pill: "bg-rose-600 text-white" },
  disponible: { label: "Disponible", pill: "bg-white text-neutral-800 ring-1 ring-neutral-400" },
  bloqueada: { label: "Bloqueada", pill: "bg-neutral-200 text-neutral-500" },
};

const ANIOS = [1, 2, 3, 4, 5];
const ORDINAL = ["", "1er", "2do", "3er", "4to", "5to"];

type Filtro = "todas" | "tup" | "accion";

/* =========================================================================
 * PAGINA
 * ========================================================================= */

export default function CarreraPage() {
  const [data, setRaw, hydrated] = useLocalStorage<CarreraData>("carrera.v1", EMPTY);
  const setData = (fn: (d: CarreraData) => CarreraData) => setRaw((d) => ({ ...fn(d), updatedAt: Date.now() }));
  const [syncOpen, setSyncOpen] = useState(false);
  const [filtro, setFiltro] = useLocalStorage<Filtro>("carrera.filtro", "todas");
  const [abierta, setAbierta] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const info = useMemo(() => calcular(data), [data]);
  const st = (id: number) => data.materias[id] ?? DEFAULT_STATE;

  const update = (id: number, patch: Partial<MateriaState>) =>
    setData((d) => ({
      ...d,
      materias: { ...d.materias, [id]: { ...(d.materias[id] ?? DEFAULT_STATE), ...patch } },
    }));

  // ---- Estadisticas ----
  const stats = useMemo(() => {
    const aprobadas = PLAN.filter((mat) => info[mat.id].aprobada);
    const tupAprob = TUP_IDS.filter((id) => info[id].aprobada).length;
    const tupTotal = TUP_IDS.length + 1; // + Practica Socio-Educativa
    const tupPct = ((tupAprob + (data.practica ? 1 : 0)) / tupTotal) * 100;
    const licPct = (aprobadas.length / PLAN.length) * 100;

    const notas = aprobadas.map((mat) => st(mat.id).notaFinal).filter((n): n is number => typeof n === "number");
    const aplazos = PLAN.flatMap((mat) => st(mat.id).intentos.filter((i) => i.nota < NOTA_APROBACION).map((i) => i.nota));
    const prom = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

    const tupNotas = TUP_IDS.filter((id) => info[id].aprobada)
      .map((id) => st(id).notaFinal)
      .filter((n): n is number => typeof n === "number");

    const count = (v: Vista) => PLAN.filter((mat) => info[mat.id].vista === v).length;
    return {
      aprobadas: aprobadas.length,
      tupAprob,
      tupTotal,
      tupPct,
      licPct,
      promedio: prom(notas),
      promedioAplazos: prom([...notas, ...aplazos]),
      promedioTup: prom(tupNotas),
      regulares: count("regular"),
      cursando: count("cursando"),
      disponibles: count("disponible"),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [info, data]);

  // Proximos pasos: primero TUP, despues el resto
  const proximas = useMemo(() => {
    const puedeRendirYa = PLAN.filter(
      (mat) => (info[mat.id].vista === "regular" || info[mat.id].vista === "libre") && info[mat.id].puedeRendir
    );
    const paraCursar = PLAN.filter((mat) => info[mat.id].vista === "disponible");
    const orden = (a: Materia, b: Materia) => Number(b.tup) - Number(a.tup) || a.id - b.id;
    return { finales: puedeRendirYa.sort(orden), cursar: paraCursar.sort(orden) };
  }, [info]);

  // ---- Google Sheets ----
  const sync = useSheetSync(data, setRaw, hydrated, () => ({
    filas: [
      ["Código", "Materia", "Año", "TUP", "Estado", "Vía", "Nota cursada", "Fecha regular", "Nota final", "Fecha aprobada", "Finales rendidos"],
      ...PLAN.map((mat) => {
        const s = st(mat.id);
        const v = info[mat.id].vista;
        return [
          mat.id,
          nombre(data, mat.id),
          mat.anio,
          mat.tup ? "Sí" : "",
          v === "aprobada" && s.via === "promocion" ? "Promocionada" : VISTA_META[v].label,
          s.estado === "aprobada" ? s.via ?? "" : "",
          s.notaCursada ?? "",
          s.fechaRegular ?? "",
          s.estado === "aprobada" ? s.notaFinal ?? "" : "",
          s.estado === "aprobada" ? s.fechaAprobada ?? "" : "",
          s.intentos.map((x) => `${x.fecha}: ${x.nota}${x.tipo === "libre" ? " (libre)" : ""}`).join("; "),
        ];
      }),
    ],
    resumen: [
      ["Indicador", "Valor"],
      ["TUP %", Math.round(stats.tupPct)],
      ["TUP materias aprobadas", `${stats.tupAprob}/${TUP_IDS.length}`],
      ["Práctica Socio-Educativa", data.practica ? "Cumplida" : "Pendiente"],
      ["Licenciatura %", Math.round(stats.licPct)],
      ["Licenciatura materias aprobadas", `${stats.aprobadas}/${PLAN.length}`],
      ["Promedio (sin aplazos)", stats.promedio !== null ? Number(stats.promedio.toFixed(2)) : ""],
      ["Promedio (con aplazos)", stats.promedioAplazos !== null ? Number(stats.promedioAplazos.toFixed(2)) : ""],
      ["Regulares", stats.regulares],
      ["Cursando", stats.cursando],
      ["Actualizado", new Date(data.updatedAt ?? Date.now()).toLocaleString("es-AR")],
    ],
  }));

  const visible = (mat: Materia) => {
    if (filtro === "tup") return mat.tup;
    if (filtro === "accion") return !["aprobada", "bloqueada"].includes(info[mat.id].vista);
    return true;
  };

  // ---- Backup ----
  const exportar = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `carrera-backup-${hoy()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  const importar = async (file: File) => {
    try {
      const parsed = JSON.parse(await file.text()) as CarreraData;
      if (!parsed || typeof parsed.materias !== "object") throw new Error();
      setData(() => ({ materias: parsed.materias, practica: !!parsed.practica }));
    } catch {
      alert("El archivo no es un backup válido.");
    }
  };

  return (
    <main className="min-h-screen bg-neutral-50 px-4 py-8 sm:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        {/* ---------------- HEADER ---------------- */}
        <header className="flex flex-col gap-4 border-b border-neutral-200 pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Link href="/" className="text-xs uppercase tracking-[0.25em] text-neutral-400 hover:text-neutral-700">
              ← Dashboard
            </Link>
            <h1 className="mt-1 font-serif text-3xl font-semibold text-neutral-900">Mi Carrera</h1>
            <p className="text-sm text-neutral-500">
              Lic. en Ciencias de la Computación · UNSJ · Plan Ord. 10/2022
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <SyncPill status={sync.status} lastSync={sync.lastSync} onClick={() => setSyncOpen(true)} />
            <button onClick={exportar} className="rounded-full border border-neutral-300 bg-white px-4 py-2 text-sm hover:bg-neutral-100">
              Exportar backup
            </button>
            <button
              onClick={() => fileRef.current?.click()}
              className="rounded-full border border-neutral-300 bg-white px-4 py-2 text-sm hover:bg-neutral-100"
            >
              Importar
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) importar(f);
                e.target.value = "";
              }}
            />
          </div>
        </header>

        {/* ---------------- PROGRESO ---------------- */}
        <section className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border-2 border-indigo-300 bg-indigo-50 p-5 md:col-span-2">
            <div className="flex items-baseline justify-between gap-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-indigo-700">Prioridad · Título intermedio</p>
                <h2 className="font-serif text-xl font-semibold text-indigo-950">Tecnicatura Universitaria en Programación</h2>
              </div>
              <p className="text-4xl font-semibold tabular-nums text-indigo-700">{Math.round(stats.tupPct)}%</p>
            </div>
            <Bar pct={stats.tupPct} color="bg-indigo-600" track="bg-indigo-100" />
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm text-indigo-900">
              <span>
                {stats.tupAprob} / {TUP_IDS.length} materias aprobadas
                {stats.promedioTup !== null && <> · promedio TUP {stats.promedioTup.toFixed(2)}</>}
              </span>
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-white px-3 py-1.5 ring-1 ring-indigo-200">
                <input
                  type="checkbox"
                  checked={data.practica}
                  onChange={(e) => setData((d) => ({ ...d, practica: e.target.checked }))}
                  className="h-4 w-4 accent-indigo-600"
                />
                Práctica Socio-Educativa cumplida
              </label>
            </div>
          </div>

          <div className="rounded-2xl border border-neutral-200 bg-white p-5">
            <div className="flex items-baseline justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-neutral-500">Título de grado</p>
                <h2 className="font-serif text-xl font-semibold">Licenciatura</h2>
              </div>
              <p className="text-4xl font-semibold tabular-nums text-neutral-800">{Math.round(stats.licPct)}%</p>
            </div>
            <Bar pct={stats.licPct} color="bg-neutral-800" track="bg-neutral-100" />
            <p className="mt-3 text-sm text-neutral-600">
              {stats.aprobadas} / {PLAN.length} materias aprobadas
            </p>
          </div>
        </section>

        <section className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <Stat label="Promedio" value={stats.promedio?.toFixed(2) ?? "—"} hint="sin aplazos" />
          <Stat label="Con aplazos" value={stats.promedioAplazos?.toFixed(2) ?? "—"} hint="incluye finales desaprobados" />
          <Stat label="Regulares" value={stats.regulares} hint="finales pendientes" />
          <Stat label="Cursando" value={stats.cursando} />
          <Stat label="Disponibles" value={stats.disponibles} hint="para inscribirte" />
        </section>

        {/* ---------------- PROXIMOS PASOS ---------------- */}
        {hydrated && (proximas.finales.length > 0 || proximas.cursar.length > 0) && (
          <section className="rounded-2xl border border-neutral-200 bg-white p-5">
            <h2 className="font-serif text-lg font-semibold">Próximos pasos</h2>
            <div className="mt-3 grid gap-4 md:grid-cols-2">
              {proximas.finales.length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-sky-700">Podés rendir el final</p>
                  <Chips items={proximas.finales} onOpen={setAbierta} data={data} />
                </div>
              )}
              {proximas.cursar.length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-neutral-500">Podés cursar</p>
                  <Chips items={proximas.cursar} onOpen={setAbierta} data={data} />
                </div>
              )}
            </div>
          </section>
        )}

        {/* ---------------- FILTROS + LEYENDA ---------------- */}
        <section className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="inline-flex rounded-full bg-neutral-200 p-1 text-sm">
            {(
              [
                ["todas", "Todas"],
                ["tup", "Solo TUP"],
                ["accion", "En curso / disponibles"],
              ] as [Filtro, string][]
            ).map(([k, label]) => (
              <button
                key={k}
                onClick={() => setFiltro(k)}
                className={`rounded-full px-3 py-1.5 transition-colors ${
                  filtro === k ? "bg-white font-medium shadow-sm" : "text-neutral-600 hover:text-neutral-900"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-1.5 text-xs">
            <span className="rounded-full bg-indigo-600 px-2 py-0.5 font-semibold text-white">TUP</span>
            {(["aprobada", "regular", "cursando", "libre", "disponible", "bloqueada"] as Vista[]).map((v) => (
              <span key={v} className={`rounded-full px-2 py-0.5 ${VISTA_META[v].pill}`}>
                {VISTA_META[v].label}
              </span>
            ))}
          </div>
        </section>

        {/* ---------------- MATERIAS POR AÑO ---------------- */}
        {ANIOS.map((anio) => {
          const mats = PLAN.filter((mat) => mat.anio === anio && visible(mat));
          if (!mats.length) return null;
          const aprob = PLAN.filter((mat) => mat.anio === anio && info[mat.id].aprobada).length;
          const total = PLAN.filter((mat) => mat.anio === anio).length;
          return (
            <section key={anio}>
              <div className="mb-2 flex items-baseline justify-between">
                <h2 className="font-serif text-lg font-semibold">{ORDINAL[anio]} Año</h2>
                <span className="text-xs text-neutral-500">
                  {aprob}/{total} aprobadas
                </span>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {mats.map((mat) => (
                  <MateriaCard key={mat.id} mat={mat} s={st(mat.id)} i={info[mat.id]} data={data} onOpen={() => setAbierta(mat.id)} />
                ))}
              </div>
            </section>
          );
        })}

        <p className="pb-6 text-center text-xs text-neutral-400">
          Correlatividades según Res. 109/2022-CD-FCEFN. Los datos se guardan en este navegador; usá “Exportar backup” para
          pasarlos a otro dispositivo.
        </p>
      </div>

      {syncOpen && (
        <SyncModal
          cfg={sync.cfg}
          status={sync.status}
          error={sync.error}
          onSave={(c) => sync.setCfg(c)}
          onSyncNow={sync.sincronizar}
          onClose={() => setSyncOpen(false)}
        />
      )}

      {abierta !== null && (
        <Detalle
          mat={MATERIAS_BY_ID[abierta]}
          s={st(abierta)}
          i={info[abierta]}
          info={info}
          data={data}
          update={(patch) => update(abierta, patch)}
          onClose={() => setAbierta(null)}
          onOpen={setAbierta}
        />
      )}
    </main>
  );
}

/* =========================================================================
 * COMPONENTES
 * ========================================================================= */

function Bar({ pct, color, track }: { pct: number; color: string; track: string }) {
  return (
    <div className={`mt-3 h-3 w-full overflow-hidden rounded-full ${track}`}>
      <div className={`h-full rounded-full ${color} transition-all duration-500`} style={{ width: `${pct}%` }} />
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white px-4 py-3">
      <p className="text-xs uppercase tracking-wider text-neutral-500">{label}</p>
      <p className="text-2xl font-semibold tabular-nums">{value}</p>
      {hint && <p className="text-[11px] text-neutral-400">{hint}</p>}
    </div>
  );
}

function Chips({ items, onOpen, data }: { items: Materia[]; onOpen: (id: number) => void; data: CarreraData }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((mat) => (
        <button
          key={mat.id}
          onClick={() => onOpen(mat.id)}
          className={`rounded-full px-3 py-1 text-left text-sm transition-colors ${
            mat.tup
              ? "bg-indigo-100 text-indigo-900 ring-1 ring-indigo-300 hover:bg-indigo-200"
              : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
          }`}
        >
          <span className="mr-1 font-mono text-xs opacity-60">{mat.id}</span>
          {nombre(data, mat.id)}
        </button>
      ))}
    </div>
  );
}

function MateriaCard({
  mat,
  s,
  i,
  data,
  onOpen,
}: {
  mat: Materia;
  s: MateriaState;
  i: Info;
  data: CarreraData;
  onOpen: () => void;
}) {
  const meta = VISTA_META[i.vista];
  const base = mat.tup
    ? "border-indigo-200 bg-indigo-50/70 border-l-4 border-l-indigo-500 hover:bg-indigo-100/70"
    : "border-neutral-200 bg-white border-l-4 border-l-neutral-300 hover:bg-neutral-50";
  const nota =
    i.vista === "aprobada" || i.vista === "retenida"
      ? s.notaFinal
      : i.vista === "regular"
        ? s.notaCursada
        : undefined;

  return (
    <button
      onClick={onOpen}
      className={`flex w-full items-start gap-3 rounded-xl border p-3 text-left transition-colors ${base} ${
        i.vista === "bloqueada" ? "opacity-55" : ""
      }`}
    >
      <span
        className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full font-mono text-xs font-semibold ${
          mat.tup ? "bg-indigo-600 text-white" : "bg-neutral-200 text-neutral-700"
        }`}
      >
        {mat.id}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium leading-snug text-neutral-900">{nombre(data, mat.id)}</span>
        <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${meta.pill}`}>
            {i.vista === "aprobada" && s.via === "promocion" ? "Promocionada" : meta.label}
          </span>
          {i.vista === "regular" && (
            <span className="text-[11px] text-sky-700">{i.puedeRendir ? "puede rendir" : "final bloqueado"}</span>
          )}
          {mat.tup && <span className="text-[10px] font-semibold uppercase tracking-wider text-indigo-600">TUP</span>}
          {i.inconsistente && (
            <span className="text-[11px] text-rose-600" title="Cargaste avance sin cumplir las correlativas para cursar">
              ⚠ correlativas
            </span>
          )}
        </span>
      </span>
      {typeof nota === "number" && (
        <span className={`text-lg font-semibold tabular-nums ${i.vista === "regular" ? "text-sky-700" : "text-emerald-700"}`}>
          {nota}
        </span>
      )}
    </button>
  );
}

/* ---------------------- Panel de detalle / acciones ---------------------- */

function Detalle({
  mat,
  s,
  i,
  info,
  data,
  update,
  onClose,
  onOpen,
}: {
  mat: Materia;
  s: MateriaState;
  i: Info;
  info: Record<number, Info>;
  data: CarreraData;
  update: (patch: Partial<MateriaState>) => void;
  onClose: () => void;
  onOpen: (id: number) => void;
}) {
  const [nota, setNota] = useState<string>("");
  const [fecha, setFecha] = useState<string>(hoy());
  const [modo, setModo] = useState<null | "regular" | "promocion" | "final" | "libre" | "directa">(null);
  const notaNum = nota === "" ? undefined : Number(nota);
  const notaValida = notaNum !== undefined && notaNum >= 1 && notaNum <= 10;

  const abrirForm = (m: typeof modo) => {
    setModo(m);
    setNota("");
    setFecha(hoy());
  };

  const confirmar = () => {
    if (modo === "regular") {
      update({ estado: "regular", notaCursada: notaNum, fechaRegular: fecha });
    } else if (modo === "promocion" || modo === "directa") {
      if (!notaValida || notaNum! < NOTA_APROBACION) return;
      update({ estado: "aprobada", via: modo === "promocion" ? "promocion" : "final", notaFinal: notaNum, fechaAprobada: fecha });
    } else if (modo === "final" || modo === "libre") {
      if (!notaValida) return;
      const intento: Intento = { fecha, nota: notaNum!, tipo: modo === "final" ? "regular" : "libre" };
      const intentos = [...s.intentos, intento];
      if (notaNum! >= NOTA_APROBACION) {
        update({ estado: "aprobada", via: modo === "final" ? "final" : "libre", notaFinal: notaNum, fechaAprobada: fecha, intentos });
      } else {
        update({ intentos });
      }
    }
    setModo(null);
  };

  const deshacer = () => {
    if (s.estado === "aprobada") {
      // Si se aprobo por final, se quita el intento aprobado del historial
      const intentos =
        s.via === "promocion" ? s.intentos : s.intentos.filter((x, idx, arr) => !(idx === arr.length - 1 && x.nota >= NOTA_APROBACION));
      const vuelta: Estado = s.via === "promocion" ? "cursando" : s.via === "libre" ? "libre" : s.fechaRegular ? "regular" : "pendiente";
      update({ estado: vuelta, via: undefined, notaFinal: undefined, fechaAprobada: undefined, intentos });
    } else if (s.estado === "regular") update({ estado: "cursando", notaCursada: undefined, fechaRegular: undefined });
    else if (s.estado === "cursando" || s.estado === "libre") update({ estado: "pendiente" });
  };

  const meta = VISTA_META[i.vista];
  const Req = ({ ids, ok, label }: { ids: number[]; ok: (id: number) => boolean; label: string }) =>
    ids.length === 0 ? null : (
      <div>
        <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-neutral-500">{label}</p>
        <ul className="space-y-1">
          {ids.map((id) => (
            <li key={id}>
              <button onClick={() => onOpen(id)} className="flex w-full items-center gap-2 text-left text-sm hover:underline">
                <span className={ok(id) ? "text-emerald-600" : "text-rose-500"}>{ok(id) ? "✓" : "✗"}</span>
                <span className="font-mono text-xs text-neutral-400">{id}</span>
                <span className={MATERIAS_BY_ID[id].tup ? "text-indigo-900" : ""}>{nombre(data, id)}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    );

  const btn = "rounded-full px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40";

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4" onClick={onClose}>
      <div
        className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs text-neutral-500">
              Cód. {mat.id} · {ORDINAL[mat.anio]} año{" "}
              {mat.tup && <span className="ml-1 rounded bg-indigo-600 px-1.5 py-0.5 text-[10px] font-semibold text-white">TUP</span>}
            </p>
            <h3 className="font-serif text-xl font-semibold leading-tight">{nombre(data, mat.id)}</h3>
            <span className={`mt-2 inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${meta.pill}`}>
              {i.vista === "aprobada" && s.via ? `Aprobada · ${s.via === "promocion" ? "promoción" : s.via === "libre" ? "final libre" : "final"}` : meta.label}
            </span>
          </div>
          <button onClick={onClose} className="rounded-full px-2 text-2xl leading-none text-neutral-400 hover:text-neutral-800" aria-label="Cerrar">
            ×
          </button>
        </div>

        {mat.electiva && (
          <label className="mt-4 block text-sm">
            <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500">Nombre de la electiva</span>
            <input
              value={s.nombre ?? ""}
              onChange={(e) => update({ nombre: e.target.value })}
              placeholder="Ej: Machine Learning"
              className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2"
            />
          </label>
        )}

        {/* ---- Avisos ---- */}
        {i.vista === "retenida" && (
          <p className="mt-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900">
            La nota está cargada, pero la aprobación no cuenta hasta aprobar: {i.faltaRendir.map((r) => r).join(", ")}.
          </p>
        )}
        {i.inconsistente && (
          <p className="mt-4 rounded-lg bg-rose-50 p-3 text-sm text-rose-800">
            ⚠ Tenés avance cargado pero no se cumplen las correlativas para cursar. Revisá: {i.faltaCursar.join(" · ")}.
          </p>
        )}

        {/* ---- Acciones segun estado ---- */}
        <div className="mt-5 space-y-3">
          {s.estado === "pendiente" &&
            (i.puedeCursar ? (
              <div className="flex flex-wrap gap-2">
                <button className={`${btn} bg-amber-400 text-amber-950 hover:bg-amber-300`} onClick={() => update({ estado: "cursando" })}>
                  Empezar a cursar
                </button>
                <button className={`${btn} border border-neutral-300 hover:bg-neutral-100`} onClick={() => abrirForm("directa")}>
                  Ya la tengo aprobada
                </button>
              </div>
            ) : (
              <div className="rounded-lg bg-neutral-100 p-3 text-sm text-neutral-700">
                <p className="font-medium">Bloqueada. Para cursarla te falta:</p>
                <ul className="mt-1 list-inside list-disc">
                  {i.faltaCursar.map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                </ul>
              </div>
            ))}

          {s.estado === "cursando" && (
            <div>
              <p className="mb-2 text-sm text-neutral-600">¿Cómo terminaste la cursada?</p>
              <div className="flex flex-wrap gap-2">
                <button className={`${btn} bg-sky-600 text-white hover:bg-sky-500`} onClick={() => abrirForm("regular")}>
                  Regular
                </button>
                <button className={`${btn} bg-emerald-600 text-white hover:bg-emerald-500`} onClick={() => abrirForm("promocion")}>
                  Promocional
                </button>
                <button className={`${btn} bg-rose-600 text-white hover:bg-rose-500`} onClick={() => update({ estado: "libre" })}>
                  Libre
                </button>
              </div>
            </div>
          )}

          {(s.estado === "regular" || s.estado === "libre") && (
            <div className="space-y-2">
              {!i.puedeRendir && (
                <p className="rounded-lg bg-sky-50 p-3 text-sm text-sky-900">
                  Todavía no podés rendir el final. Tenés que aprobar antes:{" "}
                  {i.faltaRendir.map((r) => `${r} · ${nombre(data, r)}`).join(", ")}.
                </p>
              )}
              {s.estado === "regular" && i.puedeRendir && (
                <p className="text-sm text-sky-800">
                  Regularizada{s.fechaRegular ? ` el ${s.fechaRegular}` : ""}. Ya cuenta como correlativa débil para cursar.
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                {s.estado === "regular" ? (
                  <>
                    <button className={`${btn} bg-emerald-600 text-white hover:bg-emerald-500`} disabled={!i.puedeRendir} onClick={() => abrirForm("final")}>
                      Registrar final
                    </button>
                    <button className={`${btn} border border-rose-300 text-rose-700 hover:bg-rose-50`} onClick={() => update({ estado: "libre" })}>
                      Perdí la regularidad
                    </button>
                  </>
                ) : (
                  <>
                    <button className={`${btn} bg-amber-400 text-amber-950 hover:bg-amber-300`} onClick={() => update({ estado: "cursando" })}>
                      Volver a cursar
                    </button>
                    <button className={`${btn} bg-emerald-600 text-white hover:bg-emerald-500`} disabled={!i.puedeRendir} onClick={() => abrirForm("libre")}>
                      Rendir libre
                    </button>
                  </>
                )}
              </div>
            </div>
          )}

          {s.estado === "aprobada" && (
            <div className="flex flex-wrap items-center gap-3">
              <label className="text-sm">
                Nota{" "}
                <input
                  type="number"
                  min={NOTA_APROBACION}
                  max={10}
                  value={s.notaFinal ?? ""}
                  onChange={(e) => update({ notaFinal: e.target.value === "" ? undefined : Number(e.target.value) })}
                  className="ml-1 w-16 rounded-lg border border-neutral-300 px-2 py-1"
                />
              </label>
              <label className="text-sm">
                Fecha{" "}
                <input
                  type="date"
                  value={s.fechaAprobada ?? ""}
                  onChange={(e) => update({ fechaAprobada: e.target.value })}
                  className="ml-1 rounded-lg border border-neutral-300 px-2 py-1"
                />
              </label>
            </div>
          )}

          {/* ---- Formulario de nota ---- */}
          {modo && (
            <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-3">
              <p className="mb-2 text-sm font-medium">
                {modo === "regular" && "Regularizar (nota de cursada opcional)"}
                {modo === "promocion" && "Promoción: nota final"}
                {modo === "final" && "Final (si sacás menos de 4 queda como aplazo)"}
                {modo === "libre" && "Final libre (si sacás menos de 4 queda como aplazo)"}
                {modo === "directa" && "Cargar como aprobada (historial)"}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="number"
                  min={1}
                  max={10}
                  step="0.5"
                  autoFocus
                  placeholder="Nota"
                  value={nota}
                  onChange={(e) => setNota(e.target.value)}
                  className="w-20 rounded-lg border border-neutral-300 px-2 py-1.5"
                />
                <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className="rounded-lg border border-neutral-300 px-2 py-1.5" />
                <button
                  className={`${btn} bg-neutral-900 text-white hover:bg-neutral-700`}
                  disabled={
                    modo === "regular"
                      ? nota !== "" && !notaValida
                      : !notaValida || ((modo === "promocion" || modo === "directa") && notaNum! < NOTA_APROBACION)
                  }
                  onClick={confirmar}
                >
                  Guardar
                </button>
                <button className="text-sm text-neutral-500 hover:text-neutral-800" onClick={() => setModo(null)}>
                  Cancelar
                </button>
              </div>
            </div>
          )}

          {s.estado !== "pendiente" && (
            <button onClick={deshacer} className="text-xs text-neutral-500 underline hover:text-neutral-800">
              Deshacer último paso
            </button>
          )}
        </div>

        {/* ---- Historial de finales ---- */}
        {s.intentos.length > 0 && (
          <div className="mt-5">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-neutral-500">Finales rendidos</p>
            <ul className="divide-y divide-neutral-100 text-sm">
              {s.intentos.map((x, idx) => (
                <li key={idx} className="flex items-center justify-between py-1.5">
                  <span>
                    {x.fecha} · {x.tipo === "libre" ? "libre" : "regular"}
                  </span>
                  <span className="flex items-center gap-3">
                    <span className={`font-semibold ${x.nota >= NOTA_APROBACION ? "text-emerald-700" : "text-rose-600"}`}>{x.nota}</span>
                    <button
                      className="text-neutral-400 hover:text-rose-600"
                      aria-label="Borrar intento"
                      onClick={() => update({ intentos: s.intentos.filter((_, j) => j !== idx) })}
                    >
                      ×
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* ---- Correlatividades ---- */}
        <div className="mt-6 grid gap-4 border-t border-neutral-100 pt-4 sm:grid-cols-2">
          <Req ids={mat.cursada} ok={(id) => info[id].regularizada} label="Para cursar · regularizada" />
          <Req ids={mat.rendida} ok={(id) => info[id].aprobada} label="Para cursar · aprobada" />
          {mat.id !== 39 && <Req ids={mat.rendir} ok={(id) => info[id].aprobada} label="Para rendir · aprobada" />}
          {mat.id === 39 && (
            <p className="text-sm text-neutral-600 sm:col-span-2">
              Para rendir: todas las materias 1 a 38 aprobadas ({mat.rendir.filter((r) => info[r].aprobada).length}/38).
            </p>
          )}
          <Req ids={HABILITA[mat.id]} ok={(id) => info[id].puedeCursar} label="Habilita a cursar" />
        </div>
      </div>
    </div>
  );
}

/* ---------------------- Google Sheets: estado y configuracion ---------------------- */

const SYNC_META: Record<SyncStatus, { label: string; cls: string }> = {
  off: { label: "Conectar Google Sheets", cls: "border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100" },
  conectando: { label: "Conectando…", cls: "border-neutral-300 bg-white text-neutral-600" },
  ok: { label: "Guardado en Sheets", cls: "border-emerald-300 bg-white text-emerald-700 hover:bg-emerald-50" },
  guardando: { label: "Guardando…", cls: "border-neutral-300 bg-white text-neutral-600" },
  pendiente: { label: "Sin conexión · cambios pendientes", cls: "border-amber-300 bg-amber-50 text-amber-800" },
  error: { label: "Error al sincronizar", cls: "border-rose-300 bg-rose-50 text-rose-700 hover:bg-rose-100" },
};

function SyncPill({ status, lastSync, onClick }: { status: SyncStatus; lastSync: Date | null; onClick: () => void }) {
  const meta = SYNC_META[status];
  return (
    <button onClick={onClick} className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm ${meta.cls}`}>
      <span aria-hidden>{status === "ok" ? "✓" : status === "error" ? "!" : "☁"}</span>
      {meta.label}
      {status === "ok" && lastSync && (
        <span className="text-xs opacity-70">{lastSync.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}</span>
      )}
    </button>
  );
}

const SCRIPT_URL = "https://github.com/Hernan-carrion/personal-tracker-dashboard/blob/main/apps-script/Code.gs";

function SyncModal({
  cfg,
  status,
  error,
  onSave,
  onSyncNow,
  onClose,
}: {
  cfg: SyncConfig | null;
  status: SyncStatus;
  error: string | null;
  onSave: (c: SyncConfig | null) => void;
  onSyncNow: () => void;
  onClose: () => void;
}) {
  const [url, setUrl] = useState(cfg?.url ?? "");
  const [token, setToken] = useState(cfg?.token ?? "");
  const [probando, setProbando] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const urlValida = /^https:\/\/script\.google\.com\/.+\/exec$/.test(url.trim());

  const conectar = async () => {
    const c = { url: url.trim(), token: token.trim() };
    setProbando(true);
    setMsg(null);
    try {
      await probarConexion(c);
      onSave(c);
      onClose();
    } catch (err) {
      setMsg(errorLegible(err));
    } finally {
      setProbando(false);
    }
  };

  const btn = "rounded-full px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40";

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4" onClick={onClose}>
      <div
        className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <h3 className="font-serif text-xl font-semibold">Guardar en Google Sheets</h3>
          <button onClick={onClose} className="rounded-full px-2 text-2xl leading-none text-neutral-400 hover:text-neutral-800" aria-label="Cerrar">
            ×
          </button>
        </div>

        {cfg && (
          <div className={`mt-3 rounded-lg p-3 text-sm ${status === "error" ? "bg-rose-50 text-rose-800" : "bg-emerald-50 text-emerald-900"}`}>
            {status === "error" ? error : SYNC_META[status].label}
          </div>
        )}

        <ol className="mt-4 list-inside list-decimal space-y-1 text-sm text-neutral-700">
          <li>
            Creá un Google Sheet nuevo → <b>Extensiones → Apps Script</b>.
          </li>
          <li>
            Pegá el contenido de{" "}
            <a href={SCRIPT_URL} target="_blank" rel="noreferrer" className="text-indigo-700 underline">
              apps-script/Code.gs
            </a>{" "}
            y cambiá <code className="rounded bg-neutral-100 px-1">TOKEN</code> por una clave tuya.
          </li>
          <li>
            <b>Implementar → Nueva implementación → Aplicación web</b>. Ejecutar como: <i>Yo</i>. Acceso: <i>Cualquier usuario</i>.
          </li>
          <li>
            Copiá la URL (termina en <code className="rounded bg-neutral-100 px-1">/exec</code>) y pegala acá con la misma clave.
          </li>
        </ol>

        <div className="mt-4 space-y-3">
          <label className="block text-sm">
            <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500">URL de la aplicación web</span>
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://script.google.com/macros/s/…/exec"
              className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 font-mono text-xs"
            />
          </label>
          <label className="block text-sm">
            <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500">Clave (TOKEN)</span>
            <input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2"
            />
          </label>
          {url && !urlValida && (
            <p className="text-xs text-rose-600">La URL debería empezar con https://script.google.com/ y terminar en /exec.</p>
          )}
          {msg && <p className="rounded-lg bg-rose-50 p-3 text-sm text-rose-800">{msg}</p>}
          <p className="text-xs text-neutral-500">
            La URL y la clave quedan guardadas solo en este navegador. Repetí este paso en cada dispositivo (celular, compu) con los
            mismos datos.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              className={`${btn} bg-emerald-600 text-white hover:bg-emerald-500`}
              disabled={!urlValida || !token.trim() || probando}
              onClick={conectar}
            >
              {probando ? "Probando…" : cfg ? "Guardar cambios" : "Conectar"}
            </button>
            {cfg && (
              <>
                <button className={`${btn} border border-neutral-300 hover:bg-neutral-100`} onClick={onSyncNow}>
                  Sincronizar ahora
                </button>
                <button
                  className={`${btn} border border-rose-300 text-rose-700 hover:bg-rose-50`}
                  onClick={() => {
                    onSave(null);
                    onClose();
                  }}
                >
                  Desconectar
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
