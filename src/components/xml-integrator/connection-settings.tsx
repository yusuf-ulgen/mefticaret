/**
 * Besleme bağlantı türü ayarları: adres, FTP, SFTP veya webhook.
 * FTP şifresi kayıtlıysa boş bırakılır; boş gönderim kayıtlı şifreyi korur.
 */

import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, Copy, Globe, Loader2, Lock, PlugZap, Server, Zap } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  CONNECTION_TYPES,
  CONNECTION_TYPE_HINTS,
  CONNECTION_TYPE_LABELS,
  DEFAULT_PORTS,
  type ConnectionType,
  type FtpConfig,
} from "@/lib/xml-connection";
import { testFeedConnection } from "@/lib/xml-integrator.functions";

const TYPE_ICONS: Record<ConnectionType, typeof Globe> = {
  url: Globe,
  ftp: Server,
  sftp: Lock,
  webhook: Zap,
};

export function ConnectionSettings({
  idPrefix = "conn",
  storeId,
  feedId,
  connectionType,
  ftpConfig,
  hasFtpPassword,
  webhookUrl,
  onConnectionTypeChange,
  onFtpConfigChange,
}: {
  idPrefix?: string | undefined;
  storeId: string;
  feedId?: string | undefined;
  connectionType: ConnectionType;
  ftpConfig: FtpConfig;
  hasFtpPassword?: boolean | undefined;
  webhookUrl?: string | null | undefined;
  onConnectionTypeChange: (next: ConnectionType) => void;
  onFtpConfigChange: (next: FtpConfig) => void;
}) {
  const [copied, setCopied] = useState(false);
  const setField = <K extends keyof FtpConfig>(key: K, value: FtpConfig[K]) =>
    onFtpConfigChange({ ...ftpConfig, [key]: value });

  const isFtp = connectionType === "ftp" || connectionType === "sftp";

  const test = useServerFn(testFeedConnection);
  const testMutation = useMutation({
    mutationFn: () =>
      test({ data: { storeId, ...(feedId ? { feedId } : {}), connectionType, ftpConfig } }),
    onSuccess: (result) => {
      const kb = Math.max(1, Math.round(result.bytes / 1024));
      toast.success(`Bağlantı başarılı — dosya indirildi (${kb} KB, ${result.durationMs} ms)`);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  /** Tür değişince portu o türün varsayılanına çeker (kullanıcı değiştirmediyse). */
  const changeType = (next: ConnectionType) => {
    onConnectionTypeChange(next);
    const currentIsDefault = Object.values(DEFAULT_PORTS).includes(ftpConfig.port);
    if ((next === "ftp" || next === "sftp") && currentIsDefault) {
      onFtpConfigChange({ ...ftpConfig, port: DEFAULT_PORTS[next] });
    }
  };

  return (
    <section className="space-y-3 rounded-xl border bg-card p-4">
      <div className="space-y-2">
        <Label>Dosya nereden gelecek?</Label>
        <div role="radiogroup" aria-label="Bağlantı yöntemi" className="grid gap-2 sm:grid-cols-2">
          {CONNECTION_TYPES.map((item) => {
            const Icon = TYPE_ICONS[item];
            const active = connectionType === item;
            return (
              <button
                key={item}
                type="button"
                role="radio"
                aria-checked={active}
                id={`${idPrefix}-type-${item}`}
                onClick={() => changeType(item)}
                className={`flex items-start gap-3 rounded-lg border p-3 text-left transition ${
                  active ? "border-foreground bg-muted/50" : "hover:bg-muted/30"
                }`}
              >
                <Icon className={`mt-0.5 size-4 shrink-0 ${active ? "text-foreground" : "text-muted-foreground"}`} />
                <span className="min-w-0">
                  <span className="block text-sm font-medium">{CONNECTION_TYPE_LABELS[item]}</span>
                  <span className="block text-xs text-muted-foreground">{CONNECTION_TYPE_HINTS[item]}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {connectionType === "sftp" ? (
        <p className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive">
          SFTP (SSH) bağlantısı bu ortamda kurulamıyor. Tedarikçiden normal FTP erişimi ya da bir
          indirme adresi isteyin; alternatif olarak webhook seçeneğiyle dosyayı size gönderebilirler.
        </p>
      ) : null}

      {isFtp ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor={`${idPrefix}-host`}>Sunucu adresi</Label>
              <Input
                id={`${idPrefix}-host`}
                value={ftpConfig.host}
                onChange={(event) => setField("host", event.target.value)}
                placeholder="ftp.tedarikci.com"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor={`${idPrefix}-port`}>Port</Label>
              <Input
                id={`${idPrefix}-port`}
                type="number"
                value={ftpConfig.port}
                onChange={(event) =>
                  setField("port", Number(event.target.value) || DEFAULT_PORTS[connectionType])
                }
              />
              <p className="text-xs text-muted-foreground">
                Varsayılan: FTP 21 · SFTP 22
              </p>
            </div>
            <div className="space-y-1">
              <Label htmlFor={`${idPrefix}-user`}>Kullanıcı adı</Label>
              <Input
                id={`${idPrefix}-user`}
                value={ftpConfig.username}
                onChange={(event) => setField("username", event.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor={`${idPrefix}-pass`}>Şifre</Label>
              <Input
                id={`${idPrefix}-pass`}
                type="password"
                value={ftpConfig.password}
                placeholder={hasFtpPassword ? "Kayıtlı — değiştirmek için yazın" : ""}
                onChange={(event) => setField("password", event.target.value)}
              />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor={`${idPrefix}-path`}>Dosya yolu</Label>
              <Input
                id={`${idPrefix}-path`}
                value={ftpConfig.filePath}
                onChange={(event) => setField("filePath", event.target.value)}
                placeholder="/public_html/exports/products.xml"
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3 text-sm">
              <Label htmlFor={`${idPrefix}-passive`}>Pasif mod</Label>
              <Switch
                id={`${idPrefix}-passive`}
                checked={ftpConfig.passive}
                onCheckedChange={(checked) => setField("passive", checked)}
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3 text-sm">
              <Label htmlFor={`${idPrefix}-ssl`}>SSL/TLS kullan</Label>
              <Switch
                id={`${idPrefix}-ssl`}
                checked={ftpConfig.ssl}
                onCheckedChange={(checked) => setField("ssl", checked)}
              />
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={testMutation.isPending || !ftpConfig.host || !ftpConfig.username}
            onClick={() => testMutation.mutate()}
          >
            {testMutation.isPending ? (
              <Loader2 className="mr-1 size-4 animate-spin" />
            ) : (
              <PlugZap className="mr-1 size-4" />
            )}
            FTP bağlantısını dene ve dosyayı indir
          </Button>
          {testMutation.data ? (
            <div className="rounded-lg border border-success/40 bg-success/5 p-3 text-xs">
              <p className="font-medium text-success">
                Bağlantı başarılı · {testMutation.data.filePath} ·{" "}
                {Math.max(1, Math.round(testMutation.data.bytes / 1024))} KB
              </p>
              <pre className="mt-2 max-h-28 overflow-auto whitespace-pre-wrap break-all text-muted-foreground">
                {testMutation.data.preview}
              </pre>
            </div>
          ) : null}
          {testMutation.error ? (
            <p className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive">
              {testMutation.error.message}
            </p>
          ) : null}
        </>
      ) : null}

      {connectionType === "webhook" ? (
        <div className="space-y-2">
          <Label>Tedarikçiye verilecek gönderim adresi</Label>
          {webhookUrl ? (
            <div className="flex flex-wrap items-center gap-2">
              <code className="min-w-0 flex-1 truncate rounded-md border bg-muted/40 px-2 py-1.5 text-xs">
                {webhookUrl}
              </code>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={async () => {
                  await navigator.clipboard.writeText(webhookUrl);
                  setCopied(true);
                  toast.success("Adres kopyalandı");
                }}
              >
                {copied ? <Check className="mr-1 size-4" /> : <Copy className="mr-1 size-4" />}
                Kopyala
              </Button>
            </div>
          ) : (
            <Badge variant="secondary">Besleme kaydedildikten sonra adres burada görünür</Badge>
          )}
          <div className="rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">
            <p className="font-medium text-foreground">Tedarikçi sisteminde nasıl ayarlanır?</p>
            <p className="mt-1">
              Stok veya fiyat değiştiğinde bu adrese POST isteği göndermesini isteyin. Dosyayı istek
              gövdesinde gönderirse o içerik aktarılır; gövdesi boş bir istek gönderirse beslemenin
              kayıtlı kaynağından indirme başlar.
            </p>
            <p className="mt-1">Adresi gizli tutun; paylaşıldığında beslemeye dosya gönderilebilir.</p>
          </div>
        </div>
      ) : null}
    </section>
  );
}
