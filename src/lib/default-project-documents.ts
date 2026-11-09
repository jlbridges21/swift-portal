/**
 * Default documents copied into every NEW project's Documents section.
 *
 * Defaults live in `default_project_documents` (v114) with files in the
 * project-documents bucket under {businessId}/default-documents/. On project
 * creation each file is copied to its own object under {businessId}/{projectId}/
 * and saved as a normal `media_assets` document — so project copies follow the
 * project's Documents visibility and are fully independent of the default.
 */
import { buildStoragePath } from "@/lib/media-upload";
import { createTenantServiceClient } from "@/lib/supabase/tenant-service";
import {
  DEFAULT_DOCUMENTS_BUCKET,
  isMissingDefaultDocumentsTable,
  type DefaultProjectDocument,
} from "@/lib/default-project-documents-shared";

export * from "@/lib/default-project-documents-shared";

/**
 * Copy every default document into a newly created project. Never throws —
 * a failed copy must not fail project creation. Returns how many were added.
 */
export async function copyDefaultDocumentsToProject(
  businessId: string,
  projectId: string
): Promise<number> {
  try {
    const db = await createTenantServiceClient(businessId);
    const { data: defaults, error } = await db
      .from("default_project_documents")
      .select("*")
      .order("display_order", { ascending: true })
      .order("created_at", { ascending: true });
    if (error) {
      if (!isMissingDefaultDocumentsTable(error)) {
        console.error("[default-documents] list failed", error.message);
      }
      return 0;
    }
    if (!defaults?.length) return 0;

    const { data: last } = await db
      .from("media_assets")
      .select("display_order")
      .eq("project_id", projectId)
      .eq("media_type", "document")
      .order("display_order", { ascending: false })
      .limit(1)
      .maybeSingle();
    let order = (last?.display_order ?? -1) + 1;

    let added = 0;
    for (const doc of defaults as DefaultProjectDocument[]) {
      const target = buildStoragePath({ businessId, projectId, fileName: doc.file_name });
      const { error: copyErr } = await db.raw.storage
        .from(DEFAULT_DOCUMENTS_BUCKET)
        .copy(doc.file_path, target);
      if (copyErr) {
        console.error("[default-documents] copy failed", doc.id, copyErr.message);
        continue;
      }
      const { error: insertErr } = await db.from("media_assets").insert({
        project_id: projectId,
        file_name: doc.file_name,
        file_path: target,
        storage_path: target,
        file_size: doc.file_size,
        mime_type: doc.mime_type,
        media_type: "document",
        media_source: "upload",
        display_order: order,
        title: doc.title || doc.file_name,
      });
      if (insertErr) {
        console.error("[default-documents] insert failed", doc.id, insertErr.message);
        await db.raw.storage.from(DEFAULT_DOCUMENTS_BUCKET).remove([target]);
        continue;
      }
      order += 1;
      added += 1;
    }
    return added;
  } catch (err) {
    console.error("[default-documents] copy to project failed", err);
    return 0;
  }
}
