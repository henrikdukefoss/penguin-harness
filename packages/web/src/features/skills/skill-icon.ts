/**
 * Skill, hook package and plugin icons. An icon belongs to a plugin: the library card and the
 * detail Modal show the plugin's own icon, and an installed skill or hook package shows the
 * icon of the plugin it came from (written into its directory at install time). Where a subject
 * has no icon — a user-authored or zip-imported skill, an install older than the icon copy, a
 * custom plugin without an icon.svg — the mark falls back to one uniform glyph for its kind:
 * the book for a skill, the hook for a hook package, the puzzle piece for a plugin. The caller
 * names the kind through `fallback`; never a letter or a per-name mark.
 *
 * An icon travels as a path on this server (`/api/plugins/…/icon`), and the page draws it as
 * an image — `<img>` for a mark that paints itself, a CSS mask in the row's colour for line
 * art — never as inline markup: no `innerHTML`, no per-page weight, no id collisions between
 * icons. The only check left here is the shape of the path (same-origin, no scheme, no
 * query-defined tricks): anything else falls back to the glyph.
 */

/**
 * The icon URL a row carries, when it is a path on this server: relative (the page loads it
 * same-origin), a single segment-safe form — no scheme, no protocol-relative `//`, no
 * whitespace or markup — and nothing else. Null means "no usable icon": the caller draws the
 * kind's glyph.
 */
export function skillIconUrl(icon: string | undefined | null): string | null {
  if (!icon) return null;
  const trimmed = icon.trim();
  return /^\/(?!\/)[^\s"<>]+$/.test(trimmed) ? trimmed : null;
}
