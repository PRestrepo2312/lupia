import "./globals.css";
import type { Metadata } from "next";
import Script from "next/script";
import { AuthProvider } from "@/components/AuthProvider";
import { Header } from "@/components/Header";
import { ChatLupa } from "@/components/ChatLupa";

export const metadata: Metadata = {
  title: "LupIA · Monitor de contratación pública",
  description: "La lupa ciudadana sobre la plata pública. Datos de SECOP II.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>
        <Script
          defer
          src="https://stats.resia.cloud/script.js"
          data-website-id="852cbca3-3959-49ab-bc7c-1610c9b8cc90"
          strategy="afterInteractive"
        />
        <AuthProvider>
          <Header />
          {children}
          <ChatLupa />
        </AuthProvider>
      </body>
    </html>
  );
}
