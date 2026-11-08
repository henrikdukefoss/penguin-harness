/**
 * What an index entry names at a URL: its icon and its readme. The index format carries
 * both as `https://` locations (see the index repository's docs/manifest.md), and a
 * deployment's server is the one that fetches them — the Web App draws an icon as an image
 * (`<img>` or a CSS mask, never inline markup) and a readme as text, so the bytes have to
 * pass through here first: an icon that is not a plain SVG costs the icon, never the page,
 * the same rule core's reader applies to a package's own icon.svg, and a readme is capped
 * like any fetched document.
 *
 * Nothing in the listing waits: an icon already in hand fills the entry's card at once,
 * one still out is started and answers on a later page load (`hydrate` starts them). The
 * readme route may wait — it is the one entry someone opened. A fetch that fails, or an
 * answer that will not do, is remembered as none, like a package that ships neither file.
 *
 * Reads are keyed by URL, so two entries that share an asset read it once, and a moved
 * URL reads again rather than serving the old bytes under the new address.
 */
import {
  iconPaintsItself,
  isSafeIconSvg,
  MAX_PLUGIN_ICON_BYTES,
  svgFromRoot,
  userAgent,
} from "@prismshadow/penguin-core";
import type { PluginIndexEntry } from "../api/types.js";

const READ_TIMEOUT_MS = 30_000;
/** A readme is long-form documentation, not an archive: one megabyte is generous. */
const MAX_README_BYTES = 1024 * 1024;

/** An https URL — the only kind an index entry may name at a deployment's server. */
function isHttpsUrl(value: unknown): value is string {
  return typeof value === "string" && value.startsWith("https://");
}

export interface IndexMedia {
  /**
   * The icon in hand as image bytes — a picture under its own `Content-Type`, a safe SVG as
   * `image/svg+xml` — or undefined while a read is out (or ended in nothing). The listing
   * hands the page a path to the `/icon` route when this answers.
   */
  inHandImage(entry: PluginIndexEntry): { bytes: Uint8Array; type: string } | undefined;
  /**
   * Whether the icon in hand paints itself — a brand logo's fills or gradient, or a picture —
   * so the page stands it unframed; false (line art) and the page tints it inside the tile.
   * Undefined with no icon in hand.
   */
  inHandPainted(entry: PluginIndexEntry): boolean | undefined;
  /**
   * The readme at the entry's `readme` URL — or, for a Chinese reader, the `readmeZh` URL
   * when the entry names one — fetching what is not in hand; null when there is none to read.
   */
  readme(entry: PluginIndexEntry, lang?: "en" | "zh"): Promise<string | null>;
  /** Starts the reads still out, so a later page load draws the cards. */
  hydrate(entries: readonly PluginIndexEntry[]): void;
}

/** What one URL said: a safe SVG (its text and whether it paints itself), a picture this server
 * serves onward (its `Content-Type` said `image/*` and not svg), the readme text, or nothing. */
type Media =
  | { kind: "icon"; text: string; paints: boolean }
  | { kind: "icon-image"; bytes: Uint8Array; type: string }
  | { kind: "readme"; text: string }
  | { kind: "none" };

export function indexMedia({ fetchImpl = fetch }: { fetchImpl?: typeof fetch } = {}): IndexMedia {
  // `promises` hands a read already out to a second caller; `inHand` keeps the answer once
  // it landed, which the listing reads without waiting.
  const promises = new Map<string, Promise<Media>>();
  const inHand = new Map<string, Media>();

  async function read(kind: "icon" | "readme", url: string): Promise<Media> {
    let res: Awaited<ReturnType<typeof fetch>>;
    try {
      res = await fetchImpl(url, {
        headers: { "user-agent": userAgent() },
        redirect: "follow",
        signal: AbortSignal.timeout(READ_TIMEOUT_MS),
      });
    } catch {
      return { kind: "none" };
    }
    if (!res.ok) return { kind: "none" };
    // What the URL serves is its own metadata: a `Content-Type` of image other than svg is
    // a picture — the bytes are read here so the page loads the image from this server,
    // never from the outside. Anything else that names an icon is an SVG, read for its safe
    // text and served on as `image/svg+xml` bytes — the page loads it as an image too, it
    // never inlines the markup.
    const type = (res.headers.get("content-type") ?? "").toLowerCase();
    const size = Number(res.headers.get("content-length") ?? "");
    const max = kind === "icon" ? MAX_PLUGIN_ICON_BYTES : MAX_README_BYTES;
    if (kind === "icon" && type.startsWith("image/") && !type.includes("svg")) {
      const bytes = new Uint8Array(await res.arrayBuffer().catch(() => new Uint8Array(0)));
      if (bytes.byteLength === 0 || bytes.byteLength > max) return { kind: "none" };
      return { kind: "icon-image", bytes, type };
    }
    if (Number.isFinite(size) && size > max) return { kind: "none" };
    const text = await res.text().catch(() => null);
    if (text === null || text.length > max) return { kind: "none" };
    // An icon fetched over a URL is normalized to its root element the same way a package's
    // own icon.svg is, and it travels as image bytes, so the same safety read applies.
    if (kind === "icon") {
      if (!isSafeIconSvg(text)) return { kind: "none" };
      const svg = svgFromRoot(text);
      return { kind, text: svg, paints: iconPaintsItself(svg) };
    }
    return { kind, text };
  }

  const readOnce = (kind: "icon" | "readme", url: string): Promise<Media> => {
    const key = `${kind}|${url}`;
    const cached = promises.get(key);
    if (cached !== undefined) return cached;
    const out = read(kind, url)
      .catch((): Media => ({ kind: "none" }))
      .then((media) => {
        inHand.set(key, media);
        return media;
      });
    promises.set(key, out);
    return out;
  };

  return {
    /** The icon in hand as image bytes: a picture as its own type arrived, a safe SVG as `image/svg+xml`. Undefined while a read is out (or ended in nothing). */
    inHandImage(entry) {
      if (!isHttpsUrl(entry.icon)) return undefined;
      const media = inHand.get(`icon|${entry.icon}`);
      if (media?.kind === "icon-image") return { bytes: media.bytes, type: media.type };
      if (media?.kind === "icon") {
        return { bytes: Buffer.from(media.text, "utf8"), type: "image/svg+xml" };
      }
      return undefined;
    },
    /** Whether the icon in hand paints itself (a brand logo, a picture) — true for a picture by definition. Undefined with no icon in hand. */
    inHandPainted(entry) {
      if (!isHttpsUrl(entry.icon)) return undefined;
      const media = inHand.get(`icon|${entry.icon}`);
      if (media?.kind === "icon-image") return true;
      if (media?.kind === "icon") return media.paints;
      return undefined;
    },
    async readme(entry, lang) {
      const url = lang === "zh" ? (entry.readmeZh ?? entry.readme) : entry.readme;
      if (!isHttpsUrl(url)) return null;
      const media = await readOnce("readme", url);
      return media.kind === "readme" ? media.text : null;
    },
    hydrate(entries) {
      for (const entry of entries) {
        if (!isHttpsUrl(entry.icon)) continue;
        if (inHand.has(`icon|${entry.icon}`)) continue;
        void readOnce("icon", entry.icon);
      }
    },
  };
}
