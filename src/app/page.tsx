import Link from "next/link";
import Image from "next/image";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { Button } from "@/components/ui/button";
import { BRAND } from "@/lib/brand";
import { Camera, Video, Globe, FileDown, CreditCard, Clock } from "lucide-react";

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary to-slate-800" />
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmZmZmYiIGZpbGwtb3BhY2l0eT0iMC4wMyI+PHBhdGggZD0iTTM2IDM0djItaDJ2LTJoLTJ6bTAtNHYyaDJ2LTJoLTJ6bTAgNHYyaDJ2LTJoLTJ6bTAtNHYyaDJ2LTJoLTJ6bTAtNHYyaDJ2LTJoLTJ6bTAgNHYyaDJ2LTJoLTJ6bTAtNHYyaDJ2LTJoLTJ6bTAgNHYyaDJ2LTJoLTJ6Ii8+PC9nPjwvZz48L3N2Zz4=')] opacity-50" />
          <div className="relative mx-auto max-w-7xl px-4 py-24 sm:px-6 sm:py-32 lg:px-8">
            <div className="max-w-2xl">
              <div className="mb-6 inline-flex items-center gap-3 rounded-xl bg-primary/50 p-3 pr-5 ring-1 ring-white/10">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary">
                  <Image src={BRAND.logoUrl} alt={BRAND.name} width={36} height={36} className="object-contain" priority />
                </div>
                <span className="text-sm font-medium text-slate-300">{BRAND.name}</span>
              </div>
              <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl lg:text-6xl">
                Professional Media Delivery. Simplified.
              </h1>
              <p className="mt-6 text-lg text-slate-300 leading-relaxed">
                Request projects, review deliverables, access aerial media, and manage everything in one place.
              </p>
              <div className="mt-10 flex flex-col gap-4 sm:flex-row">
                <Link href="/request">
                  <Button variant="accent" size="lg" className="w-full sm:w-auto">
                    Request a Shoot
                  </Button>
                </Link>
                <Link href="/login">
                  <Button
                    variant="outline"
                    size="lg"
                    className="w-full sm:w-auto border-white/20 bg-white/10 text-white hover:bg-white/20"
                  >
                    Client Login
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="py-24 bg-background">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-2xl mx-auto mb-16">
              <h2 className="text-3xl font-bold text-primary">Everything in one portal</h2>
              <p className="mt-4 text-muted">
                A premium experience for accessing your aerial media, tracking projects, and managing payments.
              </p>
            </div>

            <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
              {[
                {
                  icon: Camera,
                  title: "Photo Gallery",
                  description: "Browse and download high-resolution aerial photography in a beautiful gallery.",
                },
                {
                  icon: Video,
                  title: "Video Delivery",
                  description: "Stream and download professional aerial videography directly from your portal.",
                },
                {
                  icon: Globe,
                  title: "360° Tours",
                  description: "Access interactive virtual tours with shareable links and embed codes.",
                },
                {
                  icon: Clock,
                  title: "Project Tracking",
                  description: "Follow your project from shoot to delivery with real-time status updates.",
                },
                {
                  icon: CreditCard,
                  title: "Secure Payments",
                  description: "Pay invoices securely through Stripe with instant confirmation.",
                },
                {
                  icon: FileDown,
                  title: "Deliverables",
                  description: "Download all your project files, documents, and media in one place.",
                },
              ].map((feature) => (
                <div
                  key={feature.title}
                  className="rounded-xl border border-border bg-white p-6 shadow-sm transition-shadow hover:shadow-md"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10">
                    <feature.icon className="h-5 w-5 text-accent" />
                  </div>
                  <h3 className="mt-4 font-semibold text-primary">{feature.title}</h3>
                  <p className="mt-2 text-sm text-muted leading-relaxed">{feature.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="bg-primary py-16">
          <div className="mx-auto max-w-7xl px-4 text-center sm:px-6 lg:px-8">
            <h2 className="text-2xl font-bold text-white sm:text-3xl">
              Ready to elevate your property marketing?
            </h2>
            <p className="mt-4 text-slate-300">
              Request a shoot today and experience professional aerial media delivery.
            </p>
            <Link href="/request" className="inline-block mt-8">
              <Button variant="accent" size="lg">Get Started</Button>
            </Link>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
