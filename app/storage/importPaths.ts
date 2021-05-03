// @ts-ignore
import * as Store from "electron-store";


const ImportPathsStore = new Store({
  name: "importPaths",
});

const KEYS = {
  IMPORT_PATH: "paths"
};
export function storeImportPaths(paths: string[]) {
  ImportPathsStore.set(KEYS.IMPORT_PATH, paths);
}

export function getImportPaths(): string[] {
  return ImportPathsStore.get(KEYS.IMPORT_PATH, [""]);
}

export function clearImportPaths() {
  return ImportPathsStore.clear();
}