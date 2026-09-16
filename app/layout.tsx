import type { Metadata, Viewport } from "next";
import "./globals.css";

const basePath = process.env.NEXT_BASE_PATH || "";

export const metadata: Metadata = {
  title: "Personal Tracker Dashboard",
  description:
    "Dashboard de productividad personal con la metodologia de Brian Tracy y un tracker de habitos circular en SVG.",
  manifest: `${basePath}/manifest.json`,
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Tracker",
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
