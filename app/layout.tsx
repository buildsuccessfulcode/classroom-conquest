import type { Metadata } from "next";
import { Baloo_2, Nunito } from "next/font/google";
import RuntimeOptimizations from "@/components/RuntimeOptimizations";
import { getSupabaseUrl, isSupabaseConfigured } from "@/lib/config";
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
  const supabaseUrl = isSupabaseConfigured() ? getSupabaseUrl() : null;
  return (
    <html
      lang="id"
      className={`${nunito.variable} ${baloo.variable} h-full antialiased`}
    >
      <head>
        {supabaseUrl ? (
          <>
            <link rel="preconnect" href={supabaseUrl} crossOrigin="anonymous" />
            <link rel="dns-prefetch" href={supabaseUrl} />
          </>
        ) : null}
      </head>
      <body className="min-h-full bg-snow text-ink">
        <RuntimeOptimizations />
        {children}
      </body>
    </html>
  );
}
