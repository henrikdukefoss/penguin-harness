/**
 * Skill, hook package and plugin icons. An icon belongs to a plugin: the library card and the
 * detail Modal show the plugin's own icon, and an installed skill or hook package shows the
 * icon of the plugin it came from (written into its directory at install time). Where a subject
 * has no icon — a user-authored or zip-imported skill, an install older than the icon copy, a
 * custom plugin without an icon.svg — the mark falls back to one uniform glyph for its kind:
 * the book for a skill, the hook for a hook package, the puzzle piece for a plugin. The caller
 * names the kind through `fallback`; never a letter or a per-name mark.
 *
 * `SkillIcon` is the bare mark (inline beside a name: the composer's chips and pick list);
 * `SkillTile` is the tinted square the rows and cards lead with. An icon is a path on this
 * server, drawn as an image: one that paints itself (a brand logo's fills or gradient, or a
 * picture) stands unframed — `iconPaints` says so, the listing carries the verdict; line art
 * is a CSS mask so the page's colour paints it, exactly as an inline stroke would have, and
 * it sits in the tinted tile. Nothing is ever inlined: no `innerHTML`, no id collisions.
 */
import type { CSSProperties } from "react";
import { GlyphIcon } from "@prismshadow/penguin-ui";
import { BOOK_ICON } from "../chat/skill-use";
import { skillIconUrl } from "./skill-icon";

/**
 * Per-name tile colors (soft tinted tile + colored line-art stroke, light/dark pairs).
 * Deterministic: name-hash into the palette (user-created skills get a stable color too),
 * with a few semantic overrides for built-ins where a hue plainly fits.
 */
const SKILL_TILE_COLORS = [
  "bg-sky-50 text-sky-600 dark:bg-sky-950/60 dark:text-sky-400",
  "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400",
  "bg-violet-50 text-violet-600 dark:bg-violet-950/60 dark:text-violet-400",
  "bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400",
  "bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400",
  "bg-cyan-50 text-cyan-600 dark:bg-cyan-950/60 dark:text-cyan-400",
  "bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400",
  "bg-teal-50 text-teal-600 dark:bg-teal-950/60 dark:text-teal-400",
] as const;

/** The stroke colour a line-art icon is painted with inside its tile: the palette ink of the same index, as a background the mask reveals. */
const SKILL_INK_COLORS = [
  "bg-sky-600 dark:bg-sky-400",
  "bg-emerald-600 dark:bg-emerald-400",
  "bg-violet-600 dark:bg-violet-400",
  "bg-amber-600 dark:bg-amber-400",
  "bg-rose-600 dark:bg-rose-400",
  "bg-cyan-600 dark:bg-cyan-400",
  "bg-indigo-600 dark:bg-indigo-400",
  "bg-teal-600 dark:bg-teal-400",
] as const;

/** Semantic hue overrides (palette indices) — e.g. the firecrawl flame is amber, not whatever the hash lands on. */
const SKILL_COLOR_OVERRIDES: Record<string, number> = {
  firecrawl: 3,
  "use-firecrawl": 3,
  "data-analysis": 1,
  "web-design": 2,
  "penguin-sdk": 0,
};

export function skillPaletteIndex(name: string): number {
  const override = SKILL_COLOR_OVERRIDES[name];
  if (override !== undefined) return override;
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return h % SKILL_TILE_COLORS.length;
}

export function skillTileColor(name: string): string {
  return SKILL_TILE_COLORS[skillPaletteIndex(name)]!;
}

/** The mask's paint: the row's palette ink (the light/dark pair the tile's stroke colour pairs with). */
export function skillTileInk(name: string): string {
  return SKILL_INK_COLORS[skillPaletteIndex(name)]!;
}

/** The CSS that turns an icon URL into a silhouette the background colour paints: the SVG's own strokes and fills become the mask's alpha. */
function maskStyle(url: string): CSSProperties {
  const image = `url("${url}")`;
  return {
    maskImage: image,
    WebkitMaskImage: image,
    maskRepeat: "no-repeat",
    WebkitMaskRepeat: "no-repeat",
    maskPosition: "center",
    WebkitMaskPosition: "center",
    maskSize: "contain",
    WebkitMaskSize: "contain",
  };
}

/**
 * The bare mark, inline: the icon as an image at `size` (a mark that paints itself), the same
 * image as a mask in the text's own colour (line art — it inherits `currentColor` the way an
 * inline stroke would), or the kind's glyph (`fallback`; the book unless the subject is not a
 * skill).
 */
export function SkillIcon({
  icon,
  iconPaints,
  fallback = BOOK_ICON,
  size = 20,
  className = "",
}: {
  icon?: string;
  /** Whether the icon paints itself (a brand logo's fills or gradient); line art is masked in the text's colour. */
  iconPaints?: boolean;
  /** 24×24 line path drawn when there is no usable `icon`: the uniform mark of the subject's kind. */
  fallback?: string;
  size?: number;
  className?: string;
}) {
  const url = skillIconUrl(icon);
  if (url === null) return <GlyphIcon d={fallback} size={size} className={className} />;
  if (iconPaints) {
    return (
      <img
        src={url}
        alt=""
        style={{ width: size, height: size }}
        className={`block shrink-0 object-contain ${className}`}
      />
    );
  }
  return (
    <span
      aria-hidden
      style={{ width: size, height: size, backgroundColor: "currentColor", ...maskStyle(url) }}
      className={`block shrink-0 ${className}`}
    />
  );
}

/**
 * The tinted square a row or card leads with: the icon at `glyph` px inside a `size` px box in
 * the name's palette color, or the kind's glyph (`fallback`) when there is no usable icon. A
 * mark that paints itself stands alone — a tinted square behind it reads as a frame — so it
 * takes the whole box unframed; line art keeps the tile, masked in the palette's ink.
 * Decorative — the name beside it is the carrier.
 */
export function SkillTile({
  icon,
  iconPaints,
  name,
  fallback = BOOK_ICON,
  size = 36,
  glyph = 20,
}: {
  icon?: string;
  /** Whether the icon paints itself (a brand logo's fills or gradient); line art is tinted inside the tile. */
  iconPaints?: boolean;
  /** Names the tile's color. */
  name: string;
  /** 24×24 line path drawn without an icon: the book for a skill, the hook for a hook package, the puzzle piece for a plugin. */
  fallback?: string;
  /** Box edge in px. */
  size?: number;
  /** Icon edge in px. */
  glyph?: number;
}) {
  const url = skillIconUrl(icon);
  if (url !== null && iconPaints) {
    return <SkillIcon icon={url} iconPaints size={size} />;
  }
  return (
    // ui-glass with the tile anatomy: a theme may frost the square in its own hue (the palette
    // colour's ink is the hue); without a recipe the tinted square stays as it is.
    <span
      aria-hidden
      data-glass="tile"
      style={{ width: size, height: size }}
      className={`ui-glass flex shrink-0 items-center justify-center rounded-lg ${skillTileColor(name)}`}
    >
      <SkillIcon
        icon={icon}
        iconPaints={iconPaints}
        fallback={fallback}
        size={glyph}
        className={url !== null ? skillTileInk(name) : ""}
      />
    </span>
  );
}
