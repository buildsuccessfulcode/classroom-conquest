import type { Metadata } from "next";
import { Baloo_2, Nunito } from "next/font/google";
import RuntimeOptimizations from "@/components/RuntimeOptimizations";
import "./globals.css";

const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin"],
  weight: ["400", "600", "700", "800"],
});

const baloo = Baloo_2({
  variable: "--font-baloo",
  subsets: ["latin"],
  weight: ["700", "800"],
});

export const metadata: Metadata = {
  title: "Classroom Conquest",
  description:
    "Gamifikasi pembelajaran berbasis kelompok: kumpulkan XP, jaga streak, dan rebut puncak papan peringkat kelas.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="id"
      className={`${nunito.variable} ${baloo.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-snow text-ink">
        <RuntimeOptimizations />
        {children}
      </body>
    </html>
  );
}
