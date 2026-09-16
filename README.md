# Personal Tracker Dashboard

Agenda personal minimalista (Next.js + React + Tailwind CSS) que combina la
metodologia de productividad de Brian Tracy con un tracker de habitos
circular dibujado en SVG puro. Pensada para usarse como sitio web desde el
celular, sin backend: todos los datos se guardan en el `localStorage` del
navegador donde se abre.

## Funcionalidad

- **Gestor ABCDE / Eat That Frog**: prioriza tareas de A a E; la tarea A1
  se destaca arriba de todo como "Sapo del Dia".
- **Regla del 10/90**: boton "Cierre de Dia" que abre un modal y obliga a
  planificar (minimo 3 tareas, con al menos una A) antes de cerrar.
- **La Ley del Tres**: panel para fijar los 3 macro-objetivos del momento.
- **Tracy Bot**: rota automaticamente 4 consejos diarios.
- **Tracker de habitos circular**: semicirculo concentrico en SVG, un
  anillo por habito y 31 columnas angulares (dias del mes), calculado con
  trigonometria (`Math.sin`/`Math.cos`). Cada mes arranca con su propia
  grilla en blanco.
- **Notas** con fondo de grilla sutil.

Todo el estado (tareas, objetivos, marcas del tracker, notas) persiste en
`localStorage`, asi que sobrevive a cerrar la pestana o el navegador. Es
por-dispositivo: no se sincroniza entre el celular y la compu.

## Uso local

```bash
npm install
npm run dev
```

Abrir `http://localhost:3000`.

## Publicar y usar desde el celular

El proyecto esta configurado como export estatico (`output: "export"` en
`next.config.js`), asi que no necesita un servidor Node corriendo: se puede
alojar gratis como sitio estatico.

### Opcion recomendada: GitHub Pages (incluido en este repo)

1. Subir el repo a GitHub (rama `main`).
2. En el repo: **Settings → Pages → Source → GitHub Actions**.
3. Cada push a `main` dispara `.github/workflows/deploy.yml`, que buildea
   el sitio y lo publica en `https://<usuario>.github.io/<repo>/`.
4. Abrir esa URL desde el celular y, si el navegador lo permite, usar
   "Agregar a pantalla de inicio" para tenerlo como si fuera una app.

### Alternativa: Vercel

Importar el repo en [vercel.com](https://vercel.com) (deploy automatico en
cada push, sin configuracion extra). En ese caso no hace falta la variable
`NEXT_BASE_PATH` (queda vacia y el sitio corre en la raiz del dominio).

## Notas tecnicas

- Los iconos (`app/icon.svg`, `public/icon.svg`) son un placeholder simple
  en blanco y negro. Se pueden reemplazar por PNGs propios (192x192 y
  512x512) referenciandolos en `public/manifest.json` si se quiere un
  icono mas prolijo al instalar la PWA.
- `npm audit` puede marcar 1-2 vulnerabilidades menores en una dependencia
  interna de PostCSS empaquetada dentro de Next.js; solo afectan al build
  local, no al sitio publicado.
