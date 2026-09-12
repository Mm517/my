/**
 * Convert a real name into an anonymous display name like "Mo***".
 * Uses the first 1-2 letters of the first token followed by ***.
 */
export function anonymizeName(name: string | null | undefined): string {
  if (!name) return "Anon";
  const trimmed = name.trim();
  if (!trimmed) return "Anon";
  const first = trimmed.split(/\s+/)[0] ?? trimmed;
  const prefix = first.slice(0, 2).replace(/[^\p{L}\p{N}]/gu, "");
  if (prefix.length === 0) return "Anon";
  return `${prefix.charAt(0).toUpperCase()}${prefix.slice(1).toLowerCase()}***`;
}

const MENTION_REGEX = /@([\p{L}\p{N}]{1,8}\*+)/gu;

/**
 * Extract @mention tokens from message content and resolve them against a
 * directory map of anonymousName -> userIds. Returns the de-duplicated list of
 * mentioned user ids (excluding the author so people don't ping themselves).
 */
export function extractMentions(
  content: string | null | undefined,
  directory: Map<string, string[]>,
  authorId: string,
): string[] {
  if (!content) return [];
  const found = new Set<string>();
  for (const match of content.matchAll(MENTION_REGEX)) {
    const token = match[1];
    if (!token) continue;
    const ids = directory.get(token);
    if (!ids) continue;
    for (const id of ids) if (id !== authorId) found.add(id);
  }
  return Array.from(found);
}

