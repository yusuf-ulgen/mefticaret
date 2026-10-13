export type DocumentLocale = "tr" | "en" | "de" | "fr" | "ar";
export function documentLocale(pathname: string, search = ""): DocumentLocale {
  const prefix = pathname.split("/")[1];
  if (prefix && ["tr", "en", "de", "fr", "ar"].includes(prefix)) return prefix as DocumentLocale;
  const requested = new URLSearchParams(search).get("locale");
  return requested && ["tr", "en", "de", "fr", "ar"].includes(requested)
    ? (requested as DocumentLocale)
    : "tr";
}
