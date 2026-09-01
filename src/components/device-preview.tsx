import type { ReactNode } from "react";
import { Monitor, Smartphone, Tablet } from "lucide-react";

import { cn } from "@/lib/utils";

export type PreviewDevice = "desktop" | "tablet" | "mobile";

export const DEVICE_WIDTH: Record<PreviewDevice, number> = {
  desktop: 1280,
  tablet: 834,
  mobile: 390,
};

const DEVICES: { value: PreviewDevice; label: string; icon: typeof Monitor }[] = [
  { value: "desktop", label: "Masaüstü", icon: Monitor },
  { value: "tablet", label: "Tablet", icon: Tablet },
  { value: "mobile", label: "Mobil", icon: Smartphone },
];

/** Masaüstü / tablet / mobil önizleme seçici. */
export function DeviceSwitcher({
  value,
  onChange,
}: {
  value: PreviewDevice;
  onChange: (device: PreviewDevice) => void;
}) {
  return (
    <div className="inline-flex rounded-lg border border-border p-1">
      {DEVICES.map((device) => (
        <button
          key={device.value}
          type="button"
          onClick={() => onChange(device.value)}
          aria-pressed={value === device.value}
          className={cn(
            "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition",
            value === device.value
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <device.icon className="size-3.5" />
          <span className="hidden sm:inline">{device.label}</span>
        </button>
      ))}
    </div>
  );
}

/**
 * Seçilen cihaz genişliğinde sabit bir tuval oluşturur ve içeriği kapsayıcıya
 * sığacak şekilde ölçekler; böylece gerçek kırılma noktaları korunur.
 */
export function DeviceFrame({
  device,
  children,
}: {
  device: PreviewDevice;
  children: ReactNode;
}) {
  const width = DEVICE_WIDTH[device];
  return (
    <div className="w-full overflow-hidden rounded-xl border border-border bg-muted/30 p-3">
      <div
        className="mx-auto overflow-hidden rounded-lg bg-background shadow-sm"
        style={{ width, maxWidth: "100%" }}
      >
        <div style={{ width, maxWidth: "100%" }}>{children}</div>
      </div>
      <p className="mt-2 text-center text-[11px] text-muted-foreground">{width}px genişlik</p>
    </div>
  );
}
