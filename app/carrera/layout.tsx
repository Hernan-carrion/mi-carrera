import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Mi Carrera · Lic. en Cs. de la Computación",
  description:
    "Seguimiento de la Licenciatura en Ciencias de la Computación (UNSJ) y su título intermedio TUP, con correlatividades automáticas.",
};

export default function CarreraLayout({ children }: { children: React.ReactNode }) {
  return children;
}
