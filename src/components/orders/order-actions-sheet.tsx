import { Mail, MoreVertical, Printer, Share2, StickyNote, Undo2, UserRound } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/** Shopify tarzı "İşlemler" menüsü. */
export function OrderActionsSheet(props: {
  canRefund: boolean;
  onRefund: () => void;
  onAddNote: () => void;
  onPrint: () => void;
  onShare: () => void;
  onEmailReceipt: (() => void) | null;
  onOpenCustomer: (() => void) | null;
}) {
  const item = "min-h-11 gap-3";
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon" className="size-11 rounded-full" aria-label="İşlemler">
          <MoreVertical className="size-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>İşlemler</DropdownMenuLabel>
        <DropdownMenuItem className={item} disabled={!props.canRefund} onSelect={props.onRefund}>
          <Undo2 className="size-4" /> Para iadesi yap
        </DropdownMenuItem>
        <DropdownMenuItem className={item} onSelect={props.onAddNote}>
          <StickyNote className="size-4" /> Not ekle
        </DropdownMenuItem>
        {props.onOpenCustomer ? (
          <DropdownMenuItem className={item} onSelect={props.onOpenCustomer}>
            <UserRound className="size-4" /> Müşteri kartını aç
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuItem className={item} onSelect={props.onShare}>
          <Share2 className="size-4" /> Siparişi personelle paylaş
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Makbuz</DropdownMenuLabel>
        <DropdownMenuItem className={item} onSelect={props.onPrint}>
          <Printer className="size-4" /> Siparişi yazdır
        </DropdownMenuItem>
        <DropdownMenuItem className={item} disabled={!props.onEmailReceipt} onSelect={() => props.onEmailReceipt?.()}>
          <Mail className="size-4" /> Sipariş makbuzunu e-postayla gönder
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
