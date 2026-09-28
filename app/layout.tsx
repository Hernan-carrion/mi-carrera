import type { Metadata, Viewport } from "next";
import "./globals.css";

const basePath = process.env.NEXT_BASE_PATH || "";

export const metadata: Metadata = {
  title: "Mi Carrera · Lic. en Cs. de la Computación",
  description:
    "Seguimiento de la Licenciatura en Ciencias de la Computación (UNSJ) y su título intermedio TUP, con correlatividades automáticas.",
  manifest: `${basePath}/manifest.json`,
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Mi Carrera",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#171717",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body className="bg-neutral-50 text-neutral-900 antialiased">
        {children}
      </body>
    </html>
  );
}
