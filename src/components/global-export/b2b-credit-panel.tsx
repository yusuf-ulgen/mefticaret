import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Landmark, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  addCreditTransactionFn,
  deleteCreditAccountFn,
  saveCreditAccountFn,
} from "@/lib/b2b-credit.functions";
import { GLOBAL_CURRENCIES } from "@/lib/global-commerce";
import { creditAccountsQuery } from "@/lib/nextgen-queries";

type Props = { storeId: string };

const STATUS_LABELS: Record<string, string> = {
  active: "Aktif",
  on_hold: "Beklemede",
  closed: "Kapalı",
};

const KIND_LABELS: Record<string, string> = {
  charge: "Borç (satış)",
  payment: "Tahsilat",
  adjustment: "Düzeltme",
};

function money(value: number, currency: string) {
  return `${value.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
}

/** B2B cari hesap (açık hesap) yönetimi: kredi limiti, bakiye ve hareketler. */
export function B2bCreditPanel({ storeId }: Props) {
  const queryClient = useQueryClient();
  const { data } = useQuery(creditAccountsQuery(storeId));
  const saveAccount = useServerFn(saveCreditAccountFn);
  const removeAccount = useServerFn(deleteCreditAccountFn);
  const addTransaction = useServerFn(addCreditTransactionFn);

  const [companyName, setCompanyName] = useState("");
  const [email, setEmail] = useState("");
  const [taxId, setTaxId] = useState("");
  const [currency, setCurrency] = useState("TRY");
  const [creditLimit, setCreditLimit] = useState("50000");
  const [termDays, setTermDays] = useState("30");
  const [notes, setNotes] = useState("");

  const [selectedAccount, setSelectedAccount] = useState("");
  const [kind, setKind] = useState("charge");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["b2b-credit-accounts", storeId] });
  };

  const num = (input: string) => Number(input.replace(",", "."));

  const saveMutation = useMutation({
    mutationFn: () =>
      saveAccount({
        data: {
          storeId,
          companyName,
          contactEmail: email,
          taxId,
          currency,
          creditLimit: num(creditLimit) || 0,
          termDays: Math.round(num(termDays) || 0),
          status: "active",
          notes,
        } as never,
      }),
    onSuccess: () => {
      toast.success("Cari hesap kaydedildi");
      setCompanyName("");
      setEmail("");
      setTaxId("");
      setNotes("");
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const transactionMutation = useMutation({
    mutationFn: () =>
      addTransaction({
        data: { storeId, accountId: selectedAccount, kind, amount: num(amount) || 0, note } as never,
      }),
    onSuccess: (result) => {
      toast.success(`Hareket kaydedildi. Yeni bakiye: ${money(result.balance, result.currency)}`);
      setAmount("");
      setNote("");
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => removeAccount({ data: { storeId, id } as never }),
    onSuccess: () => {
      toast.success("Cari hesap silindi");
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const accounts = data?.accounts ?? [];
  const transactions = data?.transactions ?? [];

  return (
    <div className="space-y-6">
      <div className="rounded-xl border bg-card p-5">
        <div className="mb-4 flex items-center gap-2">
          <Landmark className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Yeni cari hesap</h3>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="cr-company">Firma adı</Label>
            <Input id="cr-company" value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cr-email">E-posta</Label>
            <Input id="cr-email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cr-tax">Vergi numarası</Label>
            <Input id="cr-tax" value={taxId} onChange={(e) => setTaxId(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Para birimi</Label>
            <Select value={currency} onValueChange={setCurrency}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {GLOBAL_CURRENCIES.map((item) => (
                  <SelectItem key={item.code} value={item.code}>
                    {item.code}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cr-limit">Kredi limiti</Label>
            <Input
              id="cr-limit"
              inputMode="decimal"
              value={creditLimit}
              onChange={(e) => setCreditLimit(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cr-term">Vade (gün)</Label>
            <Input id="cr-term" inputMode="numeric" value={termDays} onChange={(e) => setTermDays(e.target.value)} />
          </div>
          <div className="space-y-1.5 sm:col-span-2 lg:col-span-3">
            <Label htmlFor="cr-notes">Not</Label>
            <Textarea id="cr-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <Button
          className="mt-4"
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending || companyName.trim().length < 2}
        >
          Cari hesabı kaydet
        </Button>
      </div>

      <div className="rounded-xl border bg-card p-5">
        <h3 className="mb-3 text-sm font-semibold">Cari hesaplar</h3>
        {accounts.length === 0 ? (
          <p className="text-muted-foreground text-sm">Henüz cari hesap eklenmedi.</p>
        ) : (
          <div className="space-y-2">
            {accounts.map((account) => (
              <div key={account.id} className="rounded-lg border p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-medium">{account.companyName}</p>
                    <p className="text-muted-foreground text-xs">
                      Limit {money(account.creditLimit, account.currency)} · Bakiye{" "}
                      {money(account.balance, account.currency)} · Kalan{" "}
                      {money(account.available, account.currency)} · Vade {account.termDays} gün
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={account.status === "active" ? "secondary" : "outline"}>
                      {STATUS_LABELS[account.status] ?? account.status}
                    </Badge>
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label="Cari hesabı sil"
                      onClick={() => deleteMutation.mutate(account.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-xl border bg-card p-5">
        <h3 className="mb-3 text-sm font-semibold">Cari hareket ekle</h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1.5">
            <Label>Hesap</Label>
            <Select value={selectedAccount} onValueChange={setSelectedAccount}>
              <SelectTrigger>
                <SelectValue placeholder="Hesap seçin" />
              </SelectTrigger>
              <SelectContent>
                {accounts.map((account) => (
                  <SelectItem key={account.id} value={account.id}>
                    {account.companyName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Tür</Label>
            <Select value={kind} onValueChange={setKind}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(KIND_LABELS).map(([key, label]) => (
                  <SelectItem key={key} value={key}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cr-amount">Tutar</Label>
            <Input id="cr-amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cr-note">Not</Label>
            <Input id="cr-note" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
        </div>
        <Button
          className="mt-4"
          onClick={() => transactionMutation.mutate()}
          disabled={transactionMutation.isPending || !selectedAccount || !amount}
        >
          Hareketi kaydet
        </Button>
      </div>

      {transactions.length > 0 && (
        <div className="rounded-xl border bg-card p-5">
          <h3 className="mb-3 text-sm font-semibold">Son hareketler</h3>
          <div className="space-y-2">
            {transactions.slice(0, 25).map((row) => {
              const account = accounts.find((item) => item.id === row.accountId);
              return (
                <div key={row.id} className="flex flex-wrap items-center justify-between gap-2 border-b pb-2 text-sm">
                  <span>
                    {account?.companyName ?? "Hesap"} · {KIND_LABELS[row.kind] ?? row.kind}
                  </span>
                  <span className="text-muted-foreground text-xs">
                    {money(row.amount, row.currency)} · {new Date(row.createdAt).toLocaleString("tr-TR")}
                    {row.note ? ` · ${row.note}` : ""}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
