declare const __MEFTI_RELEASE__: string;
declare const __MEFTI_BUILD__: {
  commit: string | null;
  builtAt: string;
  dirty: boolean;
};

/** The same immutable build metadata is embedded in the browser and SSR bundles. */
const EMBEDDED_BUILD =
  typeof __MEFTI_BUILD__ === "object"
    ? __MEFTI_BUILD__
    : { commit: null, builtAt: "development", dirty: false };

export const APP_BUILD = { ...EMBEDDED_BUILD, dirty: EMBEDDED_BUILD.dirty || import.meta.env.DEV };
/** Derlenen dosyaya gömülür; eski sekme kendi sürümünü raporlar. */
export const APP_RELEASE =
  typeof __MEFTI_RELEASE__ === "string" ? __MEFTI_RELEASE__ : "development";
