/**
 * UBL-TR 1.2 fatura belgesi üretimi.
 *
 * Platform abonelik faturaları (public.invoices) e-arşiv/e-fatura belgesine
 * dönüştürülür. Tutarlar veritabanındaki değerlerden okunur; istemciden gelen
 * hiçbir tutar kullanılmaz.
 */

import { escapeXml } from "./einvoice-soap.server";

export interface UblLine {
  name: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  taxRate: number;
  taxAmount: number;
}

export interface UblParty {
  taxId: string;
  title: string;
  address: string;
  city: string;
  country: string;
  email?: string | undefined;
}

export interface UblInvoiceInput {
  ettn: string;
  documentNumber: string;
  issueDate: string; // YYYY-MM-DD
  issueTime: string; // HH:MM:SS
  currency: string;
  profile: "TEMELFATURA" | "EARSIVFATURA";
  supplier: UblParty;
  customer: UblParty;
  lines: UblLine[];
  subtotal: number;
  taxTotal: number;
  total: number;
  note?: string | undefined;
}

const money = (value: number) => value.toFixed(2);

function partyXml(tag: string, party: UblParty): string {
  return `<cac:${tag}><cac:Party><cac:PartyIdentification><cbc:ID schemeID="${
    party.taxId.length === 11 ? "TCKN" : "VKN"
  }">${escapeXml(party.taxId)}</cbc:ID></cac:PartyIdentification><cac:PartyName><cbc:Name>${escapeXml(
    party.title,
  )}</cbc:Name></cac:PartyName><cac:PostalAddress><cbc:StreetName>${escapeXml(
    party.address,
  )}</cbc:StreetName><cbc:CityName>${escapeXml(
    party.city,
  )}</cbc:CityName><cac:Country><cbc:Name>${escapeXml(
    party.country,
  )}</cbc:Name></cac:Country></cac:PostalAddress>${
    party.email
      ? `<cac:Contact><cbc:ElectronicMail>${escapeXml(party.email)}</cbc:ElectronicMail></cac:Contact>`
      : ""
  }</cac:Party></cac:${tag}>`;
}

export function buildUblInvoice(input: UblInvoiceInput): string {
  const lines = input.lines
    .map((line, index) => {
      return `<cac:InvoiceLine><cbc:ID>${index + 1}</cbc:ID><cbc:InvoicedQuantity unitCode="C62">${
        line.quantity
      }</cbc:InvoicedQuantity><cbc:LineExtensionAmount currencyID="${escapeXml(
        input.currency,
      )}">${money(line.lineTotal)}</cbc:LineExtensionAmount><cac:TaxTotal><cbc:TaxAmount currencyID="${escapeXml(
        input.currency,
      )}">${money(line.taxAmount)}</cbc:TaxAmount><cac:TaxSubtotal><cbc:TaxableAmount currencyID="${escapeXml(
        input.currency,
      )}">${money(line.lineTotal)}</cbc:TaxableAmount><cbc:TaxAmount currencyID="${escapeXml(
        input.currency,
      )}">${money(line.taxAmount)}</cbc:TaxAmount><cbc:Percent>${money(
        line.taxRate,
      )}</cbc:Percent><cac:TaxCategory><cac:TaxScheme><cbc:Name>KDV</cbc:Name><cbc:TaxTypeCode>0015</cbc:TaxTypeCode></cac:TaxScheme></cac:TaxCategory></cac:TaxSubtotal></cac:TaxTotal><cac:Item><cbc:Name>${escapeXml(
        line.name,
      )}</cbc:Name></cac:Item><cac:Price><cbc:PriceAmount currencyID="${escapeXml(
        input.currency,
      )}">${money(line.unitPrice)}</cbc:PriceAmount></cac:Price></cac:InvoiceLine>`;
    })
    .join("");

  return `<?xml version="1.0" encoding="UTF-8"?><Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2" xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2" xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2"><cbc:UBLVersionID>2.1</cbc:UBLVersionID><cbc:CustomizationID>TR1.2</cbc:CustomizationID><cbc:ProfileID>${
    input.profile
  }</cbc:ProfileID><cbc:ID>${escapeXml(input.documentNumber)}</cbc:ID><cbc:CopyIndicator>false</cbc:CopyIndicator><cbc:UUID>${escapeXml(
    input.ettn,
  )}</cbc:UUID><cbc:IssueDate>${escapeXml(input.issueDate)}</cbc:IssueDate><cbc:IssueTime>${escapeXml(
    input.issueTime,
  )}</cbc:IssueTime><cbc:InvoiceTypeCode>SATIS</cbc:InvoiceTypeCode>${
    input.note ? `<cbc:Note>${escapeXml(input.note)}</cbc:Note>` : ""
  }<cbc:DocumentCurrencyCode>${escapeXml(
    input.currency,
  )}</cbc:DocumentCurrencyCode><cbc:LineCountNumeric>${
    input.lines.length
  }</cbc:LineCountNumeric>${partyXml("AccountingSupplierParty", input.supplier)}${partyXml(
    "AccountingCustomerParty",
    input.customer,
  )}<cac:TaxTotal><cbc:TaxAmount currencyID="${escapeXml(input.currency)}">${money(
    input.taxTotal,
  )}</cbc:TaxAmount></cac:TaxTotal><cac:LegalMonetaryTotal><cbc:LineExtensionAmount currencyID="${escapeXml(
    input.currency,
  )}">${money(input.subtotal)}</cbc:LineExtensionAmount><cbc:TaxExclusiveAmount currencyID="${escapeXml(
    input.currency,
  )}">${money(input.subtotal)}</cbc:TaxExclusiveAmount><cbc:TaxInclusiveAmount currencyID="${escapeXml(
    input.currency,
  )}">${money(input.total)}</cbc:TaxInclusiveAmount><cbc:PayableAmount currencyID="${escapeXml(
    input.currency,
  )}">${money(input.total)}</cbc:PayableAmount></cac:LegalMonetaryTotal>${lines}</Invoice>`;
}
