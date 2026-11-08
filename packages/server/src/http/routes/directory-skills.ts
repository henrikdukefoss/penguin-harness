/**
 * Skill discovery in a picked directory:
 * GET /api/projects/:p/dir-skills?path=<absolute>.
 *
 * Answers "what would importing this directory install", so Agent creation can offer the Skills a
 * checkout carries next to the built-in library ones. Reads `<path>/.agents/skills` and
 * `<path>/.claude/skills` only — it never lists or descends anything else, so it is strictly
 * narrower than the directory browsing this sits beside.
 *
 * Authorization and path handling are the `dirs` route's, deliberately: `projectId` is the anchor
 * and the caller must have access to it, the path must be absolute, and it is resolved through
 * realpath before anything is read (`requireProjectDir`, shared with that route and with the
 * create route's `skillsDirectory`). A directory carrying no Skills answers with an empty list
 * rather than an error — pointing at one is a normal thing to do.
 */
import { Hono } from "hono";
import type { DirectorySkillsResponse, SkillMetadataItem } from "../../api/types.js";
import type { AppEnv } from "../../auth/middleware.js";
import { requireProjectDir, requireValidId } from "../validate.js";

/** What this route group reaches — bound by its module (src/modules). */
export interface DirectorySkillsRouteDeps {
  access: Access;
}
import {
  discoverDirectorySkills,
  readDirectorySkillIcon,
  SKILL_SOURCE_DIRS,
  type DirectorySkillEntry,
} from "../../services/directory-skills.js";
import { toSkillItem } from "../../services/plugin-library.js";
import type { Access } from "../../mechanisms/projects.js";
import { HttpError } from "../errors.js";
import { iconFields, iconResponse } from "../icon-response.js";

export function directorySkillsRoutes(deps: DirectorySkillsRouteDeps): Hono<AppEnv> {
  const app = new Hono<AppEnv>();

  app.get("/", async (c) => {
    const projectId = requireValidId(c, "projectId");
    deps.access.requireProjectAccess(c.var.user.userId, projectId);

    const real = await requireProjectDir(c.req.query("path"));

    const skills = await discoverDirectorySkills(real);
    return c.json({
      path: real,
      // The picker needs a description, not a payload: the body and the resolved server-side
      // path are projected away by the shared allowlist, and creation re-reads the Skill from
      // disk, so a megabyte of SKILL bodies never crosses the wire and the install can never be
      // driven by a body the client made up.
      skills: skills.map((skill) => ({
        ...withIconAsPath(skill, projectId, real),
        source: skill.source,
      })),
    } satisfies DirectorySkillsResponse);
  });

  // The icon of one Skill a directory would import, served as image bytes: the listing
  // hands the page this path (the same project dir, source layout and Skill name), and the
  // page loads the image — it never inlines the markup. `path` is re-resolved through the
  // same realpath anchor the listing used, so this reads only inside the Project.
  app.get("/icon", async (c) => {
    const projectId = requireValidId(c, "projectId");
    deps.access.requireProjectAccess(c.var.user.userId, projectId);
    const real = await requireProjectDir(c.req.query("path"));
    const source = SKILL_SOURCE_DIRS.find((s) => s === c.req.query("source"));
    if (source === undefined) {
      throw new HttpError(400, "bad_request", "source must be a skill layout directory");
    }
    const skill = requireValidId(c, "skill");
    const svg = await readDirectorySkillIcon(real, source, skill);
    if (svg === undefined) {
      throw new HttpError(404, "icon_not_found", `Skill ${skill} carries no icon.svg`);
    }
    return iconResponse(c, svg);
  });

  return app;
}

/** A discovered Skill's listing item: its icon as a path back to this route group's /icon, never the SVG text. */
function withIconAsPath(
  skill: DirectorySkillEntry,
  projectId: string,
  real: string,
): SkillMetadataItem {
  const item = toSkillItem(skill);
  const url = `/api/projects/${projectId}/dir-skills/icon?path=${encodeURIComponent(real)}&source=${skill.source}&skill=${encodeURIComponent(skill.name)}`;
  return { ...item, ...iconFields(skill.icon, url) };
}
