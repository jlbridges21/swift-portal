import { PDFDocument } from "pdf-lib";
import { createServiceClient } from "@/lib/supabase/server";
import { W9_MAPPED_FIELD_NAMES } from "@/lib/w9-fields";

export type W9TemplateRow = {
  id: string;
  revision_label: string;
  active: boolean;
  created_at: string;
};

export function missingW9Fields(present: Iterable<string>): string[] {
  const have = new Set(present);
  return W9_MAPPED_FIELD_NAMES.filter((name) => !have.has(name));
}

export async function readW9FieldNames(bytes: Uint8Array): Promise<string[]> {
  let pdf: PDFDocument;
  try {
    pdf = await PDFDocument.load(bytes);
  } catch {
    throw new Error("That file is not a readable PDF.");
  }
  return pdf.getForm().getFields().map((field) => field.getName());
}

export async function listW9Templates(): Promise<W9TemplateRow[]> {
  const supabase = await createServiceClient();
  const { data, error } = await supabase
    .from("w9_form_templates")
    .select("id, revision_label, active, created_at")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as W9TemplateRow[];
}

export async function loadActiveW9Template(): Promise<Uint8Array> {
  const supabase = await createServiceClient();
  const { data, error } = await supabase
    .from("w9_form_templates")
    .select("pdf_base64")
    .eq("active", true)
    .maybeSingle();
  if (error) throw new Error("W-9 template could not be loaded");
  if (!data?.pdf_base64) throw new Error("No W-9 form is uploaded yet.");
  return Buffer.from(data.pdf_base64 as string, "base64");
}

export async function saveW9Template(args: {
  bytes: Uint8Array;
  revisionLabel: string;
  uploadedBy: string;
}): Promise<{ id: string }> {
  const missing = missingW9Fields(await readW9FieldNames(args.bytes));
  if (missing.length) {
    throw new Error(`This PDF is missing W-9 fields: ${missing.join(", ")}`);
  }
  const supabase = await createServiceClient();
  await supabase.from("w9_form_templates").update({ active: false }).eq("active", true);
  const { data, error } = await supabase
    .from("w9_form_templates")
    .insert({
      revision_label: args.revisionLabel,
      pdf_base64: Buffer.from(args.bytes).toString("base64"),
      active: true,
      uploaded_by: args.uploadedBy,
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(error?.message || "Could not store the W-9 template");
  return { id: data.id as string };
}

export async function rollbackW9Template(id: string): Promise<void> {
  const supabase = await createServiceClient();
  const { data, error } = await supabase
    .from("w9_form_templates")
    .select("id, pdf_base64")
    .eq("id", id)
    .maybeSingle();
  if (error || !data?.pdf_base64) throw new Error("That template revision was not found.");
  const missing = missingW9Fields(await readW9FieldNames(Buffer.from(data.pdf_base64 as string, "base64")));
  if (missing.length) {
    throw new Error(`Cannot roll back. This revision is missing W-9 fields: ${missing.join(", ")}`);
  }
  await supabase.from("w9_form_templates").update({ active: false }).eq("active", true);
  const { error: activateError } = await supabase
    .from("w9_form_templates")
    .update({ active: true })
    .eq("id", id);
  if (activateError) throw new Error(activateError.message);
}
