import Link from "next/link";
import { Logo } from "@/components/brand/logo";

export function Footer() {
  return (
    <footer className="border-t border-border bg-primary">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center justify-between gap-6 sm:flex-row">
          <Logo href="/" size="sm" showText />
          <p className="text-sm text-slate-400">
            &copy; {new Date().getFullYear()} Swift Aerial Media. All rights reserved.
          </p>
          <div className="flex gap-6 text-sm text-slate-300">
            <Link href="/request" className="transition-colors hover:text-white">Request a Shoot</Link>
            <Link href="/login" className="transition-colors hover:text-white">Client Login</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
