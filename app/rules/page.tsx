import type { Metadata } from "next";
import RulesExperience from "@/components/rules/RulesExperience";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Cara Bermain — Classroom Conquest",
  description:
    "Panduan visual Classroom Conquest: persiapan sesi, papan nomor, alur menjawab, penilaian, timer, reset sesi, dan catatan anti-kecurangan.",
};

export default function RulesPage() {
  return <RulesExperience />;
}
