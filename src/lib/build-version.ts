declare const __MEFTI_RELEASE__: string;
/** Derlenen dosyaya gömülür; eski sekme kendi sürümünü raporlar. */
export const APP_RELEASE =
  typeof __MEFTI_RELEASE__ === "string" ? __MEFTI_RELEASE__ : "development";
