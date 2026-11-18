import { Inter } from "next/font/google";
import type { ReactNode } from "react";
import { Toaster } from "@/components/ui/toaster";
import { APP_NAME } from "@/lib/brand";
import "./globals.css";

/** Inter self-hosted pelo Next (doc 08 §2.4): pesos 400–700, sem requisição ao Google em runtime. */
const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata = { title: `Sistema ${APP_NAME}` };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR" className={inter.variable}>
      <body>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
