import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Steffen ERP',
  description: 'Sistema de gestión integral para Steffen Cosmética Capilar: stock, formulaciones, compras, pedidos, remitos y finanzas.',
  openGraph: {
    title: 'Steffen ERP',
    description: 'Sistema de gestión integral para Steffen Cosmética Capilar: stock, formulaciones, compras, pedidos, remitos y finanzas.',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased selection:bg-sky-500 selection:text-white">
        {children}
      </body>
    </html>
  );
}
