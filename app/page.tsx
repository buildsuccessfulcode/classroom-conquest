import Image from "next/image";
import Link from "next/link";
import Mascot from "@/components/Mascot";
import ModeBadge from "@/components/ModeBadge";
import {
  ArrowRightIcon,
  BoltIcon,
  FlameIcon,
  PlayIcon,
  StarIcon,
  TargetIcon,
  TrophyIcon,
} from "@/components/icons";

export const dynamic = "force-static";

const ROLES = [
  {
    href: "/teacher",
    title: "Dashboard Guru",
    description:
      "Buat sesi, impor bank soal, lalu pantau XP dan jalannya permainan.",
    icon: TargetIcon,
    tone: "bg-ocean-soft text-ocean-dark",
  },
  {
    href: "/play",
    title: "Main Murid",
    description:
      "Gabung dengan kode sesi, kumpulkan XP, jaga streak, dan raih badge.",
    icon: PlayIcon,
    tone: "bg-brand-soft text-brand-dark",
  },
  {
    href: "/display",
    title: "Papan Proyektor",
    description:
      "Tampilkan papan nomor, peringkat kelas, dan log aktivitas realtime.",
    icon: TrophyIcon,
    tone: "bg-grape-soft text-grape-dark",
  },
];

const FEATURES = [
  { icon: BoltIcon, label: "XP tiap jawaban", tone: "text-grape" },
  { icon: FlameIcon, label: "Streak beruntun", tone: "text-mango" },
  { icon: StarIcon, label: "Koleksi badge", tone: "text-sun-dark" },
  { icon: TrophyIcon, label: "Peringkat kelas", tone: "text-ocean" },
  { icon: TargetIcon, label: "Mode Ular Tangga", tone: "text-brand" },
];

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-10 px-5 py-10">
      <header className="flex items-center justify-between gap-4">
        <span className="flex items-center gap-2">
          <Image
            src="/logo-square.png"
            alt=""
            width={36}
            height={36}
            priority
            className="h-9 w-9"
          />
          <span className="cc-display text-lg font-extrabold text-brand-dark">
            Classroom Conquest
          </span>
        </span>
        <ModeBadge />
      </header>

      <section className="cc-card flex flex-col items-center gap-6 overflow-hidden p-6 sm:flex-row sm:p-8">
        <div className="flex-1">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-soft px-3 py-1 text-xs font-extrabold text-brand-dark">
            <BoltIcon className="h-3.5 w-3.5" />
            Belajar sambil bertarung
          </span>
          <h1 className="cc-display mt-3 text-4xl font-extrabold leading-tight text-ink sm:text-5xl">
            Ubah kelas jadi arena yang seru.
          </h1>
          <p className="mt-3 max-w-xl text-lg font-semibold text-ink-soft">
            Setiap tim menjawab nomor soal secara mandiri, mengumpulkan XP,
            menjaga streak, dan berebut puncak papan peringkat kelas. Guru juga
            bisa memilih mode Ular Tangga untuk balapan bidak menuju finis.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              href="/play"
              className="cc-btn border-brand-dark bg-brand px-5 py-3 text-white"
            >
              Mulai Main
              <ArrowRightIcon className="h-5 w-5" />
            </Link>
            <Link
              href="/teacher"
              className="cc-btn border-ocean-dark bg-ocean px-5 py-3 text-white"
            >
              Saya Guru
            </Link>
          </div>
          <ul className="mt-6 flex flex-wrap gap-x-5 gap-y-2">
            {FEATURES.map((feature) => (
              <li
                key={feature.label}
                className="flex items-center gap-2 text-sm font-extrabold text-ink"
              >
                <feature.icon className={`h-5 w-5 ${feature.tone}`} />
                {feature.label}
              </li>
            ))}
          </ul>
        </div>
        <div className="shrink-0">
          <Mascot mood="happy" size={190} float />
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        {ROLES.map((role) => (
          <Link
            key={role.href}
            href={role.href}
            className="cc-card group flex flex-col gap-3 p-6 transition hover:-translate-y-1"
          >
            <span
              className={`flex h-12 w-12 items-center justify-center rounded-2xl ${role.tone}`}
            >
              <role.icon className="h-6 w-6" />
            </span>
            <h2 className="cc-display text-xl font-extrabold text-ink">
              {role.title}
            </h2>
            <p className="text-sm font-semibold text-ink-soft">
              {role.description}
            </p>
            <span className="mt-auto flex items-center gap-1 text-sm font-extrabold text-ocean-dark">
              Buka halaman
              <ArrowRightIcon className="h-4 w-4 transition group-hover:translate-x-1" />
            </span>
          </Link>
        ))}
      </section>

      <section className="cc-card p-6">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="cc-display text-xl font-extrabold text-ink">
            Cara Bermain Singkat
          </h2>
          <Link
            href="/rules"
            className="flex items-center gap-1 text-sm font-extrabold text-ocean-dark"
          >
            Aturan lengkap
            <ArrowRightIcon className="h-4 w-4" />
          </Link>
        </div>
        <ol className="flex flex-col gap-2 text-sm font-semibold text-ink-soft">
          {[
            "Guru membuat sesi (Klasik atau Ular Tangga) dan membagikan kode 6 karakter.",
            "Proyektor membuka papan dan memasukkan kode sesi.",
            "Setiap kelompok bergabung dari perangkat masing-masing.",
            "Pilih nomor soal mana saja; jawaban salah tidak mengurangi poin.",
            "Klasik: poin terbanyak juara. Ular Tangga: tim pertama mencapai finis menang.",
          ].map((step, index) => (
            <li key={step} className="flex items-start gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-soft text-xs font-extrabold text-brand-dark">
                {index + 1}
              </span>
              <span className="pt-0.5">{step}</span>
            </li>
          ))}
        </ol>
      </section>
    </main>
  );
}
