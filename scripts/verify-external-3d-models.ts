/**
 * Unit checks for external 3D URL normalization.
 * Usage: npx tsx scripts/verify-external-3d-models.ts
 */
import {
  EXTERNAL_3D_SUPPORTED_LIST,
  normalizeExternal3dUrl,
} from "../src/lib/external-3d-models";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

function main() {
  const cases: { input: string; expectOk: boolean; provider?: string; note: string }[] = [
    {
      input: "https://sketchfab.com/3d-models/sample-model-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      expectOk: true,
      provider: "sketchfab",
      note: "Sketchfab 3d-models slug → embed",
    },
    {
      input: "https://sketchfab.com/models/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      expectOk: true,
      provider: "sketchfab",
      note: "Sketchfab models id → embed",
    },
    {
      input: "https://my.matterport.com/show/?m=AbCdEfGhIjK",
      expectOk: true,
      provider: "matterport",
      note: "Matterport show",
    },
    {
      input: "https://poly.cam/capture/11111111-1111-1111-1111-111111111111",
      expectOk: true,
      provider: "polycam",
      note: "Polycam capture",
    },
    {
      input: "https://cloud.pix4d.com/site/123/map",
      expectOk: true,
      provider: "pix4d",
      note: "PIX4D pass-through",
    },
    {
      input: "https://cloud.agisoft.com/project/abc",
      expectOk: true,
      provider: "agisoft",
      note: "Agisoft pass-through",
    },
    {
      input: "https://www.dronedeploy.com/app2/data/abc",
      expectOk: true,
      provider: "dronedeploy",
      note: "DroneDeploy pass-through",
    },
    {
      input: "https://ion.cesium.com/assets/123",
      expectOk: true,
      provider: "cesium",
      note: "Cesium pass-through",
    },
    {
      input: "https://www.arcgis.com/home/webscene/viewer.html?webscene=abc",
      expectOk: true,
      provider: "arcgis",
      note: "ArcGIS pass-through",
    },
    { input: "https://evil.example.com/model", expectOk: false, note: "non-allowlisted" },
    { input: "javascript:alert(1)", expectOk: false, note: "javascript:" },
    { input: "data:text/html,hi", expectOk: false, note: "data:" },
    { input: "http://sketchfab.com/models/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", expectOk: false, note: "http" },
    {
      input: "https://user:pass@sketchfab.com/models/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      expectOk: false,
      note: "credentials",
    },
  ];

  for (const c of cases) {
    const r = normalizeExternal3dUrl(c.input);
    if (c.expectOk) {
      assert(r.ok, `${c.note}: expected ok for ${c.input}, got ${JSON.stringify(r)}`);
      if (r.ok) {
        assert(r.provider === c.provider, `${c.note}: provider ${r.provider} != ${c.provider}`);
        assert(r.embedUrl.startsWith("https://"), `${c.note}: embed not https`);
        console.log(`ok  ${c.note}`);
        console.log(`    in:  ${c.input}`);
        console.log(`    out: ${r.embedUrl}`);
        console.log(`    msg: ${r.message} (normalized=${r.normalized})`);
      }
    } else {
      assert(!r.ok, `${c.note}: expected reject for ${c.input}`);
      if (!r.ok) {
        assert(r.error.includes("Supported") || r.error.includes("https") || r.error.includes("password") || r.error.includes("username"), `${c.note}: weak error: ${r.error}`);
        console.log(`ok  reject ${c.note}: ${r.error.slice(0, 100)}`);
      }
    }
  }

  console.log(`\nSupported list: ${EXTERNAL_3D_SUPPORTED_LIST}`);
  console.log("verify-external-3d-models: passed");
}

main();
