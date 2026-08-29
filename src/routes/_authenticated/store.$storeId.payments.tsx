import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { BadgeCheck, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { connectorsQuery, paymentMethodsQuery } from "@/lib/commerce-queries";
import {
  enablePaymentMethod,
  removePaymentMethod,
  updatePaymentMethod,
} from "@/lib/commerce.functions";

export const Route = createFileRoute("/_authenticated/store/$storeId/payments")({
  head: () => ({
    meta: [
      { title: "Ödeme Yöntemleri — Mefticaret" },
      {
        name: "description",
        content:
          "Havale, kapıda ödeme, iyzico, PayTR ve Stripe gibi ödeme connector'larını mağazan için aç ve yapılandır.",
      },
      { property: "og:title", content: "Ödeme Yöntemleri — Mefticaret" },
      {
        property: "og:description",
        content: "Modüler ödeme connector sistemi: taksit, test modu ve ek ücret kuralları.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PaymentsPage,
});

function PaymentsPage() {
  const { storeId } = Route.useParams();
  const queryClient = useQueryClient();
  const { data: methods, isLoading } = useQuery(paymentMethodsQuery(storeId));
  const { data: connectors } = useQuery(connectorsQuery("payment"));
  const enable = useServerFn(enablePaymentMethod);
  const update = useServerFn(updatePaymentMethod);
  const remove = useServerFn(removePaymentMethod);

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["payment-methods", storeId] });

  const enableMutation = useMutation({
    mutationFn: (input: { connectorId: string; displayName: string }) =>
      enable({ data: { storeId, ...input } }),
    onSuccess: async () => {
      await invalidate();
      toast.success("Ödeme yöntemi eklendi");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const updateMutation = useMutation({
    mutationFn: (input: {
      storeId: string;
      methodId: string;
      displayName?: string;
      instructions?: string | null;
      isActive?: boolean;
      testMode?: boolean;
      installmentsEnabled?: boolean;
      extraFeeRate?: number;
    }) => update({ data: input }),
    onSuccess: async () => {
      await invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const removeMutation = useMutation({
    mutationFn: (methodId: string) => remove({ data: { storeId, methodId } }),
    onSuccess: async () => {
      await invalidate();
      toast.success("Ödeme yöntemi kaldırıldı");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const enabledIds = new Set((methods ?? []).map((method) => method.connector_id));
  const available = (connectors ?? []).filter((connector) => !enabledIds.has(connector.id));

  return (
    <AppShell
      storeId={storeId}
      title="Ödeme Yöntemleri"
      description="Modüler ödeme connector'larını aç, taksit ve test modunu yönet."
    >
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {isLoading ? (
            <p className="text-muted-foreground">Yükleniyor…</p>
          ) : (methods ?? []).length === 0 ? (
            <div className="surface-card p-10 text-center">
              <BadgeCheck className="mx-auto mb-3 size-6 text-muted-foreground" />
              <p className="font-medium">Aktif ödeme yöntemi yok</p>
              <p className="text-sm text-muted-foreground">
                Sağdaki listeden bir sağlayıcı ekleyerek başla.
              </p>
            </div>
          ) : (
            (methods ?? []).map((method) => (
              <div key={method.id} className="surface-card space-y-4 p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-lg font-semibold">{method.display_name}</p>
                    <p className="text-sm text-muted-foreground">
                      {method.connectors?.description ?? method.connectors?.name}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant={method.is_active ? "default" : "secondary"}>
                      {method.is_active ? "Aktif" : "Kapalı"}
                    </Badge>
                    <Switch
                      checked={method.is_active}
                      aria-label={`${method.display_name} aç/kapat`}
                      onCheckedChange={(next) =>
                        updateMutation.mutate({
                          storeId,
                          methodId: method.id,
                          isActive: next,
                        })
                      }
                    />
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      aria-label={`${method.display_name} kaldır`}
                      onClick={() => removeMutation.mutate(method.id)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor={`name-${method.id}`}>Görünen ad</Label>
                    <Input
                      id={`name-${method.id}`}
                      defaultValue={method.display_name}
                      onBlur={(event) => {
                        const value = event.target.value.trim();
                        if (value.length >= 2 && value !== method.display_name) {
                          updateMutation.mutate({
                            storeId,
                            methodId: method.id,
                            displayName: value,
                          });
                        }
                      }}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`fee-${method.id}`}>Ek ücret oranı (%)</Label>
                    <Input
                      id={`fee-${method.id}`}
                      type="number"
                      min={0}
                      max={100}
                      step="0.1"
                      defaultValue={(Number(method.extra_fee_rate) * 100).toFixed(1)}
                      onBlur={(event) =>
                        updateMutation.mutate({
                          storeId,
                          methodId: method.id,
                          extraFeeRate: Math.min(1, (Number(event.target.value) || 0) / 100),
                        })
                      }
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`inst-${method.id}`}>Müşteriye gösterilecek talimat</Label>
                  <Textarea
                    id={`inst-${method.id}`}
                    rows={2}
                    defaultValue={method.instructions ?? ""}
                    onBlur={(event) =>
                      updateMutation.mutate({
                        storeId,
                        methodId: method.id,
                        instructions: event.target.value,
                      })
                    }
                  />
                </div>

                <div className="flex flex-wrap gap-6">
                  <label className="flex items-center gap-3 text-sm">
                    <Switch
                      checked={method.test_mode}
                      onCheckedChange={(next) =>
                        updateMutation.mutate({ storeId, methodId: method.id, testMode: next })
                      }
                    />
                    Test modu
                  </label>
                  {method.connectors?.supports_installments ? (
                    <label className="flex items-center gap-3 text-sm">
                      <Switch
                        checked={method.installments_enabled}
                        onCheckedChange={(next) =>
                          updateMutation.mutate({
                            storeId,
                            methodId: method.id,
                            installmentsEnabled: next,
                          })
                        }
                      />
                      Taksit
                    </label>
                  ) : null}
                </div>
              </div>
            ))
          )}
        </div>

        <div className="surface-card h-fit space-y-4 p-6">
          <div>
            <h2 className="text-lg font-semibold">Sağlayıcı ekle</h2>
            <p className="text-sm text-muted-foreground">
              API anahtarları veritabanında saklanmaz; sunucu tarafı güvenli alanda tutulur.
            </p>
          </div>
          {available.length === 0 ? (
            <p className="text-sm text-muted-foreground">Tüm sağlayıcılar eklendi.</p>
          ) : (
            <ul className="space-y-3">
              {available.map((connector) => (
                <li
                  key={connector.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border/50 px-4 py-3"
                >
                  <div>
                    <p className="text-sm font-medium">{connector.name}</p>
                    <p className="text-xs text-muted-foreground">{connector.description}</p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={enableMutation.isPending}
                    onClick={() =>
                      enableMutation.mutate({
                        connectorId: connector.id,
                        displayName: connector.name,
                      })
                    }
                  >
                    <Plus className="mr-1 size-4" />
                    Ekle
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </AppShell>
  );
}
