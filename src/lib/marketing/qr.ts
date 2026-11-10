/**
 * QR codes for the print flyer, as an SVG data URI. Pure and synchronous, so the browser
 * preview and the server export (Satori) draw the identical code.
 */
import QRCode from "qrcode";

function base64(text: string): string {
  if (typeof Buffer !== "undefined") return Buffer.from(text, "utf8").toString("base64");
  return btoa(unescape(encodeURIComponent(text)));
}

export function qrSvgDataUri(text: string, dark = "#111111", light = "#FFFFFF"): string | null {
  if (!text) return null;
  try {
    const qr = QRCode.create(text, { errorCorrectionLevel: "M" });
    const n = qr.modules.size;
    const quiet = 2;
    const dim = n + quiet * 2;
    let path = "";
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        if (qr.modules.get(y, x)) path += `M${x + quiet} ${y + quiet}h1v1h-1z`;
      }
    }
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${dim} ${dim}" shape-rendering="crispEdges"><rect width="${dim}" height="${dim}" fill="${light}"/><path d="${path}" fill="${dark}"/></svg>`;
    return `data:image/svg+xml;base64,${base64(svg)}`;
  } catch {
    return null;
  }
}
