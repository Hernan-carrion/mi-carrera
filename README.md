# Mi Carrera

Seguimiento de la **Licenciatura en Ciencias de la Computacion** (UNSJ,
plan Ord. 10/2022) y su titulo intermedio, la **Tecnicatura Universitaria
en Programacion (TUP)**. Sitio estatico (Next.js + React + Tailwind CSS)
pensado para usarse desde el celular, publicado en GitHub Pages.

## Funcionalidad

- **Correlatividades automaticas** segun la Res. 109/2022-CD-FCEFN
  (`app/lib/plan.ts`): las materias se habilitan o bloquean solas.
  Regularizar alcanza para cursar las correlativas debiles, y el final
  solo se habilita con las correlativas para rendir aprobadas.
- **Estados**: cursando → regular / promocional / libre / recursar. Una
  materia a recursar queda bloqueada hasta el ciclo lectivo siguiente.
- **Notas** de cursada y finales (con historial de aplazos), promedio con
  y sin aplazos.
- **Progreso**: % de TUP (prioridad, con la Practica Socio-Educativa) y %
  de Licenciatura. Las materias de la TUP se destacan en otro color.
- **Datos**: se guardan en el `localStorage` del navegador, con backup
  exportable a JSON y sincronizacion opcional con Google Sheets.

## Sincronizar con Google Sheets

Para no depender del `localStorage` (y tener los mismos datos en el
celular y la compu), los datos pueden guardarse en un Google
Sheet propio a traves de un Apps Script:

1. Crear un Google Sheet nuevo → **Extensiones → Apps Script**.
2. Pegar el contenido de [`apps-script/Code.gs`](apps-script/Code.gs) y
   cambiar `TOKEN` por una clave propia. Guardar.
3. **Implementar → Nueva implementacion → Aplicacion web**, con
   *Ejecutar como: Yo* y *Quien tiene acceso: Cualquier usuario*.
   Autorizar los permisos que pide Google.
4. Copiar la URL de la aplicacion web (termina en `/exec`).
5. En la pagina, **Conectar Google Sheets** → pegar la URL y la clave.
   Repetir en cada dispositivo.

La pagina guarda cada cambio en la hoja (a los ~1.5 s) y al abrirse, o al
volver a la pestana, trae la version mas nueva. Si no hay conexion sigue
funcionando con la copia local y sube los cambios despues. La hoja
`Materias` tiene una fila por materia, `Resumen` los porcentajes y
promedios, y `_raw` (oculta) el estado completo que lee la pagina.

La URL y la clave se guardan solo en el navegador, nunca en el repo. Si
se cambia el codigo del script hay que crear una **nueva version** de la
implementacion (Implementar → Gestionar implementaciones) para que tome
efecto.

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
