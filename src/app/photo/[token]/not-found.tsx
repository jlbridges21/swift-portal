import { getPublicHostContext, isActivePublicTenant } from "@/lib/host-resolution";
import { PhotoShareUnavailable } from "@/components/photos/photo-share-viewer";
import { PhotoShareBrand } from "./brand";

export default async function PhotoShareNotFound() {
  const host = await getPublicHostContext();
  if (!isActivePublicTenant(host)) {
    return (
      <div className="flex min-h-dvh items-center justify-center p-6 text-center">
        <p className="text-muted">This page isn&apos;t available.</p>
      </div>
    );
  }
  return (
    <PhotoShareBrand businessId={host.businessId}>
      <PhotoShareUnavailable />
    </PhotoShareBrand>
  );
}
