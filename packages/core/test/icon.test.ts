/**
 * iconPaintsItself: the verdict the listing carries (`iconPaints`) so the page can frame an
 * icon without reading its bytes — a mark that paints itself (a brand logo: a fill beyond
 * none, a gradient, an inline style fill) stands unframed; line art (`fill="none"`,
 * `stroke="currentColor"`) paints nothing of its own and the page tints it.
 */
import { describe, expect, it } from "vitest";
import { iconPaintsItself } from "../src/plugin/icon.js";

describe("iconPaintsItself", () => {
  it("line art (fill=none, stroke=currentColor) does not paint itself", () => {
    expect(iconPaintsItself('<svg><path d="M2.5 3h6" fill="none" /></svg>')).toBe(false);
    expect(iconPaintsItself('<svg stroke="currentColor"><path d="M0 0" /></svg>')).toBe(false);
    expect(iconPaintsItself('<svg fill="none"><path d="M0 0" /></svg>')).toBe(false);
  });

  it("a brand logo paints itself: a fill beyond none, a gradient, an inline style fill", () => {
    expect(iconPaintsItself('<svg><path fill="#f05138" d="M0 0" /></svg>')).toBe(true);
    expect(iconPaintsItself('<svg><path fill="url(#a)" d="M0 0" /></svg>')).toBe(true);
    expect(iconPaintsItself("<svg><radialGradient/></svg>")).toBe(true);
    expect(iconPaintsItself('<svg><path style="fill:#00c4b3" d="M0 0" /></svg>')).toBe(true);
  });
});
