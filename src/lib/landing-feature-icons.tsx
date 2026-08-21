/**
 * Lucide icon map for landing feature cards.
 * Keep in sync with LANDING_FEATURE_ICON_IDS in landing-content.ts.
 * Client-safe (no server imports).
 */

import {
  MessageSquare,
  FileDown,
  Calendar,
  Camera,
  Video,
  Globe,
  CreditCard,
  CheckCircle2,
  Home,
  Map,
  Users,
  Building2,
  Clock,
  Send,
  Image as ImageIcon,
  ImagePlus,
  Aperture,
  Film,
  Clapperboard,
  Sun,
  type LucideIcon,
} from "lucide-react";
import type { LandingFeatureIconId } from "@/lib/landing-content";

export const LANDING_FEATURE_ICON_MAP: Record<LandingFeatureIconId, LucideIcon> = {
  MessageSquare,
  FileDown,
  Calendar,
  Camera,
  Video,
  Globe,
  CreditCard,
  CheckCircle2,
  Home,
  Map,
  Users,
  Building2,
  Clock,
  Send,
  Image: ImageIcon,
  ImagePlus,
  Aperture,
  Film,
  Clapperboard,
  Sun,
};

/** Human labels for the icon picker. */
export const LANDING_FEATURE_ICON_LABELS: Record<LandingFeatureIconId, string> = {
  MessageSquare: "Messages",
  FileDown: "Downloads",
  Calendar: "Calendar",
  Camera: "Camera",
  Video: "Video",
  Globe: "Globe / tours",
  CreditCard: "Payments",
  CheckCircle2: "Checklist",
  Home: "Home",
  Map: "Map",
  Users: "People",
  Building2: "Buildings",
  Clock: "Clock",
  Send: "Send",
  Image: "Image",
  ImagePlus: "Add image",
  Aperture: "Aperture",
  Film: "Film",
  Clapperboard: "Clapperboard",
  Sun: "Sun / outdoor",
};
