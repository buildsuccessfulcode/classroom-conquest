export const TEAM_PALETTE = [
  "#EF4444",
  "#F97316",
  "#EAB308",
  "#22C55E",
  "#14B8A6",
  "#3B82F6",
  "#6366F1",
  "#A855F7",
  "#EC4899",
  "#0EA5E9",
  "#84CC16",
  "#F43F5E",
];

export function pickTeamColor(usedColors: string[]): string {
  const used = new Set(usedColors.map((color) => color.toUpperCase()));
  const available = TEAM_PALETTE.find((color) => !used.has(color));
  if (available) return available;
  const index = used.size % TEAM_PALETTE.length;
  return TEAM_PALETTE[index];
}
