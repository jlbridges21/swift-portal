import { z } from "zod";

/** Wire format for POST /api/analytics/collect (kept small; bodies over 4 KB are rejected). */

const shortText = (max: number) => z.string().trim().max(max);

export const CollectPayloadSchema = z.object({
  v: z.literal(1),
  type: z.enum(["pageview", "cta_click", "signup_start"]),
  eventId: z.uuid(),
  path: z.string().min(1).max(600),
  referrer: z.string().max(600).optional(),
  utm: z
    .object({
      utm_source: shortText(120).optional(),
      utm_medium: shortText(120).optional(),
      utm_campaign: shortText(160).optional(),
      utm_content: shortText(160).optional(),
      utm_term: shortText(160).optional(),
    })
    .partial()
    .optional(),
  mode: z.enum(["persistent", "cookieless"]),
  visitorId: z.uuid().optional(),
  sessionId: z.uuid().optional(),
  cta: z
    .object({
      id: z.string().trim().regex(/^[a-z0-9:_-]{1,80}$/i),
      location: z.string().trim().regex(/^[a-z0-9_-]{1,40}$/i),
    })
    .optional(),
});

export type CollectPayload = z.infer<typeof CollectPayloadSchema>;

export const MAX_COLLECT_BODY_BYTES = 4096;
