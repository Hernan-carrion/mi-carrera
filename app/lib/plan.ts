/* =========================================================================
 * PLAN DE ESTUDIOS - Licenciatura en Ciencias de la Computacion (UNSJ)
 * Ord. N° 10/2022-CD-FCEFN, correlatividades segun Res. 109/2022-CD-FCEFN.
 * Titulo intermedio: Tecnicatura Universitaria en Programacion (TUP).
 *
 * - cursada: para CURSAR hay que tener estas materias regularizadas
 *            (correlativa "debil": alcanza con la cursada aprobada).
 * - rendida: para CURSAR hay que tener estas materias aprobadas.
 * - rendir:  para RENDIR el final hay que tener estas materias aprobadas.
 * ========================================================================= */

export interface Materia {
  id: number;
  nombre: string;
  anio: number;
  tup: boolean;
  cursada: number[];
  rendida: number[];
  rendir: number[];
  electiva?: boolean;
  /** Para cursar requiere la Practica Socio-Educativa cumplida. */
  requierePractica?: boolean;
}

const m = (
  id: number,
  nombre: string,
  anio: number,
  tup: boolean,
  cursada: number[] = [],
  rendida: number[] = [],
  rendir: number[] = [],
  extra: Partial<Materia> = {}
): Materia => ({ id, nombre, anio, tup, cursada, rendida, rendir, ...extra });

export const PLAN: Materia[] = [
  // ---- 1° Año ----
  m(1, "Algoritmos y Resolución de Problemas", 1, true),
  m(2, "Matemática Básica", 1, true),
  m(3, "Estructura y Funcionamiento de Computadoras", 1, true),
  m(4, "Programación Procedural", 1, true, [1, 3], [], [1, 3]),
  m(5, "Álgebra Lineal", 1, true, [2], [], [2]),
  m(6, "Sistemas Operativos", 1, true, [1, 3], [], [1, 3]),
  // ---- 2° Año ----
  m(7, "Programación Orientada a Objetos", 2, true, [4], [1], [4]),
  m(8, "Teoría de la Computación", 2, true, [5], [2], [5]),
  m(9, "Análisis Matemático I", 2, false, [5], [2], [5]),
  m(10, "Ingeniería de Sistemas", 2, true, [4], [1], [4]),
  m(11, "Estructura de Datos y Algoritmos", 2, true, [7, 8], [4], [7, 8]),
  m(12, "Programación Web", 2, true, [7], [4], [7]),
  m(13, "Análisis Matemático II", 2, true, [9], [5], [9]),
  m(14, "Inglés I", 2, true, [4], [3], [4]),
  // ---- 3° Año ----
  m(15, "Paradigmas de Lenguajes", 3, true, [8, 11, 12], [7], [8, 11, 12]),
  m(16, "Base de Datos I", 3, true, [6, 11], [5], [6, 11]),
  m(17, "Inglés II", 3, true, [14], [], [14]),
  m(18, "Ingeniería de Software I", 3, true, [7], [10], [7]),
  m(19, "Redes", 3, true, [8, 14], [6], [8, 14]),
  m(20, "Aspectos Profesionales y Sociales", 3, false, [16], [10], [16]),
  m(21, "Legislación Profesional", 3, false, [16], [10], [16]),
  m(22, "Probabilidad y Estadística", 3, false, [13], [9], [13]),
  m(23, "Algoritmos Numéricos", 3, false, [13], [9], [13]),
  // ---- 4° Año ----
  m(24, "Auditoría", 4, false, [18], [10], [18]),
  m(25, "Ingeniería de Software II", 4, false, [18], [7, 10, 12], [18]),
  m(26, "Computabilidad y Complejidad", 4, false, [23], [8, 11], [23]),
  m(27, "Teoría de la Información", 4, false, [22, 23], [11], [22, 23]),
  m(28, "Sistemas Distribuidos y Paralelismo", 4, false, [19], [11, 13], [19]),
  m(29, "Base de Datos II", 4, false, [23], [16], [23]),
  m(30, "Compiladores", 4, false, [26], [15], [26]),
  // ---- 5° Año ----
  m(31, "Inteligencia Artificial", 5, false, [29], [15, 23], [29]),
  m(32, "Ingeniería de Software III", 5, false, [25], [16, 17, 18], [25]),
  m(33, "Computación Gráfica y Visualización", 5, false, [22, 27], [12, 15], [22, 27]),
  m(34, "Electiva I", 5, false, [], [], [], { electiva: true }),
  m(35, "Epistemología y Metodología de la Investigación Científica", 5, false, [24], [20, 21, 22], [24]),
  m(36, "Lógica y Optimización Aplicadas", 5, false, [26], [15, 27], [26]),
  m(37, "Proyectos de Innovación Tecnológica", 5, false, [29], [20, 21], [29]),
  m(38, "Electiva II", 5, false, [], [], [], { electiva: true }),
  m(39, "Trabajo Fin de Carrera", 5, false, [], [], Array.from({ length: 38 }, (_, i) => i + 1), {
    requierePractica: true,
  }),
];

export const MATERIAS_BY_ID: Record<number, Materia> = Object.fromEntries(
  PLAN.map((mat) => [mat.id, mat])
);

export const TUP_IDS = PLAN.filter((mat) => mat.tup).map((mat) => mat.id);

/** Nota minima para aprobar un final / promocionar. */
export const NOTA_APROBACION = 4;
