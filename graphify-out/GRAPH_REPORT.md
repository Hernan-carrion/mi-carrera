# Graph Report - TRACKER  (2026-09-29)

## Corpus Check
- 16 files · ~7,381 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 5 file(s) not represented in the graph (top: (none) 3, .css 1, .gs 1)

## Summary
- 128 nodes · 164 edges · 14 communities (9 shown, 5 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `d6267684`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- app/page.tsx
- package.json
- compilerOptions
- CarreraPage
- sync.ts
- manifest.json
- Mi Carrera
- devDependencies
- layout.tsx
- scripts
- next.config.js
- CLAUDE.md

## God Nodes (most connected - your core abstractions)
1. `compilerOptions` - 16 edges
2. `CarreraPage()` - 14 edges
3. `useSheetSync()` - 6 edges
4. `nombre()` - 6 edges
5. `Detalle()` - 6 edges
6. `Mi Carrera` - 6 edges
7. `useLocalStorage()` - 5 edges
8. `scripts` - 5 edges
9. `react` - 5 edges
10. `errorLegible()` - 4 edges

## Surprising Connections (you probably didn't know these)
- `CarreraPage()` --calls--> `useSheetSync()`  [EXTRACTED]
  app/page.tsx → app/lib/sync.ts
- `CarreraPage()` --calls--> `useLocalStorage()`  [EXTRACTED]
  app/page.tsx → app/lib/useLocalStorage.ts
- `SyncModal()` --calls--> `errorLegible()`  [EXTRACTED]
  app/page.tsx → app/lib/sync.ts
- `SyncModal()` --calls--> `probarConexion()`  [EXTRACTED]
  app/page.tsx → app/lib/sync.ts
- `useSheetSync()` --calls--> `useLocalStorage()`  [EXTRACTED]
  app/lib/sync.ts → app/lib/useLocalStorage.ts

## Import Cycles
- None detected.

## Communities (14 total, 5 thin omitted)

### Community 0 - "app/page.tsx"
Cohesion: 0.11
Nodes (20): Materia, MATERIAS_BY_ID, NOTA_APROBACION, PLAN, TUP_IDS, ANIOS, CarreraData, DEFAULT_STATE (+12 more)

### Community 1 - "package.json"
Cohesion: 0.11
Nodes (16): dependencies, next, react, react-dom, name, private, version, autoprefixer (+8 more)

### Community 2 - "compilerOptions"
Cohesion: 0.11
Nodes (18): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+10 more)

### Community 3 - "CarreraPage"
Cohesion: 0.29
Nodes (12): anioActual(), Bar(), calcular(), CarreraPage(), Chips(), Detalle(), etiqueta(), hoy() (+4 more)

### Community 4 - "sync.ts"
Cohesion: 0.29
Nodes (9): call(), errorLegible(), probarConexion(), SheetPayload, SyncConfig, SyncStatus, useSheetSync(), useLocalStorage() (+1 more)

### Community 5 - "manifest.json"
Cohesion: 0.20
Nodes (9): background_color, description, display, icons, name, scope, short_name, start_url (+1 more)

### Community 6 - "Mi Carrera"
Cohesion: 0.22
Nodes (8): Alternativa: Vercel, Funcionalidad, Mi Carrera, Notas tecnicas, Opcion recomendada: GitHub Pages (incluido en este repo), Publicar y usar desde el celular, Sincronizar con Google Sheets, Uso local

### Community 7 - "devDependencies"
Cohesion: 0.29
Nodes (7): devDependencies, autoprefixer, postcss, tailwindcss, @types/node, @types/react, typescript

### Community 9 - "scripts"
Cohesion: 0.40
Nodes (5): scripts, build, dev, lint, start

## Knowledge Gaps
- **75 isolated node(s):** `metadata`, `viewport`, `SheetPayload`, `Estado`, `Via` (+70 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 85 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **5 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `react` connect `package.json` to `app/page.tsx`, `sync.ts`?**
  _High betweenness centrality (0.205) - this node is a cross-community bridge._
- **Why does `devDependencies` connect `devDependencies` to `package.json`?**
  _High betweenness centrality (0.058) - this node is a cross-community bridge._
- **Why does `next` connect `package.json` to `layout.tsx`?**
  _High betweenness centrality (0.051) - this node is a cross-community bridge._
- **What connects `metadata`, `viewport`, `SheetPayload` to the rest of the system?**
  _75 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `app/page.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.1067193675889328 - nodes in this community are weakly interconnected._
- **Should `package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.1111111111111111 - nodes in this community are weakly interconnected._
- **Should `compilerOptions` be split into smaller, more focused modules?**
  _Cohesion score 0.10526315789473684 - nodes in this community are weakly interconnected._