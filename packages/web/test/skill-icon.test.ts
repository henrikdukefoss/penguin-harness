/**
 * skillIconUrl unit tests: the page never draws inline markup, so the only
 * check left on the web side is the shape of the icon value — it must be a
 * path on this server (same-origin, no scheme, no protocol-relative `//`, no
 * whitespace or markup). Anything else returns null and the caller draws the
 * kind's glyph.
 */
import { describe, expect, it } from "vitest";
import { skillIconUrl } from "../src/features/skills/skill-icon";

describe("skillIconUrl", () => {
  it("a path on this server passes through (trimmed)", () => {
    const path = "/api/plugins/registry/icon?name=%40penguinharness%2Flanguage-typst";
    expect(skillIconUrl(path)).toBe(path);
    expect(skillIconUrl(`  ${path}  `)).toBe(path);
    expect(skillIconUrl("/api/projects/p1/agents/a1/plugins/skills/x/icon")).toBe(
      "/api/projects/p1/agents/a1/plugins/skills/x/icon",
    );
  });

  it("missing / empty / whitespace-only falls back to null", () => {
    expect(skillIconUrl(undefined)).toBeNull();
    expect(skillIconUrl(null)).toBeNull();
    expect(skillIconUrl("")).toBeNull();
    expect(skillIconUrl("   ")).toBeNull();
  });

  it("no scheme, no protocol-relative, no foreign origins", () => {
    expect(skillIconUrl("https://assets.example/p/icon.png")).toBeNull();
    expect(skillIconUrl("http://assets.example/p/icon.png")).toBeNull();
    expect(skillIconUrl("//assets.example/p/icon.png")).toBeNull();
    expect(skillIconUrl("data:image/svg+xml,%3Csvg%3E")).toBeNull();
    expect(skillIconUrl("javascript:alert(1)")).toBeNull();
  });

  it("no markup or whitespace smuggled into the path", () => {
    expect(skillIconUrl("/api/x?name=y<script>")).toBeNull();
    expect(skillIconUrl("/api/x?name=y<img src=x>")).toBeNull();
    expect(skillIconUrl("/api/plugins/registry/icon extra")).toBeNull();
    expect(skillIconUrl('<svg><path d="M0 0"/></svg>')).toBeNull();
  });
});
