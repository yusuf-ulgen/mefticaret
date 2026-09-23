import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CalendarHeart, Loader2, Plus, Send, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { BigButton, Field, Sheet, SoftCard, inputClass } from "@/components/homemaker/kolay-parts";
import {
  deleteAnnualReminder,
  listAnnualReminders,
  saveAnnualReminder,
} from "@/lib/kolay-v8.functions";

/**
 * Yıllık özel gün hatırlatmaları: müşterinin sipariş tarihini kaydeder, gelecek
 * yıl aynı gün için WhatsApp mesajını tek dokunuşla hazırlar.
 */
export function RemindersCard({ storeId }: { storeId: string }) {
  const queryClient = useQueryClient();
  const load = useServerFn(listAnnualReminders);
  const save = useServerFn(saveAnnualReminder);
  const remove = useServerFn(deleteAnnualReminder);

  const remindersQuery = useQuery({
    queryKey: ["kolay-reminders", storeId],
    queryFn: () => load({ data: { storeId } }),
  });

  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [phone, setPhone] = useState("");
  const [occasion, setOccasion] = useState("Doğum günü");
  const [remindOn, setRemindOn] = useState("");
  const [message, setMessage] = useState("");

  const submit = async () => {
    setBusy(true);
    try {
      await save({
        data: {
          storeId,
          customerName: customerName.trim(),
          phone: phone.trim(),
          occasion: occasion.trim(),
          remindOn,
          message: message.trim() || null,
        },
      });
      await queryClient.invalidateQueries({ queryKey: ["kolay-reminders", storeId] });
      setOpen(false);
      setCustomerName("");
      setPhone("");
      setMessage("");
      toast.success("Hatırlatma kaydedildi");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Kaydedilemedi");
    } finally {
      setBusy(false);
    }
  };

  const reminders = remindersQuery.data ?? [];
  const today = new Date().toISOString().slice(0, 10);

  return (
    <>
      <SoftCard className="grid gap-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CalendarHeart className="size-5 text-hm-rose" />
            <h2 className="text-base font-bold">Özel gün hatırlatmaları</h2>
          </div>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="inline-flex min-h-10 items-center gap-1 rounded-2xl bg-hm-rose px-3 text-sm font-semibold text-white"
          >
            <Plus className="size-4" /> Ekle
          </button>
        </div>

        {reminders.length === 0 ? (
          <p className="text-xs text-hm-ink-soft">
            Müşterinizin bayram, doğum günü ya da yıl dönümü tarihini kaydedin; günü geldiğinde
            burada görüp WhatsApp mesajını tek dokunuşla gönderin.
          </p>
        ) : (
          <ul className="grid gap-2">
            {reminders.map((reminder) => {
              const due = reminder.remind_on <= today;
              const text =
                reminder.message?.trim() ||
                `Merhaba ${reminder.customer_name}, ${reminder.occasion} yaklaşıyor. Siparişinizi şimdi verirseniz zamanında hazır olur.`;
              return (
                <li
                  key={reminder.id}
                  className={`flex items-center gap-3 rounded-2xl border p-3 ${
                    due ? "border-hm-rose bg-hm-rose-soft" : "border-hm-line"
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{reminder.customer_name}</p>
                    <p className="truncate text-xs text-hm-ink-soft">
                      {reminder.occasion} · {reminder.remind_on}
                    </p>
                  </div>
                  <a
                    href={`https://wa.me/${reminder.phone}?text=${encodeURIComponent(text)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="WhatsApp ile hatırlat"
                    className="grid size-10 place-items-center rounded-2xl bg-hm-emerald text-white"
                  >
                    <Send className="size-4" />
                  </a>
                  <button
                    type="button"
                    aria-label="Sil"
                    onClick={async () => {
                      await remove({ data: { storeId, id: reminder.id } });
                      await queryClient.invalidateQueries({ queryKey: ["kolay-reminders", storeId] });
                    }}
                    className="grid size-10 place-items-center rounded-2xl bg-hm-sand text-hm-ink-soft"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </SoftCard>

      <Sheet open={open} title="Hatırlatma ekle" onClose={() => setOpen(false)}>
        <div className="grid gap-3">
          <Field label="Müşteri adı">
            <input
              value={customerName}
              onChange={(event) => setCustomerName(event.target.value)}
              className={inputClass}
              placeholder="Ayşe Yılmaz"
            />
          </Field>
          <Field label="Telefon" hint="WhatsApp mesajı bu numaraya açılır">
            <input
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              className={inputClass}
              placeholder="0555 000 00 00"
              inputMode="tel"
            />
          </Field>
          <Field label="Özel gün">
            <input
              value={occasion}
              onChange={(event) => setOccasion(event.target.value)}
              className={inputClass}
              placeholder="Doğum günü / Bayram / Yıl dönümü"
            />
          </Field>
          <Field label="Hatırlatma tarihi">
            <input
              type="date"
              value={remindOn}
              onChange={(event) => setRemindOn(event.target.value)}
              className={inputClass}
            />
          </Field>
          <Field label="Mesaj (isteğe bağlı)">
            <textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              rows={3}
              className={inputClass}
              placeholder="Boş bırakırsanız hazır bir mesaj kullanılır."
            />
          </Field>
          <BigButton
            onClick={() => void submit()}
            disabled={busy || customerName.trim().length < 2 || phone.trim().length < 10 || !remindOn}
          >
            {busy ? <Loader2 className="size-5 animate-spin" /> : null}
            Kaydet
          </BigButton>
        </div>
      </Sheet>
    </>
  );
}
