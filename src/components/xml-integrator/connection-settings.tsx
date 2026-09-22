/**
 * Besleme bağlantı türü ayarları: adres, FTP, SFTP veya webhook.
 * FTP şifresi kayıtlıysa boş bırakılır; boş gönderim kayıtlı şifreyi korur.
 */

import { Check, Copy } from "lucide-react";
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
  type ConnectionType,
  type FtpConfig,
} from "@/lib/xml-connection";

export function ConnectionSettings({
  idPrefix = "conn",
  connectionType,
  ftpConfig,
  hasFtpPassword,
  webhookUrl,
  onConnectionTypeChange,
  onFtpConfigChange,
}: {
  idPrefix?: string | undefined;
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

  return (
    <section className="space-y-3 rounded-xl border bg-card p-4">
      <div className="space-y-1">
        <Label htmlFor={`${idPrefix}-type`}>Dosya nereden gelecek?</Label>
        <select
          id={`${idPrefix}-type`}
          className="h-9 w-full rounded-md border bg-background px-2 text-sm"
          value={connectionType}
          onChange={(event) => onConnectionTypeChange(event.target.value as ConnectionType)}
        >
          {CONNECTION_TYPES.map((item) => (
            <option key={item} value={item}>{CONNECTION_TYPE_LABELS[item]}</option>
          ))}
        </select>
        <p className="text-xs text-muted-foreground">{CONNECTION_TYPE_HINTS[connectionType]}</p>
      </div>

      {connectionType === "sftp" ? (
        <p className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive">
          SFTP (SSH) bağlantısı bu ortamda kurulamıyor. Tedarikçiden normal FTP erişimi ya da bir
          indirme adresi isteyin; alternatif olarak webhook seçeneğiyle dosyayı size gönderebilirler.
        </p>
      ) : null}

      {isFtp ? (
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
              onChange={(event) => setField("port", Number(event.target.value) || 21)}
            />
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
              placeholder="/export/products.xml"
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
        </div>
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
          <p className="text-xs text-muted-foreground">
            Tedarikçi dosyayı bu adrese POST olarak gönderdiğinde içe aktarım hemen başlar. Adresi
            gizli tutun; paylaşıldığında beslemeye dosya gönderilebilir.
          </p>
        </div>
      ) : null}
    </section>
  );
}
