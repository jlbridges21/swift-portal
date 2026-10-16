import JSZip from "jszip";
import { AUTHOR, BUILD_DATE } from "./brand";

export function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export const XML_HEAD = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';

export function corePropsXml(o: { title: string; subject: string; description: string; keywords: string[] }): string {
  const iso = BUILD_DATE.toISOString().replace(/\.\d{3}Z$/, "Z");
  return (
    XML_HEAD +
    '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">' +
    `<dc:title>${esc(o.title)}</dc:title>` +
    `<dc:subject>${esc(o.subject)}</dc:subject>` +
    `<dc:creator>${AUTHOR}</dc:creator>` +
    `<cp:keywords>${esc(o.keywords.join(", "))}</cp:keywords>` +
    `<dc:description>${esc(o.description)}</dc:description>` +
    `<cp:lastModifiedBy>${AUTHOR}</cp:lastModifiedBy>` +
    `<dcterms:created xsi:type="dcterms:W3CDTF">${iso}</dcterms:created>` +
    `<dcterms:modified xsi:type="dcterms:W3CDTF">${iso}</dcterms:modified>` +
    "</cp:coreProperties>"
  );
}

export function appPropsXml(application: string, title: string): string {
  return (
    XML_HEAD +
    '<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">' +
    `<Application>${esc(application)}</Application>` +
    "<DocSecurity>0</DocSecurity>" +
    "<ScaleCrop>false</ScaleCrop>" +
    `<Company>${AUTHOR}</Company>` +
    "<LinksUpToDate>false</LinksUpToDate>" +
    "<SharedDoc>false</SharedDoc>" +
    "<HyperlinksChanged>false</HyperlinksChanged>" +
    "<AppVersion>16.0000</AppVersion>" +
    `<TitlesOfParts><vt:vector size="1" baseType="lpstr"><vt:lpstr>${esc(title)}</vt:lpstr></vt:vector></TitlesOfParts>` +
    "</Properties>"
  );
}

/** Zips parts in the given order ([Content_Types].xml first) with fixed timestamps. */
export async function zipParts(parts: Array<[string, string]>): Promise<Uint8Array> {
  const zip = new JSZip();
  for (const [name, content] of parts) {
    zip.file(name, content, { date: BUILD_DATE, createFolders: false });
  }
  return zip.generateAsync({
    type: "uint8array",
    compression: "DEFLATE",
    compressionOptions: { level: 9 },
    mimeType: "application/zip",
  });
}
