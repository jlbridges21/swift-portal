"use client";

import { useEffect, useState } from "react";
import { Box, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { Project3dModel } from "@/lib/types";
import {
  EXTERNAL_3D_PROVIDER_LABELS,
  isExternal3dProvider,
  type External3dProvider,
} from "@/lib/external-3d-models";

interface Model3dCardProps {
  model: Project3dModel;
  embedInPortal?: boolean;
}

function providerLabel(provider: string): string {
  return isExternal3dProvider(provider)
    ? EXTERNAL_3D_PROVIDER_LABELS[provider]
    : provider;
}

function iframeAttrs(provider: string): { sandbox: string; allow: string } {
  // Minimum sandbox: WebGL players need scripts. same-origin is required where the
  // player uses WASM/cookies on its own origin. allow-popups only when the viewer
  // opens auth/help windows. Never allow-top-navigation.
  const fallback = {
    sandbox: "allow-scripts allow-same-origin allow-popups",
    allow: "fullscreen; xr-spatial-tracking; accelerometer; gyroscope",
  };
  if (!isExternal3dProvider(provider)) return fallback;
  const defaults: Record<External3dProvider, { sandbox: string; allow: string }> = {
    // Polycam embeds load WASM from poly.cam — needs same-origin; no popups observed.
    polycam: {
      sandbox: "allow-scripts allow-same-origin",
      allow: "fullscreen; xr-spatial-tracking; accelerometer; gyroscope",
    },
    // Sketchfab opens account/login popups from the embed chrome.
    sketchfab: {
      sandbox: "allow-scripts allow-same-origin allow-popups",
      allow: "fullscreen; xr-spatial-tracking; accelerometer; gyroscope",
    },
    // Matterport space player uses forms + popups for guided tours / VR entry.
    matterport: {
      sandbox: "allow-scripts allow-same-origin allow-popups allow-forms",
      allow: "fullscreen; xr-spatial-tracking; accelerometer; gyroscope; autoplay",
    },
    // Remaining providers: pass-through embeds; keep scripts+same-origin+popups for WebGL/auth.
    agisoft: fallback,
    pix4d: fallback,
    dronedeploy: fallback,
    cesium: fallback,
    arcgis: fallback,
  };
  return defaults[provider];
}

export function Model3dCard({ model, embedInPortal }: Model3dCardProps) {
  const [frameFailed, setFrameFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const attrs = iframeAttrs(model.provider);

  useEffect(() => {
    setFrameFailed(false);
    setLoaded(false);
    // Some providers refuse framing without firing onError — soft timeout.
    const t = window.setTimeout(() => {
      setLoaded((prev) => {
        if (!prev) setFrameFailed(true);
        return prev;
      });
    }, 12_000);
    return () => window.clearTimeout(t);
  }, [model.embed_url]);

  return (
    <Card className="overflow-hidden shadow-sm">
      {embedInPortal && (
        <div className="relative aspect-[4/3] w-full bg-slate-900 sm:aspect-video">
          {!frameFailed ? (
            <>
              {!loaded && (
                <div className="absolute inset-0 flex items-center justify-center text-sm text-slate-300">
                  Loading 3D viewer…
                </div>
              )}
              <iframe
                src={model.embed_url}
                className="h-full w-full border-0"
                title={model.title}
                sandbox={attrs.sandbox}
                allow={attrs.allow}
                referrerPolicy="strict-origin-when-cross-origin"
                allowFullScreen
                onLoad={() => {
                  setLoaded(true);
                  setFrameFailed(false);
                }}
                onError={() => setFrameFailed(true)}
              />
            </>
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
              <Box className="h-8 w-8 text-slate-400" />
              <p className="text-sm text-slate-200">
                This {providerLabel(model.provider)} viewer could not be embedded here
                (the provider may block framing).
              </p>
              <a href={model.embed_url} target="_blank" rel="noopener noreferrer">
                <Button variant="accent" size="sm">
                  <ExternalLink className="h-4 w-4" />
                  Open in new tab
                </Button>
              </a>
            </div>
          )}
        </div>
      )}
      <CardContent className="p-6">
        <div className="flex flex-col gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted">
              {providerLabel(model.provider)}
            </p>
            <h3 className="font-semibold text-foreground">{model.title}</h3>
            {model.description ? (
              <p className="mt-1 text-sm text-muted">{model.description}</p>
            ) : (
              <p className="mt-1 text-sm text-muted">Interactive 3D model</p>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <a href={model.embed_url} target="_blank" rel="noopener noreferrer">
              <Button variant="accent" size="sm">
                <ExternalLink className="h-4 w-4" />
                Open in New Tab
              </Button>
            </a>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
