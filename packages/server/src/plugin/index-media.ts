/**
 * What an index entry names at a URL: its icon and its readme. The index format carries
 * both as `https://` locations (see the index repository's docs/manifest.md), and a
 * deployment's server is the one that fetches them — the Web App renders an icon by
 * inlining SVG text and a readme as text, so the bytes have to pass through here first:
 * an icon that is not a plain SVG costs the icon, never the page, the same rule core's
 * reader applies to a package's own icon.svg, and a readme is capped like any fetched
 * document.
 *
 * Nothing in the listing waits: an icon already in hand fills the entry's card at once,
 * one still out is started and answers on a later page load (`hydrate` starts them). The
 * readme route may wait — it is the one entry someone opened. A fetch that fails, or an
 * answer that will not do, is remembered as none, like a package that ships neither file.
 *
 * Reads are keyed by URL, so two entries that share an asset read it once, and a moved
 * URL reads again rather than serving the old bytes under the new address.
 */
import { isSafeIconSvg, MAX_PLUGIN_ICON_BYTES, userAgent } from "@prismshadow/penguin-core";
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
   * The icon in hand for the entry's `icon` URL — fetched text that passed the SVG safety
   * read — or undefined while a read is out (or ended in nothing).
   */
  inHandIcon(entry: PluginIndexEntry): string | undefined;
  /**
   * The readme at the entry's `readme` URL, fetching what is not in hand; null when there
   * is none to read.
   */
  readme(entry: PluginIndexEntry): Promise<string | null>;
  /** Starts the reads still out, so a later page load draws the cards. */
  hydrate(entries: readonly PluginIndexEntry[]): void;
}

/** What one URL said: the icon text once it passed the safety read, or the readme text. */
type Media = { kind: "icon"; text: string } | { kind: "readme"; text: string } | { kind: "none" };

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
    const size = Number(res.headers.get("content-length") ?? "");
    const max = kind === "icon" ? MAX_PLUGIN_ICON_BYTES : MAX_README_BYTES;
    if (Number.isFinite(size) && size > max) return { kind: "none" };
    const text = await res.text().catch(() => null);
    if (text === null || text.length > max) return { kind: "none" };
    if (kind === "icon" && !isSafeIconSvg(text)) return { kind: "none" };
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
    inHandIcon(entry) {
      if (!isHttpsUrl(entry.icon)) return undefined;
      const media = inHand.get(`icon|${entry.icon}`);
      return media?.kind === "icon" ? media.text : undefined;
    },
    async readme(entry) {
      if (!isHttpsUrl(entry.readme)) return null;
      const media = await readOnce("readme", entry.readme);
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
