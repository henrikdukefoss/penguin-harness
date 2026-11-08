/**
 * Pre-render check for custom Skill icons (DTO `icon` field = raw icon.svg from the Skill
 * directory), used inline (shared by the Skills page and unit tests): the icon is inlined
 * into the page (inheriting currentColor), so any executable content must be rejected —
 * `<script`, event attributes (on*=), `<foreignObject>`, or any `href` attribute (icons
 * don't need links; this covers xlink:href and `<a href=…>`) all cause a fallback to the
 * default book icon; content whose root isn't `<svg>` also falls back.
 * Checks match the raw text case-insensitively (no DOM parsing: prefer false positives
 * over letting something through).
 */

/** Event attribute (onclick / onload / …): attribute name preceded by whitespace/quote, followed by `=`. */
const EVENT_ATTR = /[\s"'/]on[a-z]+\s*=/i;

/**
 * Any `href` attribute (regardless of xlink: prefix, case-insensitive, with or without quotes):
 * icons don't need links, so `href` can only carry risky content like javascript:/external links.
 */
const HREF_ATTR = /href\s*=/i;

/**
 * Returns the inlinable SVG source (trimmed) if validation passes, otherwise null
 * (caller falls back to the default book icon).
 *
 * A plugin's card may also name a picture: the server fetches it and serves the bytes at a
 * path of its own (`/api/plugins/registry/icon?name=…`), so what arrives here is either
 * markup (inlined once it passes the checks below) or that same-origin path, which the
 * caller loads as an image rather than inlining. No other shape — an `https://` URL, a
 * protocol-relative one — passes: the page never loads a picture from the outside.
 */
export function sanitizeSkillIcon(svg: string | undefined): string | null {
  if (!svg) return null;
  const trimmed = svg.trim();
  if (/^\/(?![/])[^\s"<>]+$/.test(trimmed)) return trimmed;
  if (!/^<svg[\s>]/i.test(trimmed)) return null;
  const lower = trimmed.toLowerCase();
  if (lower.includes("<script")) return null;
  if (lower.includes("foreignobject")) return null;
  if (HREF_ATTR.test(trimmed)) return null;
  if (EVENT_ATTR.test(trimmed)) return null;
  return trimmed;
}

/**
 * Inline SVGs share one document, so their internal ids don't: two icons that both define
 * `id="a"` (C#'s linearGradient and Kotlin's radialGradient do) collide — every `url(#a)`
 * in the page resolves to the *first* `#a` in the DOM, and the second icon paints with the
 * first one's geometry (its own gradient vanishes). Before inlining, rename every `id="X"`
 * into a per-icon namespace (`${uid}-X`) and rewrite the references that point at it.
 * `url(#…)` is the only reference form an inlined icon can carry: `sanitizeSkillIcon` has
 * already rejected every `href` attribute. Returns the input unchanged when there is no
 * `id` to rename (the common case — line art has none).
 */
export function namespaceSvgIds(svg: string, uid: string): string {
  if (!svg.includes("id=")) return svg;
  const ids = new Set<string>();
  for (const m of svg.matchAll(/\bid\s*=\s*"([^"]+)"/g)) ids.add(m[1]!);
  if (ids.size === 0) return svg;
  // Longest first so an id that is a prefix of another (b vs bc) can't shadow it.
  const alt = [...ids]
    .sort((a, b) => b.length - a.length)
    .map((id) => id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("|");
  const rename = (id: string) => `${uid}-${id}`;
  return svg
    .replace(
      new RegExp(`(\\bid\\s*=\\s*")(${alt})(")`, "g"),
      (_m, pre, id) => pre + rename(id!) + '"',
    )
    .replace(
      new RegExp(`(url\\((['"]?)#)(${alt})(\\2\\))`, "gi"),
      (_m, pre, _q, id, post) => pre + rename(id!) + post,
    );
}

/**
 * True when the mark paints itself and stands unframed: a brand logo (a fill or gradient
 * beyond line art) or a picture served by this server. Line art — `stroke="currentColor"`,
 * `fill="none"` — paints nothing of its own: it takes its colour from the text, so the
 * tile's tint is what colours it, and it belongs in the tile. The two are disjoint in the
 * wild (a logo carries fills, line art carries currentColor); when a mark manages both,
 * its own colours win.
 */
export function iconPaintsItself(svg: string): boolean {
  if (svg.startsWith("/")) return true;
  if (/gradient/i.test(svg)) return true;
  for (const m of svg.matchAll(/fill\s*=\s*"([^"]*)"/gi)) {
    if (m[1]!.trim() !== "" && m[1]!.trim() !== "none") return true;
  }
  if (/style\s*=\s*"[^"]*fill\s*:\s*(?!none)[^";]+/i.test(svg)) return true;
  return false;
}
