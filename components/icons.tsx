import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

const base = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2.2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export function CheckIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M5 13l4 4L19 7" />
    </svg>
  );
}

export function XIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

export function BoltIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M13.5 2 4 13.2h6.2L9.8 22 20 10.4h-6.4L13.5 2Z" />
    </svg>
  );
}

export function FlameIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M12 2c.6 3.2-1.6 4.6-3 6.4C7.4 10.3 6 12 6 14.6 6 18.7 8.9 22 12.4 22c3.6 0 6.1-3 6.1-6.7 0-2.6-1.2-4.4-2.6-6.1-.9-1.1-1.9-2.2-2.3-3.7-.7.8-1.1 1.6-1.1 2.6 0 1 .3 1.7.8 2.5-1.3-.4-2.2-1.6-2.2-3.1C11.1 5.9 11.7 4 12 2Z" />
    </svg>
  );
}

export function StarIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="m12 2.5 2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4 6.1 20.5l1.2-6.5-4.8-4.6 6.6-.9 2.9-6Z" />
    </svg>
  );
}

export function TrophyIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M8 4h8v5a4 4 0 0 1-8 0V4Z" />
      <path d="M8 5H5.5a2.5 2.5 0 0 0 0 5H8M16 5h2.5a2.5 2.5 0 0 1 0 5H16" />
      <path d="M12 13v3M9 20h6M10 20l.5-3h3l.5 3" />
    </svg>
  );
}

export function CrownIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M3 8.5 7 12l5-6.5L17 12l4-3.5-1.4 10.5H4.4L3 8.5Z" />
    </svg>
  );
}

export function FlagIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M5 21V4M5 4h11l-1.5 4L16 12H5" />
    </svg>
  );
}

export function TargetIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="4.5" />
      <circle cx="12" cy="12" r="1" fill="currentColor" />
    </svg>
  );
}

export function LockIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <rect x="5" y="11" width="14" height="9" rx="2.5" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

export function SparkleIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M12 2.5c.6 3.9 2.1 5.4 6 6-3.9.6-5.4 2.1-6 6-.6-3.9-2.1-5.4-6-6 3.9-.6 5.4-2.1 6-6Z" />
      <path d="M18.5 14c.3 1.9 1 2.7 3 3-2 .3-2.7 1-3 3-.3-2-1-2.7-3-3 2-.3 2.7-1.1 3-3Z" />
    </svg>
  );
}

export function UsersIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3.5 19c.6-3 2.7-4.6 5.5-4.6s4.9 1.6 5.5 4.6" />
      <path d="M16 5.5a3 3 0 0 1 0 5.6M17.5 19c-.2-1.6-.7-2.9-1.5-3.8" />
    </svg>
  );
}

export function ClockIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </svg>
  );
}

export function ArrowRightIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M5 12h13M13 6l6 6-6 6" />
    </svg>
  );
}

export function ArrowLeftIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M19 12H6M11 6l-6 6 6 6" />
    </svg>
  );
}

export function PlusIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function RefreshIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M20 11a8 8 0 0 0-14-4.5L4 8M4 5v3h3" />
      <path d="M4 13a8 8 0 0 0 14 4.5L20 16M20 19v-3h-3" />
    </svg>
  );
}

export function TrashIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M4 7h16M9 7V5h6v2M6 7l1 12h10l1-12M10 11v5M14 11v5" />
    </svg>
  );
}

export function PlayIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M7 4.5v15l13-7.5-13-7.5Z" />
    </svg>
  );
}

export function StopIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <rect x="6" y="6" width="12" height="12" rx="2" />
    </svg>
  );
}

export function UploadIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M12 16V5M8 9l4-4 4 4" />
      <path d="M5 15v3a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-3" />
    </svg>
  );
}

export function BookIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H19v15H6.5A2.5 2.5 0 0 0 4 20.5v-15Z" />
      <path d="M4 20.5A2.5 2.5 0 0 1 6.5 18H19v3H6.5" />
      <path d="M8 7.5h7" />
    </svg>
  );
}

export function LogOutIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3" />
      <path d="M10 12h9M16 8l3 4-3 4" />
    </svg>
  );
}

export function HelpIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.7 9.3a2.6 2.6 0 0 1 5 .8c0 1.7-2.7 2-2.7 3.7" />
      <circle cx="12" cy="17.2" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function ChevronDownIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

export function LightbulbIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M9.5 18h5M10.5 21h3" />
      <path d="M12 3a6 6 0 0 0-3.6 10.8c.6.5.9 1.1 1 1.9v.3h5.2v-.3c.1-.8.4-1.4 1-1.9A6 6 0 0 0 12 3Z" />
    </svg>
  );
}

export function RocketIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M4.6 16.4c-1.5 1.3-2 5-2 5s3.7-.5 5-2c.8-.8.7-2 0-2.8-.8-.7-2.2-.6-3-.2Z" />
      <path d="M12 15 9 12c.5-1.7 1.3-3.3 2.4-4.7C14 4.3 18 3.5 20.5 4c.5 2.5-.3 6.5-3.3 9.1-1.4 1.1-3 1.9-4.7 2.4Z" />
      <path d="M9 12H5.6L7 9.4h3M12 15v3.4L14.6 17v-3" />
      <circle cx="15.5" cy="8.5" r="1.4" />
    </svg>
  );
}

export function SettingsIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2 2 2 0 1 1-4 0 1.7 1.7 0 0 0-2.9-1.2l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.7 1.7 0 0 0 3 15a2 2 0 1 1 0-4 1.7 1.7 0 0 0 1.4-2.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.7 1.7 0 0 0 10 4a2 2 0 1 1 4 0 1.7 1.7 0 0 0 2.9 1.4l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1A1.7 1.7 0 0 0 21 11a2 2 0 1 1 0 4Z" />
    </svg>
  );
}

export function KeyIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="8" cy="15" r="4" />
      <path d="M10.8 12.2 20 3M16.5 6.5l2 2M13.5 9.5l2 2" />
    </svg>
  );
}

export function CopyIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <rect x="9" y="9" width="11" height="11" rx="2.5" />
      <path d="M15 5.5A2.5 2.5 0 0 0 12.5 3h-7A2.5 2.5 0 0 0 3 5.5v7A2.5 2.5 0 0 0 5.5 15" />
    </svg>
  );
}

export function RobotIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <rect x="4" y="7" width="16" height="12" rx="3" />
      <path d="M12 3v4M8 19v2M16 19v2" />
      <circle cx="9" cy="13" r="1" fill="currentColor" stroke="none" />
      <circle cx="15" cy="13" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function ListIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M8 6h12M8 12h12M8 18h12" />
      <circle cx="4" cy="6" r="1" fill="currentColor" stroke="none" />
      <circle cx="4" cy="12" r="1" fill="currentColor" stroke="none" />
      <circle cx="4" cy="18" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function WandIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M15 4l1 2 2 1-2 1-1 2-1-2-2-1 2-1 1-2Z" />
      <path d="M4 20 14 10M11.5 7.5l1 1" />
      <path d="M19 14l.7 1.4L21 16l-1.3.6L19 18l-.7-1.4L17 16l1.3-.6L19 14Z" />
    </svg>
  );
}

export function VolumeOnIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M4 9v6h4l5 4V5L8 9H4Z" />
      <path d="M16.5 8.5a5 5 0 0 1 0 7" />
      <path d="M19 6a9 9 0 0 1 0 12" />
    </svg>
  );
}

export function VolumeOffIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M4 9v6h4l5 4V5L8 9H4Z" />
      <path d="M17 9l5 6M22 9l-5 6" />
    </svg>
  );
}
