import {
  DEFAULT_TAX_INFORMATION,
  FEDERAL_TAX_CLASSIFICATIONS,
  TIN_STORAGE_KEYS,
  type FederalTaxClassification,
  type LlcTaxClassification,
  type TaxInformationSettings,
} from "@/lib/w9-fields";
import { W9InputError, looksLikeStoredTin } from "@/lib/w9-tin";

const EXEMPT_PAYEE = /^(?:[1-9]|1[0-3])$/;
const FATCA = /^[A-M]$/;

function text(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  const trimmed = value.trim().slice(0, max);
  if (looksLikeStoredTin(trimmed)) {
    throw new W9InputError(
      "A taxpayer identification number cannot be saved. Enter it only when you generate the form."
    );
  }
  return trimmed;
}

export function sanitizeTaxInformation(input: unknown, strict = true): TaxInformationSettings {
  const source = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  for (const key of TIN_STORAGE_KEYS) {
    if (key in source) delete source[key];
  }

  const classification = source.federalTaxClassification;
  const federalTaxClassification: FederalTaxClassification | "" =
    typeof classification === "string" &&
    (FEDERAL_TAX_CLASSIFICATIONS as readonly string[]).includes(classification)
      ? (classification as FederalTaxClassification)
      : "";

  const letter = typeof source.llcTaxClassification === "string" ? source.llcTaxClassification.trim().toUpperCase() : "";
  const llcTaxClassification: LlcTaxClassification =
    letter === "C" || letter === "S" || letter === "P" ? letter : "";

  const exemptPayeeCode = text(source.exemptPayeeCode, 2);
  if (exemptPayeeCode && !EXEMPT_PAYEE.test(exemptPayeeCode)) {
    throw new W9InputError("Exempt payee code must be 1 through 13, or blank.");
  }
  const fatcaExemptionCode = text(source.fatcaExemptionCode, 1).toUpperCase();
  if (fatcaExemptionCode && !FATCA.test(fatcaExemptionCode)) {
    throw new W9InputError("FATCA exemption code must be a letter A through M, or blank.");
  }
  if (strict && federalTaxClassification === "llc" && !llcTaxClassification) {
    throw new W9InputError("Enter the LLC tax classification letter: C, S, or P.");
  }
  if (strict && federalTaxClassification === "other" && !text(source.otherClassification, 40)) {
    throw new W9InputError("Describe the other federal tax classification.");
  }

  return {
    name: text(source.name, 120),
    disregardedEntityName: text(source.disregardedEntityName, 120),
    federalTaxClassification,
    llcTaxClassification: federalTaxClassification === "llc" ? llcTaxClassification : "",
    otherClassification: federalTaxClassification === "other" ? text(source.otherClassification, 40) : "",
    foreignPartners: source.foreignPartners === true,
    exemptPayeeCode,
    fatcaExemptionCode,
    address: text(source.address, 160),
    cityStateZip: text(source.cityStateZip, 80),
    accountNumbers: text(source.accountNumbers, 80),
  };
}

export function emptyTaxInformation(): TaxInformationSettings {
  return { ...DEFAULT_TAX_INFORMATION };
}
