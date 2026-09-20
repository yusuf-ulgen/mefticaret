import { startAuthentication, startRegistration } from "@simplewebauthn/browser";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Fingerprint, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { myPasskeysQuery } from "@/lib/nextgen-queries";
import {
  completePasskeyRegistration,
  removeMyPasskey,
  startPasskeyRegistration,
} from "@/lib/passkey.functions";

/** Parmak izi / Face ID ile hızlı ödeme için passkey yönetimi. */
export function PasskeyManager() {
  const queryClient = useQueryClient();
  const { data } = useQuery(myPasskeysQuery());
  const begin = useServerFn(startPasskeyRegistration);
  const finish = useServerFn(completePasskeyRegistration);
  const remove = useServerFn(removeMyPasskey);
  const [label, setLabel] = useState("");

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["my-passkeys"] });
  };

  const addMutation = useMutation({
    mutationFn: async () => {
      const { optionsJson } = await begin({ data: {} as never });
      const attestation = await startRegistration({ optionsJSON: JSON.parse(optionsJson) });
      return finish({
        data: { responseJson: JSON.stringify(attestation), label: label.trim() || "Bu cihaz" } as never,
      });
    },
    onSuccess: () => {
      toast.success("Cihazınız eklendi. Artık parmak izi ile hızlı ödeme yapabilirsiniz.");
      setLabel("");
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message || "Cihaz eklenemedi"),
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => remove({ data: { id } as never }),
    onSuccess: () => {
      toast.success("Cihaz kaldırıldı");
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const passkeys = data ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Fingerprint className="size-4" /> Hızlı ödeme (parmak izi / Face ID)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Cihazınızı bir kez tanıtın; sonraki alışverişlerde şifre yazmadan tek dokunuşla ödeme yapabilirsiniz.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-1.5">
            <Label htmlFor="passkey-label">Cihaz adı</Label>
            <Input
              id="passkey-label"
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              placeholder="Örn. Telefonum"
            />
          </div>
          <Button onClick={() => addMutation.mutate()} disabled={addMutation.isPending}>
            Bu cihazı tanıt
          </Button>
        </div>

        {passkeys.length === 0 ? (
          <p className="text-sm text-muted-foreground">Henüz tanıtılmış cihaz yok.</p>
        ) : (
          <div className="space-y-2">
            {passkeys.map((item) => (
              <div key={item.id} className="flex items-center justify-between rounded-lg border p-3 text-sm">
                <div>
                  <p className="font-medium">{item.label}</p>
                  <p className="text-xs text-muted-foreground">
                    {item.lastUsedAt
                      ? `Son kullanım: ${new Date(item.lastUsedAt).toLocaleString("tr-TR")}`
                      : "Henüz kullanılmadı"}
                  </p>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label="Cihazı kaldır"
                  onClick={() => removeMutation.mutate(item.id)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
