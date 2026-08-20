/**
 * Brand theme: Swift unchanged, pale accent stays readable, injection rejected.
 * Run: npx tsx scripts/verify-brand-theme.ts
 */
import {
  brandContrastWarnings,
  brandThemeCss,
  contrastRatio,
  deriveBrandTheme,
  isSafeBrandAssetUrl,
  isSafeCssColor,
  sanitizeCssColor,
  themeContrastPairs,
} from "../src/lib/brand-color";

function expect(label: string, ok: boolean) {
  if (!ok) throw new Error(`fail ${label}`);
  console.log(`ok  ${label}`);
}

const swift = deriveBrandTheme("#0F172A", "#3B82F6");
expect("Swift primary stays navy", swift.primary === "rgb(15, 23, 42)");
expect("Swift accent stays blue", swift.accent === "rgb(59, 130, 246)");
expect("Swift accent foreground is white", swift.accentForeground.toLowerCase() === "#ffffff");
expect("Swift page background stays Cloud", swift.background.toLowerCase() === "#f8fafc");
expect("Swift card stays white", swift.card.toLowerCase() === "#ffffff");
expect("Swift border stays Slate 200", swift.border.toLowerCase() === "#e2e8f0");
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

const samples: { label: string; primary: string; accent: string }[] = [
  { label: "#000000", primary: "#0F172A", accent: "#000000" },
  { label: "#FFFFFF", primary: "#0F172A", accent: "#FFFFFF" },
  { label: "#FFF9C4", primary: "#0F172A", accent: "#FFF9C4" },
  { label: "#0F172A", primary: "#0F172A", accent: "#0F172A" },
  { label: "#4F46E5 (saturated mid)", primary: "#0F172A", accent: "#4F46E5" },
];

for (const sample of samples) {
  const theme = deriveBrandTheme(sample.primary, sample.accent);
  const pairs = themeContrastPairs(theme);
  const failed = pairs.filter((p) => !p.ok);
  const raw = sample.accent.toLowerCase();
  expect(
    `${sample.label}: page background is not the raw brand color`,
    theme.background.toLowerCase() !== raw && !theme.background.toLowerCase().includes("0, 0, 0)")
  );
  expect(`${sample.label}: contrast pairs pass`, failed.length === 0);
  console.log(`\nPalette ${sample.label} (primary ${sample.primary} / accent ${sample.accent})`);
  console.log(
    JSON.stringify(
      {
        background: theme.background,
        card: theme.card,
        subtle: theme.subtle,
        border: theme.border,
        foreground: theme.foreground,
        muted: theme.muted,
        heading: theme.heading,
        accent: theme.accent,
        accentForeground: theme.accentForeground,
        contrasts: pairs.map((p) => `${p.pair} ${p.ratio.toFixed(2)}:1 (min ${p.min})`),
      },
      null,
      2
    )
  );
}

const injection = "red; } body { display:none } :root { --x:";
expect("injection is not a safe CSS color", !isSafeCssColor(injection));
expect("sanitize drops injection", sanitizeCssColor(injection, "#3B82F6") === "#3B82F6");
expect("theme CSS never includes raw injection", !brandThemeCss("#0F172A", injection).includes("display:none"));

expect("https logo URL is allowed", isSafeBrandAssetUrl("https://cdn.example.com/logo.png"));
expect("relative logo path is allowed", isSafeBrandAssetUrl("/icons/sp-app-icon.png"));
expect("javascript: logo URL is rejected", !isSafeBrandAssetUrl("javascript:alert(1)"));
expect("quoted/CSS logo URL is rejected", !isSafeBrandAssetUrl(`https://x.com/x.png" onerror="alert(1)`));

console.log("\nAll brand theme cases passed.");
