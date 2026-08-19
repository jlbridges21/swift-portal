/**
 * Brand theme: Swift unchanged, pale accent stays readable, injection rejected.
 * Run: npx tsx scripts/verify-brand-theme.ts
 */
import {
  brandContrastWarnings,
  brandThemeCss,
  contrastRatio,
  deriveBrandTheme,
  isSafeCssColor,
  sanitizeCssColor,
} from "../src/lib/brand-color";

function expect(label: string, ok: boolean) {
  if (!ok) throw new Error(`fail ${label}`);
  console.log(`ok  ${label}`);
}

const swift = deriveBrandTheme("#0F172A", "#3B82F6");
expect("Swift primary stays navy", swift.primary === "rgb(15, 23, 42)");
expect("Swift accent stays blue", swift.accent === "rgb(59, 130, 246)");
expect("Swift accent foreground is white", swift.accentForeground.toLowerCase() === "#ffffff");
expect(
  "Swift has no pale-accent warning",
  !brandContrastWarnings("#0F172A", "#3B82F6").some((w) => w.message.includes("too light"))
);

const pale = deriveBrandTheme("#0F172A", "#FFF9C4");
const paleRgb = pale.accent.match(/\d+/g)!.map(Number) as [number, number, number];
expect(
  "pale accent darkened to at least 3:1 on white",
  contrastRatio(paleRgb, [255, 255, 255]) >= 3
);
expect(
  "pale accent warns in settings",
  brandContrastWarnings("#0F172A", "#FFF9C4").some((w) => w.field === "brandAccentColor")
);
const paleFg = pale.accentForeground.toLowerCase();
const fgRgb: [number, number, number] = paleFg === "#ffffff" ? [255, 255, 255] : [15, 23, 42];
expect("text on pale/darkened accent meets 3:1", contrastRatio(paleRgb, fgRgb) >= 3);

const injection = "red; } body { display:none } :root { --x:";
expect("injection is not a safe CSS color", !isSafeCssColor(injection));
expect("sanitize drops injection", sanitizeCssColor(injection, "#3B82F6") === "#3B82F6");
expect("theme CSS never includes raw injection", !brandThemeCss("#0F172A", injection).includes("display:none"));

console.log("\nAll brand theme cases passed.");
