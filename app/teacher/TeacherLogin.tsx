"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { loginTeacher } from "@/app/actions";
import Mascot from "@/components/Mascot";
import ModeBadge from "@/components/ModeBadge";
import { ArrowLeftIcon, LockIcon } from "@/components/icons";

export default function TeacherLogin() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const result = await loginTeacher(password);
      if (!result.ok) {
        setError(result.error ?? "Password salah");
        return;
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal masuk");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-5 py-10">
      <header className="flex items-center justify-between">
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-sm font-extrabold text-ocean-dark"
        >
          <ArrowLeftIcon className="h-4 w-4" />
          Beranda
        </Link>
        <ModeBadge />
      </header>

      <div className="flex flex-col items-center text-center">
        <Mascot mood="think" size={140} float />
        <h1 className="cc-display mt-2 text-3xl font-extrabold text-ink">
          Area Guru
        </h1>
        <p className="mt-1 text-sm font-semibold text-ink-soft">
          Masukkan password untuk membuka dashboard.
        </p>
      </div>

      <form className="cc-card flex flex-col gap-4 p-5" onSubmit={handleSubmit}>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-extrabold text-ink">Password</span>
          <div className="relative">
            <LockIcon className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-soft" />
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              autoFocus
              className="w-full rounded-2xl border-2 border-cloud bg-snow p-3 pl-11 font-bold text-ink outline-none transition focus:border-ocean focus:ring-4 focus:ring-ocean/20"
              placeholder="Masukkan password"
            />
          </div>
        </label>
        <button
          type="submit"
          disabled={busy || password.length === 0}
          className="cc-btn border-ocean-dark bg-ocean p-3.5 text-white"
        >
          {busy ? "Memeriksa..." : "Masuk"}
        </button>
        {error ? (
          <p className="rounded-2xl bg-cherry-soft px-3 py-2 text-sm font-bold text-cherry-dark">
            {error}
          </p>
        ) : null}
      </form>
    </main>
  );
}
