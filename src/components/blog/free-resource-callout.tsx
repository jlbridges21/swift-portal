import Link from "next/link";
import { ArrowRight, Calculator, FileText } from "lucide-react";
import { getTool, type ToolKey } from "@/lib/tools/registry";
import { getResource, type ResourceId } from "@/lib/resources/registry";

/**
 * Contextual link from an article to a free tool or template, placed in the section where
 * the reader is doing that task. Registry-driven, so titles and URLs stay in sync.
 */
export function FreeResourceCallout(props: { tool: ToolKey; note?: string } | { resource: ResourceId; note?: string }) {
  const isTool = "tool" in props;
  const entry = isTool ? getTool(props.tool) : getResource(props.resource);
  const Icon = isTool ? Calculator : FileText;
  const title = entry.name.charAt(0).toUpperCase() + entry.name.slice(1);
  return (
    <aside className="not-prose my-6 flex gap-4 rounded-2xl border border-[#C7D2FE] bg-gradient-to-br from-[#EEF2FF] to-white p-5">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-[#4F46E5] ring-1 ring-[#C7D2FE]">
        <Icon className="h-5 w-5" aria-hidden />
      </span>
      <div className="min-w-0">
        <p className="text-xs font-semibold text-[#4F46E5]">{isTool ? "Free tool" : "Free template"}</p>
        <p className="mt-0.5 font-semibold text-[#0F172A]">
          <Link href={entry.path} className="hover:underline">
            {title}
          </Link>
        </p>
        <p className="mt-1 text-sm leading-relaxed text-[#475569]">{props.note ?? entry.summary}</p>
        <Link href={entry.path} className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-[#4F46E5] hover:text-[#4338CA]">
          {isTool ? "Open the free tool" : "Get the free template"} <ArrowRight className="h-3.5 w-3.5" aria-hidden />
        </Link>
      </div>
    </aside>
  );
}
