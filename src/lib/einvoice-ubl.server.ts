/**
 * UBL-TR 1.2 fatura belgesi üretimi.
 *
 * Platform faturaları (public.invoices) e-Arşiv/e-Fatura belgesine dönüştürülür.
 * Tutarlar veritabanındaki değerlerden okunur; istemciden gelen hiçbir tutar kullanılmaz.
 * GİB şematron kuralları: Signature, ilçe (CitySubdivisionName), vergi dairesi,
 * TCKN alıcıda Person, KDV oranlarına göre gruplanmış TaxSubtotal, e-Arşivde gönderim şekli.
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
  taxOffice?: string | undefined;
  address: string;
  district?: string | undefined;
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
const x = escapeXml;

function personXml(party: UblParty): string {
  // TCKN (11 hane) alıcıda ad/soyad zorunlu; unvan son kelime soyad kabul edilir.
  if (party.taxId.length !== 11) return "";
  const parts = party.title.trim().split(/\s+/);
  const family = parts.length > 1 ? parts.pop()! : parts[0]!;
  const first = parts.length ? parts.join(" ") : family;
  return `<cac:Person><cbc:FirstName>${x(first)}</cbc:FirstName><cbc:FamilyName>${x(family)}</cbc:FamilyName></cac:Person>`;
}

function partyXml(tag: string, party: UblParty): string {
  const scheme = party.taxId.length === 11 ? "TCKN" : "VKN";
  return `<cac:${tag}><cac:Party><cac:PartyIdentification><cbc:ID schemeID="${scheme}">${x(
    party.taxId,
  )}</cbc:ID></cac:PartyIdentification><cac:PartyName><cbc:Name>${x(
    party.title,
  )}</cbc:Name></cac:PartyName><cac:PostalAddress><cbc:StreetName>${x(
    party.address,
  )}</cbc:StreetName><cbc:CitySubdivisionName>${x(
    party.district || party.city,
  )}</cbc:CitySubdivisionName><cbc:CityName>${x(party.city)}</cbc:CityName><cac:Country><cbc:Name>${x(
    party.country,
  )}</cbc:Name></cac:Country></cac:PostalAddress>${
    party.taxOffice
      ? `<cac:PartyTaxScheme><cac:TaxScheme><cbc:Name>${x(party.taxOffice)}</cbc:Name></cac:TaxScheme></cac:PartyTaxScheme>`
      : ""
  }${party.email ? `<cac:Contact><cbc:ElectronicMail>${x(party.email)}</cbc:ElectronicMail></cac:Contact>` : ""}${personXml(
    party,
  )}</cac:Party></cac:${tag}>`;
}

function taxSubtotalXml(cur: string, base: number, tax: number, rate: number): string {
  return `<cac:TaxSubtotal><cbc:TaxableAmount currencyID="${cur}">${money(base)}</cbc:TaxableAmount><cbc:TaxAmount currencyID="${cur}">${money(
    tax,
  )}</cbc:TaxAmount><cbc:Percent>${money(rate)}</cbc:Percent><cac:TaxCategory><cac:TaxScheme><cbc:Name>KDV</cbc:Name><cbc:TaxTypeCode>0015</cbc:TaxTypeCode></cac:TaxScheme></cac:TaxCategory></cac:TaxSubtotal>`;
}

export function buildUblInvoice(input: UblInvoiceInput): string {
  const cur = x(input.currency);
  const lines = input.lines
    .map(
      (line, index) =>
        `<cac:InvoiceLine><cbc:ID>${index + 1}</cbc:ID><cbc:InvoicedQuantity unitCode="C62">${line.quantity}</cbc:InvoicedQuantity><cbc:LineExtensionAmount currencyID="${cur}">${money(
          line.lineTotal,
        )}</cbc:LineExtensionAmount><cac:TaxTotal><cbc:TaxAmount currencyID="${cur}">${money(
          line.taxAmount,
        )}</cbc:TaxAmount>${taxSubtotalXml(cur, line.lineTotal, line.taxAmount, line.taxRate)}</cac:TaxTotal><cac:Item><cbc:Name>${x(
          line.name,
        )}</cbc:Name></cac:Item><cac:Price><cbc:PriceAmount currencyID="${cur}">${money(
          line.unitPrice,
        )}</cbc:PriceAmount></cac:Price></cac:InvoiceLine>`,
    )
    .join("");

  // Belge KDV toplamı oranlara göre gruplanır (karışık oranlı faturalar için zorunlu).
  const groups = new Map<number, { base: number; tax: number }>();
  for (const l of input.lines) {
    const g = groups.get(l.taxRate) ?? { base: 0, tax: 0 };
    g.base += l.lineTotal;
    g.tax += l.taxAmount;
    groups.set(l.taxRate, g);
  }
  const subtotals = [...groups.entries()].map(([rate, g]) => taxSubtotalXml(cur, g.base, g.tax, rate)).join("");

  const sendingType =
    input.profile === "EARSIVFATURA"
      ? `<cac:AdditionalDocumentReference><cbc:ID>ELEKTRONIK</cbc:ID><cbc:IssueDate>${x(
          input.issueDate,
        )}</cbc:IssueDate><cbc:DocumentTypeCode>SendingType</cbc:DocumentTypeCode></cac:AdditionalDocumentReference>`
      : "";

  const signature = `<cac:Signature><cbc:ID schemeID="VKN_TCKN">${x(
    input.supplier.taxId,
  )}</cbc:ID><cac:SignatoryParty><cac:PartyIdentification><cbc:ID schemeID="VKN">${x(
    input.supplier.taxId,
  )}</cbc:ID></cac:PartyIdentification><cac:PostalAddress><cbc:CitySubdivisionName>${x(
    input.supplier.district || input.supplier.city,
  )}</cbc:CitySubdivisionName><cbc:CityName>${x(input.supplier.city)}</cbc:CityName><cac:Country><cbc:Name>${x(
    input.supplier.country,
  )}</cbc:Name></cac:Country></cac:PostalAddress></cac:SignatoryParty><cac:DigitalSignatureAttachment><cac:ExternalReference><cbc:URI>#Signature_${x(
    input.documentNumber,
  )}</cbc:URI></cac:ExternalReference></cac:DigitalSignatureAttachment></cac:Signature>`;

  return `<?xml version="1.0" encoding="UTF-8"?><Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2" xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2" xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2"><cbc:UBLVersionID>2.1</cbc:UBLVersionID><cbc:CustomizationID>TR1.2</cbc:CustomizationID><cbc:ProfileID>${
    input.profile
  }</cbc:ProfileID><cbc:ID>${x(input.documentNumber)}</cbc:ID><cbc:CopyIndicator>false</cbc:CopyIndicator><cbc:UUID>${x(
    input.ettn,
  )}</cbc:UUID><cbc:IssueDate>${x(input.issueDate)}</cbc:IssueDate><cbc:IssueTime>${x(
    input.issueTime,
  )}</cbc:IssueTime><cbc:InvoiceTypeCode>SATIS</cbc:InvoiceTypeCode>${
    input.note ? `<cbc:Note>${x(input.note)}</cbc:Note>` : ""
  }<cbc:DocumentCurrencyCode>${cur}</cbc:DocumentCurrencyCode><cbc:LineCountNumeric>${
    input.lines.length
  }</cbc:LineCountNumeric>${sendingType}${signature}${partyXml("AccountingSupplierParty", input.supplier)}${partyXml(
    "AccountingCustomerParty",
    input.customer,
  )}<cac:TaxTotal><cbc:TaxAmount currencyID="${cur}">${money(input.taxTotal)}</cbc:TaxAmount>${subtotals}</cac:TaxTotal><cac:LegalMonetaryTotal><cbc:LineExtensionAmount currencyID="${cur}">${money(
    input.subtotal,
  )}</cbc:LineExtensionAmount><cbc:TaxExclusiveAmount currencyID="${cur}">${money(
    input.subtotal,
  )}</cbc:TaxExclusiveAmount><cbc:TaxInclusiveAmount currencyID="${cur}">${money(
    input.total,
  )}</cbc:TaxInclusiveAmount><cbc:PayableAmount currencyID="${cur}">${money(
    input.total,
  )}</cbc:PayableAmount></cac:LegalMonetaryTotal>${lines}</Invoice>`;
}
