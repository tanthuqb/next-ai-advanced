import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./styles/globals.css"; 

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Suzu AI - Hands-on Career Advisor",
  description: "RAG-powered career advisory system",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="light">
      <body className={`${inter.className} antialiased bg-slate-50`}>
        {/* Wrap children in a main tag for better layout alignment */}
        <main className="min-h-screen">
          {children}
        </main>
      </body>
    </html>
  );
}