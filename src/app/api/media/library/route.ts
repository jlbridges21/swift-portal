import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getLibraryFilterOptions, queryMediaLibrary } from "@/lib/media-library";

export async function GET(request: Request) {
  try {
    await requireAdmin();
    const { searchParams } = new URL(request.url);

    const result = await queryMediaLibrary({
      q: searchParams.get("q") ?? undefined,
      type: searchParams.get("type") ?? undefined,
      service: searchParams.get("service") ?? undefined,
      propertyType: searchParams.get("property_type") ?? undefined,
      projectStatus: searchParams.get("project_status") ?? undefined,
      source: searchParams.get("source") ?? undefined,
      datePreset: searchParams.get("date") ?? undefined,
      dateFrom: searchParams.get("date_from") ?? undefined,
      dateTo: searchParams.get("date_to") ?? undefined,
      clientId: searchParams.get("client_id") ?? undefined,
      propertyId: searchParams.get("property_id") ?? undefined,
      favoritesOnly: searchParams.get("favorites") === "1",
      page: Number(searchParams.get("page") ?? 1),
      limit: Number(searchParams.get("limit") ?? 48),
    });

    if (searchParams.get("options") === "1") {
      const options = await getLibraryFilterOptions();
      return NextResponse.json({ ...result, filterOptions: options });
    }

    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
