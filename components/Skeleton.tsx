export default function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      className={[
        "cc-skeleton rounded-2xl bg-cloud/70",
        className,
      ].join(" ")}
      aria-hidden
    />
  );
}
