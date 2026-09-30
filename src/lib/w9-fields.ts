/**
 * IRS Form W-9 (Rev. March 2024) AcroForm names, from fw9.pdf.
 *
 * A structural IRS revision that renames these fields still needs a code change
 * here. Uploading a new PDF only works when every name below is present.
 * The platform upload refuses a file that is missing any of them.
 */
export const W9_REVISION_NOTE =
  "Field names are for IRS Form W-9 Rev. March 2024. A revision that changes the AcroForm structure requires a code change in W9_FIELDS.";

export const W9_LINK_TTL_DAYS = 7;
/** First successful download deletes the ciphertext. Later visits are refused. */
export const W9_LINK_SINGLE_DOWNLOAD = true;

export const FEDERAL_TAX_CLASSIFICATIONS = [
  "individual",
  "c_corp",
  "s_corp",
  "partnership",
  "trust_estate",
  "llc",
  "other",
] as const;

export type FederalTaxClassification = (typeof FEDERAL_TAX_CLASSIFICATIONS)[number];

export type LlcTaxClassification = "" | "C" | "S" | "P";

/** Identity fields only. There is no TIN property on purpose. */
export interface TaxInformationSettings {
  name: string;
  disregardedEntityName: string;
  federalTaxClassification: FederalTaxClassification | "";
  llcTaxClassification: LlcTaxClassification;
  otherClassification: string;
  foreignPartners: boolean;
  exemptPayeeCode: string;
  fatcaExemptionCode: string;
  address: string;
  cityStateZip: string;
  accountNumbers: string;
}

export const DEFAULT_TAX_INFORMATION: TaxInformationSettings = {
  name: "",
  disregardedEntityName: "",
  federalTaxClassification: "",
  llcTaxClassification: "",
  otherClassification: "",
  foreignPartners: false,
  exemptPayeeCode: "",
  fatcaExemptionCode: "",
  address: "",
  cityStateZip: "",
  accountNumbers: "",
};

/**
 * Widget order on the March 2024 form:
 * individual, C corp, S corp, partnership, trust/estate, LLC, then the LLC
 * letter, then Other, then the Other description, then line 3b.
 */
export const W9_FIELDS = {
  name: "topmostSubform[0].Page1[0].f1_01[0]",
  disregardedEntityName: "topmostSubform[0].Page1[0].f1_02[0]",
  individual: "topmostSubform[0].Page1[0].Boxes3a-b_ReadOrder[0].c1_1[0]",
  cCorp: "topmostSubform[0].Page1[0].Boxes3a-b_ReadOrder[0].c1_1[1]",
  sCorp: "topmostSubform[0].Page1[0].Boxes3a-b_ReadOrder[0].c1_1[2]",
  partnership: "topmostSubform[0].Page1[0].Boxes3a-b_ReadOrder[0].c1_1[3]",
  trustEstate: "topmostSubform[0].Page1[0].Boxes3a-b_ReadOrder[0].c1_1[4]",
  llc: "topmostSubform[0].Page1[0].Boxes3a-b_ReadOrder[0].c1_1[5]",
  llcLetter: "topmostSubform[0].Page1[0].Boxes3a-b_ReadOrder[0].f1_03[0]",
  other: "topmostSubform[0].Page1[0].Boxes3a-b_ReadOrder[0].c1_1[6]",
  otherDescription: "topmostSubform[0].Page1[0].Boxes3a-b_ReadOrder[0].f1_04[0]",
  foreignPartners: "topmostSubform[0].Page1[0].Boxes3a-b_ReadOrder[0].c1_2[0]",
  exemptPayeeCode: "topmostSubform[0].Page1[0].f1_05[0]",
  fatcaCode: "topmostSubform[0].Page1[0].f1_06[0]",
  address: "topmostSubform[0].Page1[0].Address_ReadOrder[0].f1_07[0]",
  cityStateZip: "topmostSubform[0].Page1[0].Address_ReadOrder[0].f1_08[0]",
  accountNumbers: "topmostSubform[0].Page1[0].f1_10[0]",
  ssn1: "topmostSubform[0].Page1[0].f1_11[0]",
  ssn2: "topmostSubform[0].Page1[0].f1_12[0]",
  ssn3: "topmostSubform[0].Page1[0].f1_13[0]",
  ein1: "topmostSubform[0].Page1[0].f1_14[0]",
  ein2: "topmostSubform[0].Page1[0].f1_15[0]",
} as const;

export const W9_MAPPED_FIELD_NAMES: readonly string[] = Object.values(W9_FIELDS);

const CLASSIFICATION_CHECKBOX: Record<FederalTaxClassification, string> = {
  individual: W9_FIELDS.individual,
  c_corp: W9_FIELDS.cCorp,
  s_corp: W9_FIELDS.sCorp,
  partnership: W9_FIELDS.partnership,
  trust_estate: W9_FIELDS.trustEstate,
  llc: W9_FIELDS.llc,
  other: W9_FIELDS.other,
};

export function classificationCheckbox(value: FederalTaxClassification): string {
  return CLASSIFICATION_CHECKBOX[value];
}

/** Keys that must never be persisted, even if a client sends them. */
export const TIN_STORAGE_KEYS = [
  "tin",
  "ssn",
  "ein",
  "taxpayerIdentificationNumber",
  "socialSecurityNumber",
  "employerIdentificationNumber",
] as const;
