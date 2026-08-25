/** Clean product UI mockups — fictional content only, no real client data. */

export function PortalMockup() {
  return (
    <div
      className="overflow-hidden rounded-xl border border-[#E2E8F0] bg-white shadow-lg"
      aria-hidden
    >
      <div className="flex items-center gap-2 border-b border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3">
        <div className="h-2.5 w-2.5 rounded-full bg-slate-300" />
        <div className="h-2.5 w-2.5 rounded-full bg-slate-300" />
        <div className="h-2.5 w-2.5 rounded-full bg-slate-300" />
        <div className="ml-3 h-6 flex-1 rounded-md bg-white ring-1 ring-[#E2E8F0]" />
      </div>
      <div className="grid gap-0 md:grid-cols-[200px_1fr]">
        <aside className="hidden border-r border-[#E2E8F0] bg-[#0F172A] p-4 text-slate-300 md:block">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Your Studio
          </p>
          <ul className="mt-4 space-y-2 text-sm">
            {["Projects", "Calendar", "Messages", "Media", "Clients"].map((item) => (
              <li
                key={item}
                className={
                  item === "Projects"
                    ? "rounded-md bg-white/10 px-2 py-1.5 font-medium text-white"
                    : "px-2 py-1.5"
                }
              >
                {item}
              </li>
            ))}
          </ul>
        </aside>
        <div className="p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium text-[#4F46E5]">In progress</p>
              <p className="mt-1 text-lg font-semibold text-[#0F172A]">
                214 Oak Street · Listing Media
              </p>
              <p className="mt-1 text-sm text-[#475569]">Avery Chen · Northside Realty</p>
            </div>
            <span className="rounded-md bg-[#4F46E5]/10 px-2 py-1 text-xs font-medium text-[#4F46E5]">
              Review
            </span>
          </div>
          <div className="mt-5 grid grid-cols-3 gap-2">
            {[1, 2, 3].map((n) => (
              <div
                key={n}
                className="aspect-[4/3] rounded-lg bg-gradient-to-br from-slate-200 to-slate-100"
              />
            ))}
          </div>
          <div className="mt-4 space-y-2 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-3">
            <p className="text-xs font-medium text-[#475569]">Client message</p>
            <p className="text-sm text-[#0F172A]">
              “Looks great. Please keep the dusk exterior and swap photo 3.”
            </p>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="rounded-md bg-[#0F172A] px-3 py-1.5 text-xs font-medium text-white">
              Propose shoot time
            </span>
            <span className="rounded-md border border-[#E2E8F0] bg-white px-3 py-1.5 text-xs font-medium text-[#0F172A]">
              Send estimate
            </span>
            <span className="rounded-md border border-[#E2E8F0] bg-white px-3 py-1.5 text-xs font-medium text-[#0F172A]">
              Payment link
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ClientPortalMockup() {
  return (
    <div
      className="overflow-hidden rounded-xl border border-[#E2E8F0] bg-white shadow-md"
      aria-hidden
    >
      <div className="border-b border-[#E2E8F0] px-5 py-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-[#4F46E5]">
          Client portal
        </p>
        <p className="mt-1 text-base font-semibold text-[#0F172A]">Your project</p>
      </div>
      <div className="space-y-3 p-5">
        {[
          { label: "Estimate approved", done: true },
          { label: "Shoot confirmed · Sat 10:00 AM", done: true },
          { label: "Media ready for review", done: false },
          { label: "Final payment", done: false },
        ].map((row) => (
          <div
            key={row.label}
            className="flex items-center gap-3 rounded-lg border border-[#E2E8F0] px-3 py-2.5"
          >
            <span
              className={
                row.done
                  ? "h-2.5 w-2.5 rounded-full bg-[#16A34A]"
                  : "h-2.5 w-2.5 rounded-full bg-slate-300"
              }
            />
            <span className="text-sm text-[#0F172A]">{row.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
