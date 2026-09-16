/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Sitio 100% cliente (sin API routes ni datos server-side), asi que se
  // exporta como HTML/CSS/JS estatico: se puede alojar gratis en GitHub
  // Pages u otro hosting estatico, sin necesidad de un servidor Node.
  output: "export",
  images: { unoptimized: true },
  // En GitHub Pages (sitio de proyecto) la app vive en /<nombre-del-repo>/.
  // El workflow de deploy setea esta variable de entorno al buildear;
  // en local o en Vercel queda vacia y la app corre en la raiz.
  basePath: process.env.NEXT_BASE_PATH || "",
};

module.exports = nextConfig;
