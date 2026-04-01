import { access } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

import type { ProjectPaths } from "@presentation/domain";

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

export async function findProjectRoot(startDir = process.cwd()): Promise<string> {
  let current = resolve(startDir);

  while (true) {
    if (await pathExists(join(current, "AGENTS.md"))) {
      return current;
    }

    const parent = dirname(current);
    if (parent === current) {
      throw new Error("Could not find project root. Run the command inside the presentation repository.");
    }
    current = parent;
  }
}

export async function getProjectPaths(startDir = process.cwd()): Promise<ProjectPaths> {
  const root = await findProjectRoot(startDir);
  return {
    root,
    content: join(root, "content"),
    inbox: join(root, "content", "inbox"),
    sources: join(root, "content", "sources"),
    normalized: join(root, "content", "normalized"),
    library: join(root, "content", "library"),
    decks: join(root, "decks"),
    presets: join(root, "presets")
  };
}
