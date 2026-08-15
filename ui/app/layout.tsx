import "./globals.css";
import type { Metadata } from "next";
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
        <AuthProvider>
          <Header />
          {children}
          <ChatLupa />
        </AuthProvider>
      </body>
    </html>
  );
}
