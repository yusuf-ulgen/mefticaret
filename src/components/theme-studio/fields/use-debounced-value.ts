import { useEffect, useRef, useState } from "react";

/**
 * Yazarken akıcı kalması için: yerel değer anında güncellenir, dışarıya
 * (geçmiş + önizleme) gecikmeli yazılır.
 */
export function useDebouncedField<T>(value: T, onChange: (next: T) => void, delay = 200) {
  const [local, setLocal] = useState(value);
  const dirtyRef = useRef(false);

  useEffect(() => {
    if (!dirtyRef.current) setLocal(value);
  }, [value]);

  useEffect(() => {
    if (!dirtyRef.current) return;
    const timer = window.setTimeout(() => {
      dirtyRef.current = false;
      onChange(local);
    }, delay);
    return () => window.clearTimeout(timer);
  }, [delay, local, onChange]);

  return [
    local,
    (next: T) => {
      dirtyRef.current = true;
      setLocal(next);
    },
  ] as const;
}
