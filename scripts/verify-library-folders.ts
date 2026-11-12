/**
 * Media Library folders — pure-logic checks (no database).
 * Run: npm run test:library-folders
 */
import assert from "node:assert/strict";
import {
  LIBRARY_FOLDER_NAME_MAX,
  folderItemCountLabel,
  libraryItemColumn,
  libraryItemKey,
  normalizeLibraryFolderName,
  parseLibraryItemRef,
  sortLibraryFolders,
  type LibraryFolderSummary,
} from "../src/lib/library-folder-types";
import { sharedItemUrl } from "../src/lib/shared-media-types";

let passed = 0;
function check(name: string, fn: () => void) {
  fn();
  passed += 1;
  console.log(`  ✓ ${name}`);
}

const UUID = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";

console.log("library-folder-types");

check("folder names are trimmed and inner whitespace collapsed", () => {
  assert.deepEqual(normalizeLibraryFolderName("  Aerial   Shots \n"), { name: "Aerial Shots" });
});

check("empty / non-string / too-long names are rejected", () => {
  assert.ok("error" in normalizeLibraryFolderName("   "));
  assert.ok("error" in normalizeLibraryFolderName(42));
  assert.ok("error" in normalizeLibraryFolderName("x".repeat(LIBRARY_FOLDER_NAME_MAX + 1)));
  assert.deepEqual(normalizeLibraryFolderName("x".repeat(LIBRARY_FOLDER_NAME_MAX)), { name: "x".repeat(LIBRARY_FOLDER_NAME_MAX) });
});

check("item refs parse from 'kind:id' and {kind,id}", () => {
  assert.deepEqual(parseLibraryItemRef(`photo:${UUID}`), { kind: "photo", id: UUID });
  assert.deepEqual(parseLibraryItemRef({ kind: "tour", id: UUID }), { kind: "tour", id: UUID });
  assert.equal(libraryItemKey({ kind: "model", id: UUID }), `model:${UUID}`);
});

check("malformed refs are rejected (unknown kind, bad uuid, injection)", () => {
  assert.equal(parseLibraryItemRef(`folder:${UUID}`), null);
  assert.equal(parseLibraryItemRef("photo:not-a-uuid"), null);
  assert.equal(parseLibraryItemRef(`photo:${UUID},project_id.eq.x`), null);
  assert.equal(parseLibraryItemRef(UUID), null);
  assert.equal(parseLibraryItemRef(null), null);
});

check("each kind maps to the right membership column", () => {
  assert.equal(libraryItemColumn("photo"), "media_asset_id");
  assert.equal(libraryItemColumn("video"), "media_asset_id");
  assert.equal(libraryItemColumn("document"), "media_asset_id");
  assert.equal(libraryItemColumn("tour"), "tour_id");
  assert.equal(libraryItemColumn("model"), "model_id");
});

const f = (name: string, itemCount: number, updatedAt: string): LibraryFolderSummary => ({
  id: name,
  name,
  itemCount,
  coverAssetId: null,
  coverMode: "auto",
  createdAt: updatedAt,
  updatedAt,
  share: { link: false, people: 0 },
});
const folders = [f("b roll", 3, "2026-11-01"), f("Aerial 10", 12, "2026-11-03"), f("Aerial 9", 12, "2026-11-02")];

check("folder sorts: natural name order, updated, most items", () => {
  assert.deepEqual(sortLibraryFolders(folders, "name_asc").map((x) => x.name), ["Aerial 9", "Aerial 10", "b roll"]);
  assert.deepEqual(sortLibraryFolders(folders, "name_desc").map((x) => x.name), ["b roll", "Aerial 10", "Aerial 9"]);
  assert.deepEqual(sortLibraryFolders(folders, "updated").map((x) => x.name), ["Aerial 10", "Aerial 9", "b roll"]);
  assert.deepEqual(sortLibraryFolders(folders, "items").map((x) => x.name), ["Aerial 9", "Aerial 10", "b roll"]);
  assert.equal(folders[0].name, "b roll", "sorting must not mutate the input");
});

check("item count labels", () => {
  assert.equal(folderItemCountLabel(1), "1 item");
  assert.equal(folderItemCountLabel(1240), "1,240 items");
});

console.log("shared-media-types");

check("public item URLs encode the token and key", () => {
  assert.equal(
    sharedItemUrl("a/b", `photo:${UUID}`, "thumb"),
    `/api/public/shared/a%2Fb?item=photo%3A${UUID}&variant=thumb`
  );
});

console.log(`\n${passed} checks passed`);
