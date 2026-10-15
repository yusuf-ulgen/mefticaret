/** XML image lists may contain spaces, commas and semicolons inside a URL. */
export function feedImageUrls(value: string): string[] {
  const decoded = value.trim().replace(/&amp;|&#0*38;|&#x0*26;/gi, "&");
  return decoded
    .split(/(?:[\r\n]+|[,;|\s]+(?=(?:https?:)?\/\/))/i)
    .map((part) => part.trim().replace(/^["'<]+|["'>]+$/g, ""))
    .flatMap((part) => {
      if (!/^(?:https?:)?\/\//i.test(part)) return [];
      try {
        const url = new URL(part.startsWith("//") ? `https:${part}` : part);
        return url.protocol === "https:" || url.protocol === "http:" ? [url.href] : [];
      } catch {
        return [];
      }
    });
}
