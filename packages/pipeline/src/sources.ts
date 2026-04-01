import { readdir } from "node:fs/promises";
import { join } from "node:path";

import type { NormalizedDocument } from "@tiangong-ai-decks/domain";

import { getProjectPaths } from "./project.js";
import { readJson } from "./utils.js";

export async function listNormalizedDocuments(startDir = process.cwd()): Promise<NormalizedDocument[]> {
  const paths = await getProjectPaths(startDir);
  const entries = await readdir(paths.normalized, { withFileTypes: true });
  const documents = await Promise.all(
    entries
      .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
      .map((entry) => readJson<NormalizedDocument>(join(paths.normalized, entry.name)))
  );

  return documents.sort((left, right) => {
    const dateOrder = right.importedSource.archive.effectiveDate.localeCompare(left.importedSource.archive.effectiveDate);
    if (dateOrder !== 0) {
      return dateOrder;
    }

    return right.extractedAt.localeCompare(left.extractedAt);
  });
}
