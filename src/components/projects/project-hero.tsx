"use client";

import Image from "next/image";
import type { HeroMedia } from "@/lib/cover";
import { CoverPlaceholder } from "@/components/projects/cover-placeholder";
import { StatusBadge } from "@/components/ui/badge";
import { getClientStatusLabel, normalizeStatus } from "@/lib/constants";
import type { ReactNode } from "react";

interface ProjectHeroProps {
  hero: HeroMedia;
  projectName: string;
  propertyAddress: string;
  serviceType?: string;
  status: string;
  children?: ReactNode;
  compact?: boolean;
  audience?: "admin" | "client";
  microsite?: boolean;
}

export function ProjectHero({
  hero,
  projectName,
  propertyAddress,
  serviceType,
  status,
  children,
  compact,
  audience = "client",
  microsite = false,
}: ProjectHeroProps) {
  const isMicrosite = microsite && audience === "client";
  const padding = compact ? "py-12" : isMicrosite ? "py-20 sm:py-28" : "py-16";
  const minHeight = isMicrosite ? "min-h-[420px] sm:min-h-[520px]" : "min-h-[200px]";

  const title = isMicrosite ? propertyAddress : projectName;
  const subtitle = isMicrosite ? serviceType : propertyAddress;

  return (
    <section className={`relative bg-primary ${minHeight} overflow-hidden`}>
      {hero ? (
        <div className="absolute inset-0">
          {hero.type === "image" && (
            <Image src={hero.url} alt="" fill className="object-cover" priority sizes="100vw" />
          )}
          {hero.type === "video" && (
            <video
              src={hero.url}
              autoPlay
              muted
              loop
              playsInline
              className="h-full w-full object-cover"
            />
          )}
          {hero.type === "youtube" && (
            <>
              {hero.posterUrl && (
                <Image src={hero.posterUrl} alt="" fill className="object-cover" sizes="100vw" />
              )}
              <iframe
                src={`${hero.embedUrl}?autoplay=1&mute=1&controls=0&loop=1&playlist=${extractPlaylistId(hero.embedUrl)}`}
                className="absolute inset-0 h-full w-full object-cover pointer-events-none scale-[1.35]"
                allow="autoplay; encrypted-media"
                title="Property hero"
              />
            </>
          )}
          <div
            className={`absolute inset-0 ${
              isMicrosite
                ? "bg-gradient-to-t from-[#0F172A] via-[#0F172A]/70 to-[#0F172A]/30"
                : "bg-gradient-to-t from-primary via-primary/75 to-primary/40"
            }`}
          />
        </div>
      ) : (
        <CoverPlaceholder variant="hero" />
      )}

      <div className={`relative mx-auto max-w-6xl px-5 ${padding} sm:px-6 lg:px-8 safe-area-x`}>
        {isMicrosite && (
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-blue-300">
            Swift Aerial Media
          </p>
        )}
        <StatusBadge status={status} audience={audience} className="mb-4" />
        <h1
          className={`font-bold tracking-tight text-white ${
            isMicrosite
              ? "text-3xl sm:text-4xl lg:text-5xl leading-tight max-w-4xl"
              : "text-3xl sm:text-4xl"
          }`}
        >
          {title}
        </h1>
        {subtitle && (
          <p
            className={`mt-3 ${
              isMicrosite
                ? "text-lg sm:text-xl text-slate-300 font-medium"
                : "flex items-center gap-2 text-slate-300"
            }`}
          >
            {subtitle}
          </p>
        )}
        {isMicrosite && (
          <p className="mt-2 text-sm text-slate-400">
            {getClientStatusLabel(normalizeStatus(status))}
            {projectName !== propertyAddress && (
              <span className="text-slate-500"> · {projectName}</span>
            )}
          </p>
        )}
        {children}
      </div>
    </section>
  );
}

function extractPlaylistId(embedUrl: string): string {
  const match = embedUrl.match(/\/embed\/([a-zA-Z0-9_-]{11})/);
  return match?.[1] ?? "";
}
