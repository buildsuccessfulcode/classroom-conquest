import type { ReactElement, SVGProps } from "react";

export type RuleIconName =
  | "flag"
  | "grid"
  | "path"
  | "cards"
  | "podium"
  | "clock"
  | "cycle"
  | "shield";

type RuleIconProps = SVGProps<SVGSVGElement> & { name: RuleIconName };

const INK = "#3c3c3c";

function FlagArt(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 48 48" fill="none" {...props}>
      <path d="M14 8v34" stroke={INK} strokeWidth="3.4" strokeLinecap="round" />
      <path
        d="M14 10h21l-3.6 6.6L35 23H14V10Z"
        fill="#58cc02"
        stroke="#46a302"
        strokeWidth="2.6"
        strokeLinejoin="round"
      />
      <circle cx="14" cy="43" r="3.2" fill="#46a302" />
      <circle cx="20" cy="16.5" r="2" fill="#d7ffb8" />
    </svg>
  );
}

function GridArt(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 48 48" fill="none" {...props}>
      <rect x="6" y="6" width="15" height="15" rx="4.5" fill="#ddf4ff" stroke="#1899d6" strokeWidth="2.6" />
      <rect x="27" y="6" width="15" height="15" rx="4.5" fill="#f7ecff" stroke="#a560e8" strokeWidth="2.6" />
      <rect x="6" y="27" width="15" height="15" rx="4.5" fill="#d7ffb8" stroke="#46a302" strokeWidth="2.6" />
      <rect x="27" y="27" width="15" height="15" rx="4.5" fill="#fff1d6" stroke="#e58900" strokeWidth="2.6" />
      <path d="M31 34.5h7" stroke="#e58900" strokeWidth="2.6" strokeLinecap="round" />
      <circle cx="13.5" cy="13.5" r="2.2" fill="#1899d6" />
    </svg>
  );
}

function PathArt(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 48 48" fill="none" {...props}>
      <path
        d="M12 41c0-8.5 24-6 24-15S12 18 12 9"
        stroke="#46a302"
        strokeWidth="3.4"
        strokeLinecap="round"
        strokeDasharray="1 7"
      />
      <circle cx="12" cy="41" r="5" fill="#58cc02" stroke="#46a302" strokeWidth="2.6" />
      <circle cx="36" cy="8" r="6" fill="#ffc800" stroke="#e5b400" strokeWidth="2.6" />
      <path
        d="M33.4 8l1.9 1.9L39 6"
        stroke={INK}
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CardsArt(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 48 48" fill="none" {...props}>
      <rect
        x="7"
        y="14"
        width="25"
        height="25"
        rx="5"
        fill="#fff1d6"
        stroke="#e58900"
        strokeWidth="2.6"
        transform="rotate(-9 19.5 26.5)"
      />
      <rect x="13" y="9" width="26" height="26" rx="5" fill="#ffffff" stroke="#ff9600" strokeWidth="2.6" />
      <path d="M20 18h12M20 24h12M20 30h7" stroke="#ff9600" strokeWidth="2.6" strokeLinecap="round" />
      <circle cx="34" cy="12" r="4.5" fill="#ff4b4b" stroke="#ea2b2b" strokeWidth="2" />
    </svg>
  );
}

function PodiumArt(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 48 48" fill="none" {...props}>
      <rect x="7" y="26" width="10" height="16" rx="3" fill="#d7ffb8" stroke="#46a302" strokeWidth="2.6" />
      <rect x="19" y="18" width="10" height="24" rx="3" fill="#fff6cc" stroke="#e5b400" strokeWidth="2.6" />
      <rect x="31" y="30" width="10" height="12" rx="3" fill="#ddf4ff" stroke="#1899d6" strokeWidth="2.6" />
      <path
        d="m24 4 2.1 4.3 4.7.7-3.4 3.3.8 4.7-4.2-2.2-4.2 2.2.8-4.7-3.4-3.3 4.7-.7L24 4Z"
        fill="#ffc800"
        stroke="#e5b400"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ClockArt(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 48 48" fill="none" {...props}>
      <circle cx="24" cy="27" r="15" fill="#ffdfe0" stroke="#ea2b2b" strokeWidth="3" />
      <path
        d="M24 19v8l6 4"
        stroke="#ea2b2b"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M19 7.5h10M24 7.5v4.5" stroke={INK} strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

function CycleArt(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 48 48" fill="none" {...props}>
      <path
        d="M37 20a14 14 0 0 0-24-6l-3 4"
        stroke="#1899d6"
        strokeWidth="3.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M11 28a14 14 0 0 0 24 6l3-4"
        stroke="#1899d6"
        strokeWidth="3.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M10 10v8h8M38 38v-8h-8"
        stroke="#1899d6"
        strokeWidth="3.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ShieldArt(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 48 48" fill="none" {...props}>
      <path
        d="M24 5.5 38 11v11c0 9-6 15.6-14 20-8-4.4-14-11-14-20V11l14-5.5Z"
        fill="#f7ecff"
        stroke="#a560e8"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <path
        d="m17 24 5 5 10-11"
        stroke="#a560e8"
        strokeWidth="3.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const ART: Record<RuleIconName, (props: SVGProps<SVGSVGElement>) => ReactElement> = {
  flag: FlagArt,
  grid: GridArt,
  path: PathArt,
  cards: CardsArt,
  podium: PodiumArt,
  clock: ClockArt,
  cycle: CycleArt,
  shield: ShieldArt,
};

export default function RuleIcon({ name, ...props }: RuleIconProps) {
  const Art = ART[name];
  return <Art {...props} />;
}
