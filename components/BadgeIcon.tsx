import type { BadgeId } from "@/lib/gamification";
import {
  BoltIcon,
  CheckIcon,
  CrownIcon,
  FlameIcon,
  StarIcon,
  TargetIcon,
  TrophyIcon,
} from "./icons";

const MAP = {
  first: CheckIcon,
  collector: StarIcon,
  scholar: BoltIcon,
  spark: FlameIcon,
  blaze: FlameIcon,
  halfway: TargetIcon,
  perfect: TrophyIcon,
  podium: CrownIcon,
} as const;

export default function BadgeIcon({
  id,
  className,
}: {
  id: BadgeId;
  className?: string;
}) {
  const Glyph = MAP[id];
  return <Glyph className={className} />;
}
