import Link from "next/link";
import ModeBadge from "@/components/ModeBadge";

const ROLES = [
  {
    href: "/teacher",
    title: "Dashboard Guru",
    description:
      "Buat sesi, atur durasi, impor bank soal, lalu pantau poin dan jalannya permainan.",
  },
  {
    href: "/play",
    title: "Main Murid",
    description:
      "Gabung dengan kode sesi dan nama tim, lalu kumpulkan poin dengan menjawab nomor soal.",
  },
  {
    href: "/display",
    title: "Papan Proyektor",
    description:
      "Tampilkan papan nomor soal, peringkat tim, dan log aktivitas secara langsung di depan kelas.",
  },
];

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-10 px-6 py-12">
      <header className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-4">
          <span className="text-sm font-bold uppercase tracking-widest text-indigo-600 dark:text-indigo-400">
            Classroom Conquest
          </span>
          <ModeBadge />
        </div>
        <h1 className="text-4xl font-black leading-tight tracking-tight sm:text-5xl">
          Ubah ruang kelas menjadi arena strategi.
        </h1>
        <p className="max-w-2xl text-lg text-slate-600 dark:text-slate-300">
          Gamifikasi pembelajaran berbasis kelompok. Setiap tim menjawab nomor
          soal pilihan ganda, isian singkat, atau menyusun kata untuk
          mengumpulkan poin. Papan permainan diperbarui secara langsung di layar
          proyektor.
        </p>
      </header>

      <section className="grid gap-4 sm:grid-cols-3">
        {ROLES.map((role) => (
          <Link
            key={role.href}
            href={role.href}
            className="group flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:border-indigo-700"
          >
            <h2 className="text-xl font-bold group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
              {role.title}
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {role.description}
            </p>
            <span className="mt-auto text-sm font-semibold text-indigo-600 dark:text-indigo-400">
              Buka halaman
            </span>
          </Link>
        ))}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="mb-3 text-lg font-bold">Cara Bermain Singkat</h2>
        <ol className="flex list-decimal flex-col gap-2 pl-5 text-sm text-slate-600 dark:text-slate-300">
          <li>Guru membuat sesi dan mencatat kode 6 karakter.</li>
          <li>Proyektor membuka halaman papan dan memasukkan kode sesi.</li>
          <li>Setiap kelompok bergabung dari perangkat masing-masing.</li>
          <li>
            Setiap tim menjawab nomor soal mana saja yang tersedia; jawaban
            salah tidak mengurangi poin dan bisa dicoba lagi.
          </li>
          <li>
            Pemenang ditentukan dari total poin terbanyak; jika sama, tim yang
            menjawab benar lebih dulu (waktu jawaban terakhir) unggul.
          </li>
        </ol>
      </section>
    </main>
  );
}
