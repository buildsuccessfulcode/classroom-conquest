"use client";

import { AVATARS, type AvatarId } from "@/lib/avatars";
import Avatar from "./Avatar";
import { CheckIcon } from "./icons";

export default function AvatarPicker({
  value,
  onChange,
  disabled = false,
}: {
  value: AvatarId | null;
  onChange: (id: AvatarId) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-extrabold text-ink">Pilih Avatar</span>
      <div className="grid grid-cols-4 gap-2">
        {AVATARS.map((avatar) => {
          const active = value === avatar.id;
          return (
            <button
              key={avatar.id}
              type="button"
              disabled={disabled}
              aria-pressed={active}
              title={avatar.label}
              onClick={() => onChange(avatar.id)}
              className={[
                "relative flex flex-col items-center gap-1 rounded-2xl border-2 p-2 transition",
                active
                  ? "border-ocean bg-ocean-soft"
                  : "border-cloud bg-white hover:border-ocean/60",
                disabled ? "opacity-60" : "",
              ].join(" ")}
            >
              <Avatar id={avatar.id} size={38} />
              <span className="w-full truncate text-center text-[10px] font-extrabold text-ink-soft">
                {avatar.label}
              </span>
              {active ? (
                <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-ocean text-white">
                  <CheckIcon className="h-3 w-3" />
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
