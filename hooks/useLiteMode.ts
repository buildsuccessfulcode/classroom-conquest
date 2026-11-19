"use client";

import { useSyncExternalStore } from "react";
import { liteSnapshot, subscribeLite } from "@/lib/lite";

export function useLiteMode(): boolean {
  return useSyncExternalStore(subscribeLite, liteSnapshot, () => false);
}
