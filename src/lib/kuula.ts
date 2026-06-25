export function getKuulaEmbedUrl(kuulaUrl: string): string {
  if (!kuulaUrl) return "";
  const url = kuulaUrl.trim();
  if (url.includes("?")) {
    return `${url}&logo=0&info=0&fs=1&vr=0&sd=1&thumbs=1`;
  }
  return `${url}?logo=0&info=0&fs=1&vr=0&sd=1&thumbs=1`;
}
