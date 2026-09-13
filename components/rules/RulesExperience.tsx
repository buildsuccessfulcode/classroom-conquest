"use client";

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Mascot from "@/components/Mascot";
import ModeBadge from "@/components/ModeBadge";
import {
  ArrowLeftIcon,
  BoltIcon,
  CheckIcon,
  ChevronDownIcon,
  ClockIcon,
  HelpIcon,
  LightbulbIcon,
  LockIcon,
  RocketIcon,
  SparkleIcon,
  TargetIcon,
  UsersIcon,
  XIcon,
} from "@/components/icons";
import RuleIcon, { type RuleIconName } from "./RuleIcons";

type ToneKey = "brand" | "ocean" | "grape" | "mango" | "sun" | "cherry";

const TONES: Record<ToneKey, { chip: string; bar: string; solid: string }> = {
  brand: { chip: "bg-brand-soft text-brand-dark", bar: "bg-brand", solid: "bg-brand" },
  ocean: { chip: "bg-ocean-soft text-ocean-dark", bar: "bg-ocean", solid: "bg-ocean" },
  grape: { chip: "bg-grape-soft text-grape-dark", bar: "bg-grape", solid: "bg-grape" },
  mango: { chip: "bg-mango-soft text-mango-dark", bar: "bg-mango", solid: "bg-mango" },
  sun: { chip: "bg-sun-soft text-sun-dark", bar: "bg-sun", solid: "bg-sun" },
  cherry: { chip: "bg-cherry-soft text-cherry-dark", bar: "bg-cherry", solid: "bg-cherry" },
};

function useReveal<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setShown(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1, rootMargin: "0px 0px -40px 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return { ref, shown };
}

function Reveal({ delay = 0, children }: { delay?: number; children: ReactNode }) {
  const { ref, shown } = useReveal<HTMLDivElement>();
  return (
    <div
      ref={ref}
      style={{ transitionDelay: `${shown ? delay : 0}ms` }}
      className={`cc-reveal transition-all duration-500 ease-out ${
        shown ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"
      }`}
    >
      {children}
    </div>
  );
}

function Hi({ children }: { children: ReactNode }) {
  return <strong className="font-extrabold text-ink">{children}</strong>;
}

function StepList({ items }: { items: ReactNode[] }) {
  return (
    <ol className="flex flex-col gap-2.5">
      {items.map((item, index) => (
        <li
          key={index}
          className="flex items-start gap-3 text-sm font-semibold leading-relaxed text-ink-soft"
        >
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-snow text-xs font-extrabold text-ink">
            {index + 1}
          </span>
          <span className="pt-0.5">{item}</span>
        </li>
      ))}
    </ol>
  );
}

function BulletList({ items }: { items: ReactNode[] }) {
  return (
    <ul className="flex flex-col gap-2.5">
      {items.map((item, index) => (
        <li
          key={index}
          className="flex items-start gap-2.5 text-sm font-semibold leading-relaxed text-ink-soft"
        >
          <CheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-brand-dark" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

interface Rule {
  id: string;
  index: number;
  title: string;
  summary: string;
  tone: ToneKey;
  icon: RuleIconName;
  detail: ReactNode;
}

const RULES: Rule[] = [
  {
    id: "persiapan",
    index: 1,
    title: "Persiapan",
    summary: "Guru menyiapkan sesi, tim bergabung saat fase Lobby.",
    tone: "ocean",
    icon: "flag",
    detail: (
      <StepList
        items={[
          <>
            Guru membuka <Hi>/teacher</Hi>, membuat sesi dengan memilih group bank
            soal dan durasi (5–120 menit). Sistem membuat kode sesi 6 karakter.
          </>,
          <>
            Guru memastikan bank soal untuk group tersebut tersedia (impor JSON
            bila perlu).
          </>,
          <>
            Proyektor membuka <Hi>/display</Hi> dan memasukkan kode sesi.
          </>,
          <>
            Setiap kelompok membuka <Hi>/play</Hi>, memasukkan kode sesi dan nama
            tim. Sistem memberi warna unik. Jumlah tim tidak dibatasi. Bergabung
            hanya bisa saat sesi berstatus <Hi>Lobby</Hi>, yaitu sebelum guru
            menekan Mulai.
          </>,
          <>
            Guru menekan <Hi>Mulai</Hi>. Sistem menyusun snapshot bank soal group
            menjadi nomor <Hi>1..N</Hi> (N = jumlah seluruh soal group saat itu).
          </>,
        ]}
      />
    ),
  },
  {
    id: "papan",
    index: 2,
    title: "Papan Nomor",
    summary: "Papan menampilkan angka 1–N; satu angka satu soal.",
    tone: "grape",
    icon: "grid",
    detail: (
      <BulletList
        items={[
          <>
            Papan menampilkan angka <Hi>1 sampai N</Hi>; tiap angka mewakili satu
            soal.
          </>,
          <>Semua tim melihat nomor yang sama.</>,
          <>
            Di <Hi>/display</Hi>, tiap nomor menampilkan titik warna tim yang sudah
            menjawab benar beserta jumlahnya.
          </>,
          <>
            Di <Hi>/play</Hi>, nomor yang sudah dijawab benar ditandai warna tim
            dan centang, lalu bisa dibuka lagi untuk review (read-only) beserta
            kunci jawabannya.
          </>,
          <>
            Nomor soal yang sedang dibuka disimpan di URL (<Hi>/play?slot=N</Hi>),
            sehingga reload halaman tidak menutup popup dan nomor otomatis terbuka
            lagi.
          </>,
        ]}
      />
    ),
  },
  {
    id: "alur",
    index: 3,
    title: "Alur Menjawab",
    summary: "Pilih nomor bebas; salah tanpa penalti, maksimal 3 percobaan.",
    tone: "brand",
    icon: "path",
    detail: (
      <StepList
        items={[
          <>
            Tim bebas memilih nomor mana saja yang tersedia, tidak harus
            berurutan.
          </>,
          <>
            Soal muncul sesuai tipe. Urutan opsi pilihan ganda dan kata acak
            diacak di server setiap kali soal diminta, jadi tidak sama antar tim.
          </>,
          <>
            Jika <Hi>benar</Hi>: tercatat sekali per nomor per tim, poin
            ditambahkan, dan nomor tetap terbuka untuk tim lain (bukan rebutan).
            Kunci jawaban hanya ditampilkan ke tim yang sudah menjawab benar.
          </>,
          <>
            Jika <Hi>salah</Hi>: tidak ada penalti dan nomor tetap bisa dicoba
            lagi. Log mencatat percobaan gagal beserta nomornya.
          </>,
          <>
            Tiap nomor maksimal <Hi>3 kali percobaan</Hi> per tim. Setelah batas
            tercapai, nomor terkunci untuk tim tersebut dan permintaan soal serta
            jawaban ditolak di server.
          </>,
          <>Tim boleh melanjutkan ke nomor lain kapan saja.</>,
        ]}
      />
    ),
  },
  {
    id: "tipe",
    index: 4,
    title: "Tipe Soal",
    summary: "Pilihan ganda, isian singkat/kode, atau susun kata.",
    tone: "mango",
    icon: "cards",
    detail: (
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-2">
          {[
            { label: "Pilihan Ganda", text: "Pilih salah satu tombol opsi." },
            {
              label: "Isian Singkat",
              text: "Tulis jawaban singkat atau potongan kode. Pencocokan tidak membedakan huruf besar/kecil dan spasi tepi.",
            },
            {
              label: "Susun Kata",
              text: "Susun kata acak menjadi jawaban yang benar.",
            },
          ].map((type) => (
            <div
              key={type.label}
              className="flex items-start gap-3 rounded-2xl border-2 border-cloud bg-snow p-3"
            >
              <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-mango-soft text-mango-dark">
                <BoltIcon className="h-4 w-4" />
              </span>
              <span className="text-sm font-semibold leading-relaxed text-ink-soft">
                <Hi>{type.label}</Hi> — {type.text}
              </span>
            </div>
          ))}
        </div>
        <p className="text-xs font-semibold text-ink-soft">
          Normalisasi jawaban: huruf kecil, rapikan spasi ganda, buang tanda baca
          tepi.
        </p>
      </div>
    ),
  },
  {
    id: "penilaian",
    index: 5,
    title: "Penilaian & Peringkat",
    summary: "Poin terbanyak juara; seri ditentukan waktu jawaban.",
    tone: "sun",
    icon: "podium",
    detail: (
      <div className="flex flex-col gap-3">
        <p className="text-sm font-semibold text-ink-soft">
          Poin adalah akumulasi poin soal yang dijawab benar.
        </p>
        <div className="flex flex-wrap gap-2">
          <span className="rounded-full bg-brand-soft px-3 py-1 text-xs font-extrabold text-brand-dark">
            EASY 100
          </span>
          <span className="rounded-full bg-ocean-soft px-3 py-1 text-xs font-extrabold text-ocean-dark">
            MEDIUM 150
          </span>
          <span className="rounded-full bg-grape-soft px-3 py-1 text-xs font-extrabold text-grape-dark">
            HARD 200
          </span>
        </div>
        <StepList
          items={[
            <>Poin terbanyak.</>,
            <>
              Jika poin sama, waktu jawaban benar terakhir yang paling awal
              unggul.
            </>,
            <>Jika masih sama, nama tim urut A–Z.</>,
          ]}
        />
      </div>
    ),
  },
  {
    id: "timer",
    index: 6,
    title: "Timer",
    summary: "Durasi 5–120 menit, dihitung sejak guru menekan Mulai.",
    tone: "cherry",
    icon: "clock",
    detail: (
      <BulletList
        items={[
          <>Durasi diatur guru antara 5 sampai 120 menit.</>,
          <>
            Timer dihitung dari <Hi>started_at + duration_minutes</Hi>, lalu
            ditampilkan di papan proyektor dan perangkat tim.
          </>,
          <>
            Setelah waktu habis, permintaan soal dan jawaban baru ditolak di
            server.
          </>,
          <>Guru juga bisa menghentikan permainan lebih awal dengan Akhiri.</>,
        ]}
      />
    ),
  },
  {
    id: "reset",
    index: 7,
    title: "Reset & Akhir Sesi",
    summary: "Reset mengosongkan peserta; Akhiri menampilkan juara.",
    tone: "ocean",
    icon: "cycle",
    detail: (
      <BulletList
        items={[
          <>
            <Hi>Reset</Hi> menghapus semua jawaban, log, dan tim (peserta
            dikeluarkan), status kembali ke Lobby, lalu timer berhenti. Susunan
            nomor soal tetap sama. Guru harus menekan Mulai lagi dan murid
            bergabung ulang.
          </>,
          <>
            <Hi>Akhiri</Hi> menghentikan permainan dan menampilkan pemenang;
            papan menjadi read-only.
          </>,
          <>
            <Hi>Hapus</Hi> menghapus sesi beserta tim, nomor soal, jawaban, dan
            log.
          </>,
        ]}
      />
    ),
  },
  {
    id: "anti",
    index: 8,
    title: "Anti-Kecurangan",
    summary: "Batas percobaan, acak soal, dan peringatan untuk guru.",
    tone: "grape",
    icon: "shield",
    detail: (
      <BulletList
        items={[
          <>
            Tiap nomor dibatasi 3 percobaan lalu terkunci, sehingga menebak
            berulang tidak efektif.
          </>,
          <>
            Urutan opsi dan kata diacak per tim agar jawaban sulit disalin antar
            tim.
          </>,
          <>
            Deteksi anomali: jawaban benar setelah hampir mencapai batas
            percobaan, atau jawaban benar beruntun dalam waktu sangat singkat,
            dicatat sebagai log ERROR yang tampil merah di panel Aktivitas guru.
          </>,
          <>
            Rate limit permintaan per tim; kelebihan ditolak dengan pesan
            &ldquo;Terlalu banyak permintaan. Tunggu sebentar.&rdquo;
          </>,
          <>
            Deteksi meninggalkan tab: saat sesi Playing, klien memantau
            visibilitychange, blur, focus, dan pagehide. Begitu tim meninggalkan
            tab, server mencatat log ERROR realtime. Bila kembali setelah ≥ 10
            detik, dicatat log tambahan berisi durasi. Laporan dibatasi maksimal
            satu per 10 detik per tim, tanpa penalti otomatis.
          </>,
          <>
            Batas ini tidak mencegah siswa membuka aplikasi lain dan tidak dapat
            mendeteksi perangkat kedua, jadi pengawasan kelas tetap diperlukan.
          </>,
        ]}
      />
    ),
  },
];

const SCORE_TRAIL: {
  label: string;
  level: string;
  delta: string;
  total: number;
  tone: ToneKey;
}[] = [
  { label: "Benar nomor 1", level: "EASY", delta: "+100", total: 100, tone: "brand" },
  { label: "Benar nomor 2", level: "MEDIUM", delta: "+150", total: 250, tone: "ocean" },
  { label: "Salah nomor 3", level: "TIDAK ADA PENALTI", delta: "+0", total: 250, tone: "cherry" },
  { label: "Benar nomor 4", level: "HARD", delta: "+200", total: 450, tone: "grape" },
];

const TIPS = [
  {
    icon: LightbulbIcon,
    tone: "bg-sun-soft text-sun-dark",
    text: "Baca soal sampai selesai. Salah tidak mengurangi poin, tapi percobaanmu terbatas.",
  },
  {
    icon: TargetIcon,
    tone: "bg-ocean-soft text-ocean-dark",
    text: "Kerjakan nomor yang paling kamu kuasai lebih dulu. Nomor boleh dipilih bebas.",
  },
  {
    icon: UsersIcon,
    tone: "bg-grape-soft text-grape-dark",
    text: "Bagi tugas dalam tim dan catat nomor yang sudah benar supaya tidak mengulang.",
  },
];

function RuleCard({
  rule,
  open,
  onToggle,
}: {
  rule: Rule;
  open: boolean;
  onToggle: () => void;
}) {
  const tone = TONES[rule.tone];
  return (
    <article className="cc-card cc-lift relative overflow-hidden">
      <span className={`absolute inset-y-0 left-0 w-2 ${tone.bar}`} aria-hidden />
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={`rule-body-${rule.id}`}
        className="flex w-full items-center gap-3 p-4 pl-5 text-left sm:gap-4 sm:p-5 sm:pl-6"
      >
        <span
          className={`relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ${tone.chip}`}
        >
          <RuleIcon name={rule.icon} className="h-9 w-9" aria-hidden />
          <span
            className={`absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full border-2 border-white text-xs font-extrabold text-white ${tone.solid}`}
          >
            {rule.index}
          </span>
        </span>
        <span className="min-w-0 flex-1">
          <span className="cc-display block text-lg font-extrabold leading-tight text-ink">
            {rule.title}
          </span>
          <span className="mt-0.5 block text-sm font-semibold leading-snug text-ink-soft">
            {rule.summary}
          </span>
        </span>
        <span
          className={`flex shrink-0 items-center gap-1 rounded-full px-3 py-2 text-xs font-extrabold ${tone.chip}`}
        >
          <span className="hidden sm:inline">Detail</span>
          <ChevronDownIcon
            className={`h-4 w-4 transition-transform duration-300 ${
              open ? "rotate-180" : ""
            }`}
          />
        </span>
      </button>
      <div
        id={`rule-body-${rule.id}`}
        className={`grid transition-all duration-300 ease-out ${
          open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        }`}
      >
        <div className="overflow-hidden">
          <div className="px-4 pb-5 pl-5 sm:px-5 sm:pl-6">{rule.detail}</div>
        </div>
      </div>
    </article>
  );
}

function HeroArt() {
  return (
    <div className="relative h-48 w-60 shrink-0">
      <Mascot
        mood="happy"
        size={172}
        float
        className="absolute bottom-0 left-1/2 -translate-x-1/2"
      />
      <div className="cc-card cc-bob absolute left-0 top-3 rounded-2xl px-3 py-2">
        <p className="text-[10px] font-extrabold uppercase tracking-wide text-ink-soft">
          Poin
        </p>
        <p className="cc-display text-xl font-extrabold text-brand-dark">+150</p>
      </div>
      <div className="cc-card cc-float absolute right-0 top-10 flex items-center gap-2 rounded-2xl px-3 py-2">
        <ClockIcon className="h-4 w-4 text-cherry" />
        <p className="cc-display text-sm font-extrabold text-ink">30:00</p>
      </div>
    </div>
  );
}

function Examples() {
  return (
    <div className="grid min-w-0 gap-4 md:grid-cols-2">
      <div className="cc-card min-w-0 p-5 md:col-span-2">
        <h3 className="cc-display text-lg font-extrabold text-ink">
          Contoh perhitungan poin
        </h3>
        <ol className="mt-4 flex flex-col gap-3">
          {SCORE_TRAIL.map((step, index) => {
            const tone = TONES[step.tone];
            return (
              <li key={step.label} className="flex min-w-0 items-center gap-3">
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-extrabold text-white ${tone.solid}`}
                >
                  {index + 1}
                </span>
                <div className="flex min-w-0 flex-1 items-center justify-between gap-2 rounded-2xl border-2 border-cloud bg-snow px-3 py-2">
                  <div className="min-w-0">
                    <p className="text-[10px] font-extrabold uppercase tracking-wide text-ink-soft">
                      {step.level}
                    </p>
                    <p className="truncate text-sm font-extrabold text-ink">
                      {step.label}
                    </p>
                  </div>
                  <span className="shrink-0 text-sm font-extrabold text-ink-soft">
                    {step.delta}
                  </span>
                  <span className="cc-display w-12 shrink-0 text-right text-xl font-extrabold text-ink">
                    {step.total}
                  </span>
                </div>
              </li>
            );
          })}
        </ol>
        <p className="mt-4 rounded-2xl bg-ocean-soft px-3 py-2 text-xs font-bold text-ocean-dark">
          Jika dua tim punya total sama, tim yang jawaban benar terakhirnya lebih
          awal yang unggul.
        </p>
      </div>

      <div className="cc-card min-w-0 p-5">
        <h3 className="cc-display text-lg font-extrabold text-ink">
          3 percobaan per nomor
        </h3>
        <div className="mt-5 flex items-center justify-center gap-3">
          {[1, 2, 3].map((attempt) => (
            <div key={attempt} className="flex flex-col items-center gap-2">
              <span
                className={`flex h-14 w-14 items-center justify-center rounded-2xl border-2 ${
                  attempt < 3
                    ? "border-cherry bg-cherry-soft text-cherry-dark"
                    : "border-cloud bg-snow text-ink-soft"
                }`}
              >
                {attempt < 3 ? (
                  <XIcon className="h-6 w-6" />
                ) : (
                  <LockIcon className="h-6 w-6" />
                )}
              </span>
              <span className="text-[11px] font-extrabold text-ink-soft">
                Coba {attempt}
              </span>
            </div>
          ))}
        </div>
        <p className="mt-4 text-xs font-semibold text-ink-soft">
          Setelah percobaan ketiga, nomor terkunci untuk tim itu.
        </p>
      </div>

      <div className="cc-card min-w-0 p-5">
        <h3 className="cc-display text-lg font-extrabold text-ink">
          Timer & penentu seri
        </h3>
        <div className="mt-4 flex items-center gap-4">
          <span className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full border-4 border-cherry bg-cherry-soft">
            <span className="text-center">
              <span className="cc-display block text-lg font-extrabold text-cherry-dark">
                5–120
              </span>
              <span className="block text-[10px] font-extrabold uppercase text-cherry-dark">
                menit
              </span>
            </span>
          </span>
          <p className="text-sm font-semibold leading-relaxed text-ink-soft">
            Waktu berjalan sejak guru menekan <Hi>Mulai</Hi>. Setelah habis,
            jawaban baru ditolak.
          </p>
        </div>
        <div className="mt-4 flex flex-col gap-2">
          <div className="flex items-center gap-2 rounded-2xl bg-snow px-3 py-2 text-sm font-bold text-ink">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-sun text-xs font-extrabold text-white">
              1
            </span>
            Poin terbanyak menang
          </div>
          <div className="flex items-center gap-2 rounded-2xl bg-snow px-3 py-2 text-sm font-bold text-ink">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-ocean text-xs font-extrabold text-white">
              2
            </span>
            Seri? Jawaban benar terakhir lebih awal
          </div>
        </div>
      </div>
    </div>
  );
}

function StickyCta({
  ready,
  onReadyChange,
  onStart,
}: {
  ready: boolean;
  onReadyChange: (value: boolean) => void;
  onStart: () => void;
}) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t-2 border-cloud bg-snow/95 backdrop-blur">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-2 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
        <label className="flex min-h-11 cursor-pointer select-none items-center gap-3 text-sm font-bold text-ink">
          <input
            type="checkbox"
            checked={ready}
            onChange={(event) => onReadyChange(event.target.checked)}
            className="peer sr-only"
          />
          <span
            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border-2 transition ${
              ready
                ? "cc-bounce-in border-brand-dark bg-brand text-white"
                : "border-cloud bg-snow text-transparent"
            }`}
          >
            <CheckIcon className="h-4 w-4" />
          </span>
          Saya sudah baca peraturannya
        </label>
        <button
          type="button"
          disabled={!ready}
          onClick={onStart}
          className="cc-btn border-brand-dark bg-brand p-3.5 text-base text-white"
        >
          <RocketIcon className="h-5 w-5" />
          SIAP, MULAI MAIN!
        </button>
      </div>
    </div>
  );
}

export default function RulesExperience() {
  const router = useRouter();
  const [openId, setOpenId] = useState<string | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [ready, setReady] = useState(false);

  return (
    <div className="rules-scope min-h-dvh bg-snow">
      <header className="sticky top-0 z-40 border-b-2 border-cloud bg-snow/85 backdrop-blur">
        <div className="mx-auto grid w-full max-w-4xl grid-cols-[44px_1fr_44px] items-center gap-2 px-4 py-3">
          <Link
            href="/"
            aria-label="Kembali ke beranda"
            className="flex h-11 w-11 items-center justify-center rounded-2xl border-2 border-cloud bg-snow text-ink transition hover:bg-cloud/50"
          >
            <ArrowLeftIcon className="h-5 w-5" />
          </Link>
          <span className="cc-display text-center text-lg font-extrabold text-ink">
            Cara Bermain
          </span>
          <div className="relative justify-self-end">
            <button
              type="button"
              aria-label="Bantuan halaman"
              aria-expanded={helpOpen}
              onClick={() => setHelpOpen((value) => !value)}
              className="flex h-11 w-11 items-center justify-center rounded-2xl border-2 border-cloud bg-snow text-ink-soft transition hover:text-ink"
            >
              <HelpIcon className="h-5 w-5" />
            </button>
            {helpOpen ? (
              <div className="cc-pop absolute right-0 top-12 z-50 w-64 rounded-2xl border-2 border-cloud bg-snow p-4 shadow-xl">
                <p className="text-sm font-extrabold text-ink">
                  Cara membaca halaman ini
                </p>
                <ul className="mt-2 flex flex-col gap-1.5 text-xs font-semibold text-ink-soft">
                  <li>Ketuk kartu untuk membuka detail aturan.</li>
                  <li>Angka pada ikon adalah urutan bab.</li>
                  <li>Centang di bawah untuk mengaktifkan tombol mulai.</li>
                </ul>
              </div>
            ) : null}
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-6 pb-44">
        <section className="relative overflow-hidden rounded-3xl border-2 border-cloud bg-gradient-to-br from-grape-soft via-ocean-soft to-snow p-6 sm:p-8">
          <div className="relative z-10 flex flex-col items-center gap-4 sm:flex-row">
            <div className="flex-1 text-center sm:text-left">
              <span className="inline-flex items-center gap-1.5 rounded-full border-2 border-grape-soft bg-snow px-3 py-1 text-xs font-extrabold text-grape-dark">
                <SparkleIcon className="h-3.5 w-3.5" />
                Panduan permainan
              </span>
              <h1 className="cc-display mt-3 text-4xl font-extrabold leading-tight text-ink sm:text-5xl">
                Cara Bermain
              </h1>
              <p className="mt-2 text-base font-semibold text-ink-soft">
                Baca dulu 1 menit, biar mainnya lancar!
              </p>
              <div className="mt-4 flex justify-center sm:justify-start">
                <ModeBadge />
              </div>
            </div>
            <HeroArt />
          </div>
        </section>

        <section className="flex flex-col gap-3">
          <div className="flex items-center gap-3 px-1">
            <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-ocean-soft text-ocean-dark">
              <SparkleIcon className="h-5 w-5" />
            </span>
            <h2 className="cc-display text-2xl font-extrabold text-ink">
              Aturan Inti
            </h2>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {RULES.map((rule, index) => (
              <Reveal key={rule.id} delay={index * 70}>
                <RuleCard
                  rule={rule}
                  open={openId === rule.id}
                  onToggle={() =>
                    setOpenId((prev) => (prev === rule.id ? null : rule.id))
                  }
                />
              </Reveal>
            ))}
          </div>
        </section>

        <Reveal>
          <section className="flex flex-col gap-3">
            <div className="flex items-center gap-3 px-1">
              <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-mango-soft text-mango-dark">
                <BoltIcon className="h-5 w-5" />
              </span>
              <h2 className="cc-display text-2xl font-extrabold text-ink">
                Contoh & Ilustrasi
              </h2>
            </div>
            <Examples />
          </section>
        </Reveal>

        <Reveal>
          <section
            id="tips"
            className="rounded-3xl border-2 border-sun bg-sun-soft p-5 sm:p-6"
          >
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sun text-white">
                <LightbulbIcon className="h-6 w-6" />
              </span>
              <h2 className="cc-display text-2xl font-extrabold text-ink">
                Tips & Trik
              </h2>
            </div>
            <ul className="mt-4 grid gap-3 sm:grid-cols-3">
              {TIPS.map((tip) => (
                <li
                  key={tip.text}
                  className="flex items-start gap-3 rounded-2xl bg-snow p-4"
                >
                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${tip.tone}`}
                  >
                    <tip.icon className="h-5 w-5" />
                  </span>
                  <span className="text-sm font-semibold leading-relaxed text-ink">
                    {tip.text}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </Reveal>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <Link
            href="/"
            className="cc-btn border-cloud bg-snow px-5 py-3 text-ink"
          >
            <ArrowLeftIcon className="h-5 w-5" />
            Kembali
          </Link>
          <Link
            href="/teacher"
            className="cc-btn border-ocean-dark bg-ocean px-5 py-3 text-white"
          >
            Saya Guru
          </Link>
        </div>
      </main>

      <StickyCta
        ready={ready}
        onReadyChange={setReady}
        onStart={() => router.push("/play")}
      />
    </div>
  );
}
