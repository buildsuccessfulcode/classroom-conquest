"use client";

import { useEffect } from "react";

function isLowEnd(): boolean {
  if (typeof navigator === "undefined") return false;
  const nav = navigator as Navigator & { deviceMemory?: number };
  const cores = nav.hardwareConcurrency ?? 8;
  const memory = nav.deviceMemory ?? 8;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  return reduced || cores <= 4 || memory <= 4;
}

export default function RuntimeOptimizations() {
  useEffect(() => {
    if (isLowEnd()) {
      document.documentElement.dataset.lite = "true";
    }
  }, []);

  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    const register = () => {
      void navigator.serviceWorker.register("/sw.js").catch(() => {});
    };
    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
  }, []);

  return null;
}
