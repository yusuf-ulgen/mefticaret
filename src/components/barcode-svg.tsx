import { useMemo } from "react";

import { barcodeBars, barcodeWidth, encodeCode128B } from "@/lib/barcode";

export function BarcodeSvg({
  value,
  height = 44,
  moduleWidth = 2,
}: {
  value: string;
  height?: number;
  moduleWidth?: number;
}) {
  const { bars, width } = useMemo(() => {
    const modules = encodeCode128B(value);
    return { bars: barcodeBars(modules, moduleWidth), width: barcodeWidth(modules, moduleWidth) };
  }, [value, moduleWidth]);

  if (width === 0) return null;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      height={height}
      preserveAspectRatio="none"
      role="img"
      aria-label={`Barkod ${value}`}
    >
      <rect x={0} y={0} width={width} height={height} fill="#fff" />
      {bars.map((bar) => (
        <rect key={bar.x} x={bar.x} y={0} width={bar.width} height={height} fill="#000" />
      ))}
    </svg>
  );
}
