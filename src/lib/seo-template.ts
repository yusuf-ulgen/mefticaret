import type { SeoTemplate } from "@/lib/seo";

export type SeoTemplateVariables = Record<string, string | number | null | undefined>;

export function interpolateSeoTemplate(template: string | undefined, variables: SeoTemplateVariables) {
  if (!template) return "";
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key: string) => {
    const value = variables[key];
    return value === null || value === undefined ? "" : String(value);
  }).replace(/\s+/g, " ").trim();
}

export function resolveSeoTemplate(template: SeoTemplate | undefined, variables: SeoTemplateVariables) {
  return {
    title: interpolateSeoTemplate(template?.title, variables),
    description: interpolateSeoTemplate(template?.description, variables),
  };
}
