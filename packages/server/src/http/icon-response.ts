/**
 * Serving an icon as image bytes: the one shape an icon may take on the wire. The Web App
 * draws an icon as an image (`<img>`, or a CSS mask where the page tints it) and never
 * inlines the markup, so every icon route ends here — the SVG's text (safety-read, capped,
 * normalized to its root element) goes out as `image/svg+xml`, flagged `nosniff` so the
 * browser never reinterprets it, and cached briefly so a page of cards costs one request
 * per icon rather than one per render.
 */
import type { Context } from "hono";
import { iconPaintsItself } from "@prismshadow/penguin-core";
import type { AppEnv } from "../auth/middleware.js";

/** `image/svg+xml` headers for an icon body: nosniff, and a short private cache. */
export function iconResponse(c: Context<AppEnv>, svg: string): Response {
  return c.body(Buffer.from(svg, "utf8") as unknown as Uint8Array<ArrayBuffer>, 200, {
    "content-type": "image/svg+xml",
    "x-content-type-options": "nosniff",
    "cache-control": "private, max-age=300",
  });
}

/** The icon fields a listing row carries for an icon in hand: the path that serves it, and whether it paints itself (a brand logo) or is line art the page tints. */
export function iconFields(
  svg: string | undefined,
  url: string,
): { icon?: string; iconPaints?: boolean } {
  if (svg === undefined) return {};
  return { icon: url, iconPaints: iconPaintsItself(svg) };
}
