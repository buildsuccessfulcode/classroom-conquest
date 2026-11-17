export const AVATARS = [
  { id: "kucing", label: "Kucing" },
  { id: "anjing", label: "Anjing" },
  { id: "rubah", label: "Rubah" },
  { id: "panda", label: "Panda" },
  { id: "kelinci", label: "Kelinci" },
  { id: "katak", label: "Katak" },
  { id: "pinguin", label: "Pinguin" },
  { id: "koala", label: "Koala" },
] as const;

export type AvatarId = (typeof AVATARS)[number]["id"];

const AVATAR_IDS = new Set<string>(AVATARS.map((avatar) => avatar.id));

export const DEFAULT_AVATAR: AvatarId = "kucing";

export function isAvatarId(value: unknown): value is AvatarId {
  return typeof value === "string" && AVATAR_IDS.has(value);
}

export function pickAvatar(used: string[]): AvatarId {
  const taken = new Set(used.filter(isAvatarId));
  const available = AVATARS.find((avatar) => !taken.has(avatar.id));
  if (available) return available.id;
  return AVATARS[used.length % AVATARS.length].id;
}
