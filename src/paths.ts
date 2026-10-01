import path from "node:path";
import { fileURLToPath } from "node:url";

export function projectRoot(): string {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
}

export function projectPaths(root = projectRoot()) {
  return {
    root,
    config: path.join(root, "config.json"),
    state: path.join(root, "state.json"),
    outDir: path.join(root, "out"),
  };
}
