import type { ReactNode } from 'react';
import './globals.css';

export const metadata = {
  title: 'Receptionist Portal',
  description: 'Next.js frontend for the receptionist and doctor portal',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}