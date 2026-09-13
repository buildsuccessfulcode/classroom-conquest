"use client";

import { useEffect } from "react";
import { reportFocusEvent } from "@/lib/backend";

const RETURN_REPORT_MS = 10_000;
const REPORT_INTERVAL_MS = 10_000;

export function useFocusGuard({
  sessionCode,
  teamId,
  active,
}: {
  sessionCode: string | null;
  teamId: string | null;
  active: boolean;
}) {
  useEffect(() => {
    if (!active || !sessionCode || !teamId) return;
    let leftAt: number | null = null;
    let lastReportAt = 0;

    const send = (awayMs: number, reason: "leave" | "return" | "exit") => {
      const now = Date.now();
      if (now - lastReportAt < REPORT_INTERVAL_MS) return;
      lastReportAt = now;
      void reportFocusEvent({ sessionCode, teamId, awayMs, reason }).catch(
        (err) => {
          console.error("Gagal melaporkan perpindahan tab", err);
        },
      );
    };

    const leave = () => {
      if (leftAt !== null) return;
      leftAt = Date.now();
      send(0, "leave");
    };

    const back = () => {
      if (leftAt === null) return;
      const awayMs = Date.now() - leftAt;
      leftAt = null;
      if (awayMs >= RETURN_REPORT_MS) send(awayMs, "return");
    };

    const onVisibility = () => {
      if (document.hidden) leave();
      else back();
    };

    const onPageHide = () => {
      const awayMs = leftAt === null ? 0 : Date.now() - leftAt;
      leftAt = null;
      send(awayMs, "exit");
    };

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("blur", leave);
    window.addEventListener("focus", back);
    window.addEventListener("pagehide", onPageHide);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("blur", leave);
      window.removeEventListener("focus", back);
      window.removeEventListener("pagehide", onPageHide);
    };
  }, [active, sessionCode, teamId]);
}
