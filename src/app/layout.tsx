import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "MikroTik Monitor — Panel de Monitoreo",
  description:
    "Panel de monitoreo en tiempo real para dispositivos MikroTik RouterOS v6. CPU, memoria, tráfico, BGP/OSPF y firewall.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        style={{ backgroundColor: "#0b0c0e", color: "#d8d9da" }}
      >
        {children}
      </body>
    </html>
  );
}
