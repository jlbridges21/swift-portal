/** Dev helper: renders every page of the generated PDFs to PNG via QuickLook. Usage: npx tsx scripts/resources/render-pages.ts <outDir> [filter] */
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { PDFDocument } from "pdf-lib";

async function main() {
  const out = process.argv[2];
  const filter = process.argv[3] ?? "";
  const dir = path.resolve(__dirname, "../../public/resources/files");
  mkdirSync(out, { recursive: true });
  for (const f of readdirSync(dir).filter((n) => n.endsWith(".pdf") && n.includes(filter))) {
    const src = await PDFDocument.load(readFileSync(path.join(dir, f)));
    for (let i = 0; i < src.getPageCount(); i++) {
      const one = await PDFDocument.create();
      const [p] = await one.copyPages(src, [i]);
      one.addPage(p);
      const name = path.join(out, `${f.replace(/\.pdf$/, "")}-p${i + 1}.pdf`);
      writeFileSync(name, await one.save());
      execFileSync("qlmanage", ["-t", "-s", "1100", "-o", out, name], { stdio: "ignore" });
    }
  }
}
main();
