import { createContext, useContext, type ReactNode } from "react";

export type StudioPickerProduct = { id: string; title: string; slug: string };
export type StudioPickerCollection = { id: string; title: string; slug: string };

type StudioFieldContextValue = {
  storeId: string;
  products: StudioPickerProduct[];
  collections: StudioPickerCollection[];
};

const StudioFieldContext = createContext<StudioFieldContextValue | null>(null);

/** Ayar alanlarının mağaza verisine (ürün/koleksiyon, yükleme klasörü) erişimi. */
export function StudioFieldProvider({
  value,
  children,
}: {
  value: StudioFieldContextValue;
  children: ReactNode;
}) {
  return <StudioFieldContext.Provider value={value}>{children}</StudioFieldContext.Provider>;
}

export function useStudioFieldContext() {
  return useContext(StudioFieldContext);
}
