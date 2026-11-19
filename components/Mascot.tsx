"use client";

import { memo } from "react";

export type MascotMood =
  | "idle"
  | "happy"
  | "cheer"
  | "sad"
  | "think"
  | "sleep";

interface MascotProps {
  mood?: MascotMood;
  size?: number;
  className?: string;
  float?: boolean;
  crown?: boolean;
}

function Face({ mood }: { mood: MascotMood }) {
  const cheek = (
    <>
      <circle cx="64" cy="126" r="8" fill="#ff8fab" opacity="0.45" />
      <circle cx="136" cy="126" r="8" fill="#ff8fab" opacity="0.45" />
    </>
  );

  if (mood === "cheer") {
    return (
      <>
        {cheek}
        <path
          d="M68 112q10-12 20 0"
          fill="none"
          stroke="#3c3c3c"
          strokeWidth="6"
          strokeLinecap="round"
        />
        <path
          d="M112 112q10-12 20 0"
          fill="none"
          stroke="#3c3c3c"
          strokeWidth="6"
          strokeLinecap="round"
        />
        <ellipse cx="100" cy="138" rx="16" ry="13" fill="#3c3c3c" />
        <ellipse cx="100" cy="145" rx="8" ry="6" fill="#ff8fab" />
      </>
    );
  }

  if (mood === "sleep") {
    return (
      <>
        {cheek}
        <path
          d="M68 114q10 9 20 0"
          fill="none"
          stroke="#3c3c3c"
          strokeWidth="5"
          strokeLinecap="round"
        />
        <path
          d="M112 114q10 9 20 0"
          fill="none"
          stroke="#3c3c3c"
          strokeWidth="5"
          strokeLinecap="round"
        />
        <path
          d="M90 138h20"
          fill="none"
          stroke="#3c3c3c"
          strokeWidth="5"
          strokeLinecap="round"
        />
      </>
    );
  }

  if (mood === "sad") {
    return (
      <>
        {cheek}
        <path
          d="M66 98l18 6M134 98l-18 6"
          fill="none"
          stroke="#3c3c3c"
          strokeWidth="5"
          strokeLinecap="round"
        />
        <ellipse cx="78" cy="116" rx="12" ry="14" fill="#ffffff" />
        <ellipse cx="122" cy="116" rx="12" ry="14" fill="#ffffff" />
        <circle cx="79" cy="120" r="6" fill="#3c3c3c" />
        <circle cx="121" cy="120" r="6" fill="#3c3c3c" />
        <path
          d="M86 142q14-11 28 0"
          fill="none"
          stroke="#3c3c3c"
          strokeWidth="5"
          strokeLinecap="round"
        />
      </>
    );
  }

  if (mood === "think") {
    return (
      <>
        {cheek}
        <ellipse cx="78" cy="114" rx="12" ry="14" fill="#ffffff" />
        <ellipse cx="122" cy="114" rx="12" ry="14" fill="#ffffff" />
        <circle cx="80" cy="115" r="6" fill="#3c3c3c" />
        <circle cx="124" cy="115" r="6" fill="#3c3c3c" />
        <path
          d="M112 104h20"
          fill="none"
          stroke="#3c3c3c"
          strokeWidth="5"
          strokeLinecap="round"
        />
        <circle cx="100" cy="138" r="5" fill="#3c3c3c" />
      </>
    );
  }

  return (
    <>
      {cheek}
      <ellipse cx="78" cy="114" rx="13" ry="15" fill="#ffffff" />
      <ellipse cx="122" cy="114" rx="13" ry="15" fill="#ffffff" />
      <circle cx="80" cy="115" r="7" fill="#3c3c3c" />
      <circle cx="124" cy="115" r="7" fill="#3c3c3c" />
      <circle cx="77" cy="111" r="2.6" fill="#ffffff" />
      <circle cx="121" cy="111" r="2.6" fill="#ffffff" />
      <path
        d="M86 134q14 12 28 0"
        fill="none"
        stroke="#3c3c3c"
        strokeWidth="5"
        strokeLinecap="round"
      />
    </>
  );
}

function Mascot({
  mood = "idle",
  size = 160,
  className = "",
  float = false,
  crown = false,
}: MascotProps) {
  return (
    <svg
      viewBox="0 0 200 210"
      width={size}
      height={(size * 210) / 200}
      className={[float ? "cc-float" : "", className].join(" ")}
      role="img"
      aria-label="Maskot Kabo"
    >
      <ellipse cx="100" cy="192" rx="52" ry="9" fill="#000000" opacity="0.08" />

      {crown ? (
        <path
          d="M62 52 74 64l26-30 26 30 12-12-6 34H68l-6-34Z"
          fill="#ffc800"
          stroke="#e5b400"
          strokeWidth="3"
          strokeLinejoin="round"
        />
      ) : (
        <>
          <path
            d="M100 60V34"
            stroke="#46a302"
            strokeWidth="6"
            strokeLinecap="round"
          />
          <path
            d="M100 18c2 6 4 8 10 10-6 2-8 4-10 10-2-6-4-8-10-10 6-2 8-4 10-10Z"
            fill="#ffc800"
            stroke="#e5b400"
            strokeWidth="2.5"
            strokeLinejoin="round"
          />
        </>
      )}

      <ellipse
        cx="48"
        cy="128"
        rx="14"
        ry="22"
        fill="#58cc02"
        stroke="#46a302"
        strokeWidth="3"
        transform="rotate(-24 48 128)"
      />
      <ellipse
        cx="152"
        cy="128"
        rx="14"
        ry="22"
        fill="#58cc02"
        stroke="#46a302"
        strokeWidth="3"
        transform="rotate(24 152 128)"
      />
      <ellipse cx="76" cy="178" rx="16" ry="11" fill="#46a302" />
      <ellipse cx="124" cy="178" rx="16" ry="11" fill="#46a302" />

      <ellipse
        cx="100"
        cy="122"
        rx="60"
        ry="56"
        fill="#58cc02"
        stroke="#46a302"
        strokeWidth="3.5"
      />
      <ellipse cx="100" cy="142" rx="36" ry="31" fill="#d7ffb8" opacity="0.85" />

      <Face mood={mood} />
    </svg>
  );
}

export default memo(Mascot);
