/** Up to two initials: first letters of the first and last word. */
export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const first = words[0]?.[0] ?? '';
  const last = words.length > 1 ? (words[words.length - 1]?.[0] ?? '') : '';
  return (first + last).toUpperCase();
}

export type AvatarTone = 1 | 2 | 3 | 4;

/** A stable warm tone for a name, so the same sender always gets the same color. */
export function avatarTone(name: string): AvatarTone {
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + (ch.codePointAt(0) ?? 0)) >>> 0;
  return ((hash % 4) + 1) as AvatarTone;
}
