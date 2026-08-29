import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { ArrowDownRight, ArrowUpRight, Banknote, Landmark, Receipt, Wallet } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { createPayout, updatePayoutStatus } from "@/lib/finance.functions";
import {
  LEDGER_KIND_LABELS,
  PAYOUT_STATUS_LABELS,
  ledgerQuery,
  payoutsQuery,
  summarizeLedger,
} from "@/lib/finance-queries";
import { formatDate, formatDateTime, formatMoney } from "@/lib/mefti";
import { storeQuery } from "@/lib/store-queries";

const RANGES = [30, 90, 180] as const;

function isoDate(offsetDays: number) {
  return new Date(Date.now() - offsetDays * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export const Route = createFileRoute("/_authenticated/store/$storeId/finance")({
  head: () => ({
    meta: [
      { title: "Finans & Hakediş — Mefticaret" },
      {
        name: "description",
        content: "Satış, kargo, indirim, komisyon ve iade kayıtlarını içeren finans defteri ile hakediş dönemleri.",
      },
      { property: "og:title", content: "Finans & Hakediş — Mefticaret" },
      { property: "og:description", content: "Mağazanın net hakedişini ve finans hareketlerini takip et." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: FinancePage;
});

function FinancePage() {
  return null;
}
