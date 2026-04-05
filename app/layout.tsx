import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./styles/globals.css"; 

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Suzu AI - Cố vấn thực chiến",
  description: "Hệ thống RAG tư vấn nghề nghiệp",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="light">
      <body className={`${inter.className} antialiased bg-slate-50`}>
        {/* Bao bọc bởi một thẻ main để căn chỉnh layout tốt hơn */}
        <main className="min-h-screen">
          {children}
        </main>
      </body>
    </html>
  );
}