import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'SeedForge — Synthetic Data & Staging Engine for PostgreSQL',
  description:
    'Generador determinístico de datos sintéticos con ordenamiento topológico e integridad referencial (Foreign Keys) para PostgreSQL.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className="dark">
      <body className="min-h-screen bg-[#09090b] text-zinc-100 antialiased selection:bg-emerald-500/30 selection:text-emerald-200">
        {children}
      </body>
    </html>
  );
}
