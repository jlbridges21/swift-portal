export default function PayLinkNotFound() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background p-6">
      <div className="max-w-sm text-center">
        <h1 className="text-lg font-semibold text-heading">This payment link isn&apos;t available</h1>
        <p className="mt-2 text-sm text-muted">
          The link may be incomplete or no longer active. Please contact the business that sent it for a new link.
        </p>
      </div>
    </div>
  );
}
