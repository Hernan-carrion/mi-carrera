"use client";

import { useEffect, useMemo, useState } from "react";

/* =========================================================================
 * PERSISTENCIA LOCAL (localStorage)
 * La app no tiene backend: todo vive en el navegador del celular/PC donde
 * se abre. Cada valor se guarda bajo su propia clave para poder cargarlos
 * de forma independiente.
 * ========================================================================= */

function useLocalStorage<T>(key: string, initialValue: T) {
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

  return [value, setValue] as const;
}

/* =========================================================================
 * TIPOS Y DATOS BASE
 * ========================================================================= */

type Priority = "A" | "B" | "C" | "D" | "E";

interface Task {
  id: string;
  text: string;
  priority: Priority;
  done: boolean;
}

const uid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

const PRIORITY_ORDER: Record<Priority, number> = { A: 0, B: 1, C: 2, D: 3, E: 4 };

const PRIORITY_META: Record<
  Priority,
  { label: string; hint: string; badge: string }
> = {
  A: { label: "Vital", hint: "Consecuencias graves si no se hace", badge: "bg-neutral-900 text-white" },
  B: { label: "Importante", hint: "Consecuencias leves", badge: "bg-neutral-700 text-white" },
  C: { label: "Agradable", hint: "Sin consecuencias", badge: "bg-neutral-300 text-neutral-800" },
  D: { label: "Delegar", hint: "Puede hacerlo otra persona", badge: "bg-neutral-200 text-neutral-600" },
  E: { label: "Eliminar", hint: "No aporta valor real", badge: "bg-neutral-100 text-neutral-400" },
};

const INITIAL_TASKS: Task[] = [
  { id: uid(), text: "Terminar el modulo de autenticacion del proyecto Next.js", priority: "A", done: false },
  { id: uid(), text: "Resolver tickets criticos de soporte tecnico FA", priority: "A", done: false },
  { id: uid(), text: "Repasar apuntes para el parcial de la UNSJ", priority: "B", done: false },
  { id: uid(), text: "Responder mensajes no urgentes del equipo", priority: "C", done: false },
  { id: uid(), text: "Armar el informe mensual (delegar a un companero)", priority: "D", done: false },
  { id: uid(), text: "Revisar redes sociales", priority: "E", done: false },
];

const DEFAULT_GOALS: [string, string, string] = [
  "Terminar el ciclo lectivo en la UNSJ con excelente rendimiento academico.",
  "Crecer como desarrollador Next.js y asumir mas responsabilidad en el trabajo.",
  "Sostener el entrenamiento de hipertrofia con constancia, sin cortar la racha.",
];

const TRACY_QUOTES: string[] = [
  "La Hora de Oro: Dedica los primeros 60 minutos de la manana a estudiar ciencias de la computacion o leer sobre sistemas, antes de revisar el celular.",
  "Orientacion a la accion: Si tienes reparaciones tecnicas pendientes o codigo que escribir, atacalo de inmediato. El sentido de urgencia multiplica la productividad.",
  "Energia y Vitalidad: Tu agudeza mental en el trabajo y la universidad depende de tu fisico. Asegurate de cumplir con tu entrenamiento de hipertrofia hoy.",
  "Planificacion Continua: Escribe tus metas en presente todos los dias. Que habilidades nuevas de programacion vas a dominar este mes?",
];

const HABITS: string[] = [
  "Soporte tecnico FA",
  "Estudio UNSJ",
  "Gym (Hipertrofia)",
  "Proyecto Next.js",
  "Futbol",
];

const DAYS_IN_MONTH = 31;

/* =========================================================================
 * GEOMETRIA DEL TRACKER CIRCULAR (SVG puro + trigonometria)
 * ========================================================================= */

const CX = 210;
const CY = 300;
// Radios mas grandes que el minimo "elegante" a proposito: en pantallas
// tactiles (celular) las celdas del anillo interior son las mas chicas del
// grafico, asi que agrandamos todo el semicirculo para que sigan siendo
// tocables. El SVG no se achica en mobile (ver mas abajo) y el contenedor
// permite scroll horizontal si no entra en pantalla.
const BASE_INNER_RADIUS = 65;
const RING_WIDTH = 34;
const RING_GAP = 7;
const START_ANGLE = -90; // arriba
const END_ANGLE = 90; // abajo (semicirculo que abre hacia la derecha)
const ANGLE_STEP = (END_ANGLE - START_ANGLE) / DAYS_IN_MONTH;
const CELL_PADDING_DEG = 0.5;
const SVG_VIEWBOX_MIN_X = -140;
const SVG_VIEWBOX_WIDTH = 660;
const SVG_VIEWBOX_HEIGHT = 600;

// Redondeamos a 2 decimales: de sobra para la precision visual del SVG, y
// evita mismatches de hidratacion por diferencias de punto flotante entre
// el motor JS del servidor (build estatico) y el del navegador.
const round2 = (n: number) => Math.round(n * 100) / 100;

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const angleRad = (angleDeg * Math.PI) / 180;
  return {
    x: round2(cx + r * Math.cos(angleRad)),
    y: round2(cy + r * Math.sin(angleRad)),
  };
}

function arcSectorPath(
  cx: number,
  cy: number,
  innerR: number,
  outerR: number,
  startAngle: number,
  endAngle: number
) {
  const p1 = polarToCartesian(cx, cy, outerR, startAngle);
  const p2 = polarToCartesian(cx, cy, outerR, endAngle);
  const p3 = polarToCartesian(cx, cy, innerR, endAngle);
  const p4 = polarToCartesian(cx, cy, innerR, startAngle);
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;
  return [
    `M ${p1.x} ${p1.y}`,
    `A ${outerR} ${outerR} 0 ${largeArc} 1 ${p2.x} ${p2.y}`,
    `L ${p3.x} ${p3.y}`,
    `A ${innerR} ${innerR} 0 ${largeArc} 0 ${p4.x} ${p4.y}`,
    "Z",
  ].join(" ");
}

// habito index 0 = anillo mas exterior (arriba), ultimo habito = anillo mas interior (cerca del centro)
function radiusRangeFor(habitIndex: number) {
  const fromInside = HABITS.length - 1 - habitIndex;
  const innerR = BASE_INNER_RADIUS + fromInside * (RING_WIDTH + RING_GAP);
  const outerR = innerR + RING_WIDTH;
  return { innerR, outerR };
}

const OUTERMOST_RADIUS = radiusRangeFor(0).outerR;
const DAY_TICKS = [1, 5, 10, 15, 20, 25, 31];

/* =========================================================================
 * COMPONENTE PRINCIPAL
 * ========================================================================= */

export default function Home() {
  const [today, setToday] = useState<Date | null>(null);
  useEffect(() => setToday(new Date()), []);
  const currentDay = today ? today.getDate() : null;

  // --- ABCDE / Eat That Frog ---
  const [tasks, setTasks] = useLocalStorage<Task[]>("tracker.tasks", INITIAL_TASKS);
  const [newTaskText, setNewTaskText] = useState("");
  const [newTaskPriority, setNewTaskPriority] = useState<Priority>("A");

  const rankedTasks = useMemo(() => {
    const sorted = [...tasks].sort(
      (a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]
    );
    const counts: Partial<Record<Priority, number>> = {};
    return sorted.map((task) => {
      counts[task.priority] = (counts[task.priority] ?? 0) + 1;
      return { ...task, rank: counts[task.priority] as number };
    });
  }, [tasks]);

  const frog = rankedTasks.find((t) => t.priority === "A" && t.rank === 1);

  function addTask(text: string, priority: Priority) {
    const trimmed = text.trim();
    if (!trimmed) return;
    setTasks((prev) => [...prev, { id: uid(), text: trimmed, priority, done: false }]);
  }

  function toggleDone(id: string) {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t)));
  }

  function removeTask(id: string) {
    setTasks((prev) => prev.filter((t) => t.id !== id));
  }

  // --- La Ley del Tres ---
  const [threeGoals, setThreeGoals] = useLocalStorage<string[]>("tracker.goals", DEFAULT_GOALS);

  function addGoal() {
    setThreeGoals((prev) => [...prev, ""]);
  }

  function removeGoal(index: number) {
    setThreeGoals((prev) => prev.filter((_, idx) => idx !== index));
  }

  // --- Tracy Bot ---
  const [quoteIndex, setQuoteIndex] = useState(0);
  useEffect(() => {
    const id = setInterval(() => {
      setQuoteIndex((i) => (i + 1) % TRACY_QUOTES.length);
    }, 9000);
    return () => clearInterval(id);
  }, []);

  // --- Regla del 10/90: cierre de dia ---
  const [isDayCloseOpen, setIsDayCloseOpen] = useState(false);
  const [tomorrowDraft, setTomorrowDraft] = useState<Task[]>([]);
  const [draftText, setDraftText] = useState("");
  const [draftPriority, setDraftPriority] = useState<Priority>("A");
  const [closeMessage, setCloseMessage] = useState("");

  const canConfirmClose = tomorrowDraft.length >= 3 && tomorrowDraft.some((t) => t.priority === "A");

  // Evita el scroll de fondo en el celular mientras el modal esta abierto
  useEffect(() => {
    if (!isDayCloseOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isDayCloseOpen]);

  function addDraftTask() {
    const trimmed = draftText.trim();
    if (!trimmed) return;
    setTomorrowDraft((prev) => [...prev, { id: uid(), text: trimmed, priority: draftPriority, done: false }]);
    setDraftText("");
  }

  function removeDraftTask(id: string) {
    setTomorrowDraft((prev) => prev.filter((t) => t.id !== id));
  }

  function confirmDayClose() {
    if (!canConfirmClose) return;
    setTasks(tomorrowDraft.map((t) => ({ ...t, done: false })));
    setTomorrowDraft([]);
    setIsDayCloseOpen(false);
    setCloseMessage(
      '"1 minuto de planificacion ahorra 10 de ejecucion." Manana ya esta planificado.'
    );
    setTimeout(() => setCloseMessage(""), 6000);
  }

  // --- Tracker de habitos (una grilla por mes: "AAAA-M") ---
  const monthKey = today ? `${today.getFullYear()}-${today.getMonth() + 1}` : null;
  const [allMarks, setAllMarks] = useLocalStorage<Record<string, Record<string, boolean>>>(
    "tracker.marks",
    {}
  );
  const marks = monthKey ? allMarks[monthKey] ?? {} : {};
  function toggleMark(habitIndex: number, day: number) {
    if (!monthKey) return;
    const cellKey = `${habitIndex}-${day}`;
    setAllMarks((prev) => {
      const monthMarks = { ...(prev[monthKey] ?? {}) };
      monthMarks[cellKey] = !monthMarks[cellKey];
      return { ...prev, [monthKey]: monthMarks };
    });
  }
  function habitCompletion(habitIndex: number) {
    let count = 0;
    for (let d = 1; d <= DAYS_IN_MONTH; d++) if (marks[`${habitIndex}-${d}`]) count++;
    return Math.round((count / DAYS_IN_MONTH) * 100);
  }

  // --- Notas ---
  const [notes, setNotes] = useLocalStorage<string>("tracker.notes", "");

  const monthLabel = today
    ? today.toLocaleDateString("es-AR", { month: "long", year: "numeric" })
    : "";

  return (
    <main className="min-h-screen bg-neutral-50 px-4 py-10 sm:px-8">
      <div className="mx-auto max-w-6xl space-y-8">
        {/* ---------------- HEADER ---------------- */}
        <header className="flex flex-col gap-4 border-b border-neutral-200 pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-neutral-400">Agenda personal</p>
            <h1 className="font-serif text-3xl font-semibold text-neutral-900">
              Personal Tracker Dashboard
            </h1>
          </div>
          <div className="flex flex-col items-start gap-2 sm:items-end">
            <p className="text-sm capitalize text-neutral-500">
              {today
                ? today.toLocaleDateString("es-AR", {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })
                : ""}
            </p>
            <button
              onClick={() => setIsDayCloseOpen(true)}
              className="inline-flex items-center gap-2 rounded-full bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-neutral-700 active:bg-neutral-800"
            >
              <span className="sm:hidden">Cierre de Dia</span>
              <span className="hidden sm:inline">Cierre de Dia · Regla 10/90</span>
            </button>
          </div>
        </header>

        {closeMessage && (
          <div className="rounded-lg border border-neutral-300 bg-white px-4 py-3 text-sm text-neutral-600">
            {closeMessage}
          </div>
        )}

        {/* ---------------- LEY DEL TRES ---------------- */}
        <section className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h2 className="font-serif text-lg font-semibold text-neutral-900">La Ley del Tres</h2>
              <p className="text-xs text-neutral-500">
                Los macro-objetivos que aportan el 90% de tu valor a largo plazo. Lo ideal son 3:
                mas que eso y dejan de ser "macro".
              </p>
            </div>
            <button
              onClick={addGoal}
              className="flex-shrink-0 rounded-full border border-neutral-200 px-3 py-1.5 text-xs font-medium text-neutral-600 transition-colors hover:bg-neutral-50 active:bg-neutral-100"
            >
              + Agregar objetivo
            </button>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {threeGoals.map((goal, i) => (
              <div key={i} className="relative rounded-xl border border-neutral-200 bg-neutral-50 p-3">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-medium uppercase tracking-wide text-neutral-400">
                    Objetivo {i + 1}
                  </label>
                  <button
                    onClick={() => removeGoal(i)}
                    aria-label="Quitar objetivo"
                    className="flex h-7 w-7 flex-shrink-0 items-center justify-center text-base text-neutral-300 transition-colors hover:text-neutral-600"
                  >
                    &times;
                  </button>
                </div>
                <textarea
                  value={goal}
                  rows={3}
                  onChange={(e) => {
                    const value = e.target.value;
                    setThreeGoals((prev) => prev.map((g, idx) => (idx === i ? value : g)));
                  }}
                  className="w-full resize-none rounded-md border-none bg-transparent text-sm text-neutral-800 focus:outline-none focus:ring-1 focus:ring-neutral-300"
                />
              </div>
            ))}
            {threeGoals.length === 0 && (
              <p className="py-4 text-sm text-neutral-400 sm:col-span-3">
                No hay objetivos. Agrega el primero.
              </p>
            )}
          </div>
        </section>

        {/* ---------------- ABCDE + TRACY BOT ---------------- */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Gestor ABCDE */}
          <section className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm lg:col-span-2">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="font-serif text-lg font-semibold text-neutral-900">
                  Gestor ABCDE · Eat That Frog
                </h2>
                <p className="text-xs text-neutral-500">
                  A: Vital · B: Importante · C: Agradable · D: Delegar · E: Eliminar
                </p>
              </div>
            </div>

            {frog && (
              <div className="mb-5 rounded-xl border-2 border-neutral-900 bg-neutral-900 p-4 text-white">
                <p className="text-[11px] uppercase tracking-widest text-neutral-300">
                  Sapo del Dia · A1
                </p>
                <p className="mt-1 text-lg font-medium">{frog.text}</p>
                <button
                  onClick={() => toggleDone(frog.id)}
                  className="mt-3 rounded-full border border-white/30 px-3 py-1 text-xs transition-colors hover:bg-white/10"
                >
                  {frog.done ? "Marcado como hecho" : "Marcar como comido"}
                </button>
              </div>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                addTask(newTaskText, newTaskPriority);
                setNewTaskText("");
              }}
              className="mb-4 flex flex-col gap-2 sm:flex-row"
            >
              <input
                value={newTaskText}
                onChange={(e) => setNewTaskText(e.target.value)}
                placeholder="Nueva tarea..."
                className="flex-1 rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-neutral-400"
              />
              <select
                value={newTaskPriority}
                onChange={(e) => setNewTaskPriority(e.target.value as Priority)}
                className="rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-neutral-400"
              >
                {(Object.keys(PRIORITY_META) as Priority[]).map((p) => (
                  <option key={p} value={p}>
                    {p} · {PRIORITY_META[p].label}
                  </option>
                ))}
              </select>
              <button
                type="submit"
                className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-neutral-700"
              >
                Agregar
              </button>
            </form>

            <div className="space-y-2">
              {rankedTasks
                .filter((t) => t.id !== frog?.id)
                .map((task) => (
                  <div
                    key={task.id}
                    className={`flex items-center justify-between gap-3 rounded-lg border border-neutral-100 px-3 py-2 ${
                      task.done ? "opacity-40" : ""
                    }`}
                  >
                    <div className="flex min-w-0 items-center gap-1">
                      <button
                        onClick={() => toggleDone(task.id)}
                        aria-label="Marcar como hecha"
                        className="flex h-9 w-9 flex-shrink-0 items-center justify-center"
                      >
                        <span
                          className={`h-5 w-5 rounded-full border ${
                            task.done ? "border-neutral-900 bg-neutral-900" : "border-neutral-300"
                          }`}
                        />
                      </button>
                      <span className={`truncate text-sm ${task.done ? "line-through" : ""}`}>
                        {task.text}
                      </span>
                    </div>
                    <div className="flex flex-shrink-0 items-center gap-1">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                          PRIORITY_META[task.priority].badge
                        }`}
                      >
                        {task.priority}
                        {task.rank}
                      </span>
                      <button
                        onClick={() => removeTask(task.id)}
                        aria-label="Eliminar tarea"
                        className="flex h-9 w-9 flex-shrink-0 items-center justify-center text-lg text-neutral-300 transition-colors hover:text-neutral-600"
                      >
                        &times;
                      </button>
                    </div>
                  </div>
                ))}
              {tasks.length === 0 && (
                <p className="py-6 text-center text-sm text-neutral-400">
                  No hay tareas. Agrega la primera.
                </p>
              )}
            </div>
          </section>

          {/* Tracy Bot */}
          <div className="flex flex-col gap-6">
            <section className="rounded-2xl border border-neutral-200 bg-neutral-900 p-6 text-white shadow-sm">
              <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-neutral-300">
                Tracy Bot · Consejo del dia
              </div>
              <p className="mt-3 min-h-[120px] text-sm leading-relaxed">
                {TRACY_QUOTES[quoteIndex]}
              </p>
              <div className="mt-4 flex items-center justify-between">
                <div className="flex gap-1">
                  {TRACY_QUOTES.map((_, i) => (
                    <span
                      key={i}
                      className={`h-1.5 w-1.5 rounded-full ${
                        i === quoteIndex ? "bg-white" : "bg-white/20"
                      }`}
                    />
                  ))}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() =>
                      setQuoteIndex((i) => (i - 1 + TRACY_QUOTES.length) % TRACY_QUOTES.length)
                    }
                    className="rounded-full border border-white/20 px-2 py-1 text-xs transition-colors hover:bg-white/10"
                    aria-label="Consejo anterior"
                  >
                    &lsaquo;
                  </button>
                  <button
                    onClick={() => setQuoteIndex((i) => (i + 1) % TRACY_QUOTES.length)}
                    className="rounded-full border border-white/20 px-2 py-1 text-xs transition-colors hover:bg-white/10"
                    aria-label="Siguiente consejo"
                  >
                    &rsaquo;
                  </button>
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
              <h2 className="mb-3 font-serif text-base font-semibold text-neutral-900">
                Resumen del dia
              </h2>
              <dl className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <dt className="text-neutral-500">Tareas A pendientes</dt>
                  <dd className="font-medium">
                    {tasks.filter((t) => t.priority === "A" && !t.done).length}
                  </dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-neutral-500">Tareas completadas</dt>
                  <dd className="font-medium">{tasks.filter((t) => t.done).length}</dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-neutral-500">Total de tareas</dt>
                  <dd className="font-medium">{tasks.length}</dd>
                </div>
              </dl>
            </section>
          </div>
        </div>

        {/* ---------------- TRACKER DE HABITOS (SVG) ---------------- */}
        <section className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
          <div className="mb-4">
            <h2 className="font-serif text-lg font-semibold text-neutral-900 capitalize">
              Tracker de Habitos {monthLabel && `· ${monthLabel}`}
            </h2>
            <p className="text-xs text-neutral-500">
              Toca un arco para marcar el dia. Volve a tocarlo para desmarcarlo.
              <span className="block sm:hidden">Desliza horizontalmente para ver todos los dias.</span>
            </p>
          </div>

          <div className="overflow-x-auto">
            <svg
              viewBox={`${SVG_VIEWBOX_MIN_X} 0 ${SVG_VIEWBOX_WIDTH} ${SVG_VIEWBOX_HEIGHT}`}
              width={SVG_VIEWBOX_WIDTH}
              height={SVG_VIEWBOX_HEIGHT}
              className="mx-auto block max-w-none"
            >
              {/* linea de guia horizontal (estilo hoja de agenda) */}
              <line x1={20} y1={CY} x2={40} y2={CY} stroke="transparent" />

              {HABITS.map((habit, h) => {
                const { innerR, outerR } = radiusRangeFor(h);
                const avgR = (innerR + outerR) / 2;
                const labelPoint = polarToCartesian(CX, CY, avgR, START_ANGLE);
                const pct = habitCompletion(h);

                return (
                  <g key={habit}>
                    <line
                      x1={40}
                      y1={labelPoint.y}
                      x2={labelPoint.x - 6}
                      y2={labelPoint.y}
                      stroke="#d4d4d4"
                      strokeDasharray="2 3"
                    />
                    <text
                      x={36}
                      y={labelPoint.y - 2}
                      textAnchor="end"
                      className="fill-neutral-700 text-[13px] font-medium"
                    >
                      {habit}
                    </text>
                    <text
                      x={36}
                      y={labelPoint.y + 13}
                      textAnchor="end"
                      className="fill-neutral-400 text-[10px]"
                    >
                      {pct}% del mes
                    </text>

                    {Array.from({ length: DAYS_IN_MONTH }).map((_, dIdx) => {
                      const day = dIdx + 1;
                      const startAngle = START_ANGLE + dIdx * ANGLE_STEP + CELL_PADDING_DEG;
                      const endAngle = START_ANGLE + (dIdx + 1) * ANGLE_STEP - CELL_PADDING_DEG;
                      const path = arcSectorPath(CX, CY, innerR, outerR, startAngle, endAngle);
                      const filled = !!marks[`${h}-${day}`];
                      const isToday = currentDay === day;

                      return (
                        <path
                          key={day}
                          d={path}
                          onClick={() => toggleMark(h, day)}
                          stroke={isToday ? "#171717" : "#ffffff"}
                          strokeWidth={isToday ? 1.5 : 1}
                          className={`cursor-pointer transition-colors duration-150 ${
                            filled ? "" : "hover:fill-neutral-400"
                          }`}
                          style={{ touchAction: "manipulation", fill: filled ? "#171717" : "#ececeb" }}
                        >
                          <title>{`${habit} - dia ${day}`}</title>
                        </path>
                      );
                    })}
                  </g>
                );
              })}

              {/* marcas de dias sobre el anillo exterior */}
              {DAY_TICKS.map((day) => {
                const angle = START_ANGLE + (day - 0.5) * ANGLE_STEP;
                const p = polarToCartesian(CX, CY, OUTERMOST_RADIUS + 16, angle);
                return (
                  <text
                    key={day}
                    x={p.x}
                    y={p.y}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    className="fill-neutral-400 text-[9px]"
                  >
                    {day}
                  </text>
                );
              })}
            </svg>
          </div>
        </section>

        {/* ---------------- NOTAS ---------------- */}
        <section className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
          <h2 className="mb-3 font-serif text-lg font-semibold text-neutral-900">Notas</h2>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Ideas, pendientes, aprendizajes del dia..."
            className="h-40 w-full rounded-lg border border-neutral-200 p-4 font-mono text-sm text-neutral-700 focus:outline-none focus:ring-1 focus:ring-neutral-400"
            style={{
              backgroundImage:
                "linear-gradient(to right, rgba(0,0,0,0.05) 1px, transparent 1px), linear-gradient(to bottom, rgba(0,0,0,0.05) 1px, transparent 1px)",
              backgroundSize: "22px 22px",
            }}
          />
        </section>
      </div>

      {/* ---------------- MODAL: REGLA DEL 10/90 ---------------- */}
      {isDayCloseOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
            <p className="text-[11px] uppercase tracking-widest text-neutral-400">
              Regla del 10/90
            </p>
            <h2 className="mt-1 font-serif text-xl font-semibold text-neutral-900">
              Cierre de Dia
            </h2>
            <p className="mt-2 text-sm text-neutral-500">
              1 minuto de planificacion ahorra 10 de ejecucion. Deja planificadas y
              categorizadas las tareas de manana antes de cerrar (minimo 3, incluyendo al
              menos una A).
            </p>

            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <input
                value={draftText}
                onChange={(e) => setDraftText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addDraftTask();
                  }
                }}
                placeholder="Tarea para manana..."
                className="flex-1 rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-neutral-400"
              />
              <select
                value={draftPriority}
                onChange={(e) => setDraftPriority(e.target.value as Priority)}
                className="rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-neutral-400"
              >
                {(Object.keys(PRIORITY_META) as Priority[]).map((p) => (
                  <option key={p} value={p}>
                    {p} · {PRIORITY_META[p].label}
                  </option>
                ))}
              </select>
              <button
                onClick={addDraftTask}
                className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-neutral-700"
              >
                Agregar
              </button>
            </div>

            <div className="mt-4 space-y-2">
              {tomorrowDraft.map((task) => (
                <div
                  key={task.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-neutral-100 px-3 py-2"
                >
                  <span className="truncate text-sm">{task.text}</span>
                  <div className="flex flex-shrink-0 items-center gap-1">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${PRIORITY_META[task.priority].badge}`}
                    >
                      {task.priority}
                    </span>
                    <button
                      onClick={() => removeDraftTask(task.id)}
                      className="flex h-9 w-9 flex-shrink-0 items-center justify-center text-lg text-neutral-300 transition-colors hover:text-neutral-600"
                      aria-label="Quitar"
                    >
                      &times;
                    </button>
                  </div>
                </div>
              ))}
              {tomorrowDraft.length === 0 && (
                <p className="py-4 text-center text-sm text-neutral-400">
                  Todavia no planificaste nada para manana.
                </p>
              )}
            </div>

            <div className="mt-6 flex items-center justify-between gap-3">
              <button
                onClick={() => setIsDayCloseOpen(false)}
                className="rounded-full border border-neutral-200 px-4 py-2 text-sm text-neutral-600 transition-colors hover:bg-neutral-50"
              >
                Cancelar
              </button>
              <button
                onClick={confirmDayClose}
                disabled={!canConfirmClose}
                className="rounded-full bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-neutral-700 disabled:cursor-not-allowed disabled:bg-neutral-200 disabled:text-neutral-400"
              >
                Confirmar cierre ({tomorrowDraft.length}/3)
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
