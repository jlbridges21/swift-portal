-- Swift Portal V40: per-business service catalog + preliminary prices
-- IDEMPOTENT: DROP POLICY IF EXISTS, CREATE TABLE IF NOT EXISTS, ON CONFLICT DO NOTHING.
-- Placeholders {{businessName}} / {{portalName}} are stored verbatim — do not pre-substitute.

CREATE TABLE IF NOT EXISTS business_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  preliminary_estimate_cents INTEGER,
  starting_label TEXT,
  includes JSONB NOT NULL DEFAULT '[]'::jsonb,
  line_items JSONB NOT NULL DEFAULT '[]'::jsonb,
  notes TEXT,
  hide_pricing BOOLEAN NOT NULL DEFAULT false,
  is_recommended BOOLEAN NOT NULL DEFAULT false,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  aliases JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (business_id, slug)
);

DROP TRIGGER IF EXISTS business_services_updated_at ON business_services;
CREATE TRIGGER business_services_updated_at
  BEFORE UPDATE ON business_services
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX IF NOT EXISTS idx_business_services_business_id
  ON business_services (business_id);

CREATE INDEX IF NOT EXISTS idx_business_services_business_display
  ON business_services (business_id, display_order);

ALTER TABLE projects ADD COLUMN IF NOT EXISTS service_id UUID REFERENCES business_services(id);

CREATE INDEX IF NOT EXISTS idx_projects_service_id ON projects (service_id);

ALTER TABLE business_services ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Super admins full access business_services" ON business_services;
CREATE POLICY "Super admins full access business_services" ON business_services
  FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());

DROP POLICY IF EXISTS "Admins full access business_services" ON business_services;
CREATE POLICY "Admins full access business_services" ON business_services
  FOR ALL
  USING (is_super_admin() OR (is_admin() AND business_id = current_business_id()))
  WITH CHECK (is_super_admin() OR (is_admin() AND business_id = current_business_id()));

DROP POLICY IF EXISTS "Clients view active business_services" ON business_services;
CREATE POLICY "Clients view active business_services" ON business_services
  FOR SELECT
  USING (
    business_id = current_business_id()
    AND is_active = true
    AND EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'client')
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON business_services TO authenticated;
GRANT ALL ON business_services TO service_role;

-- ---------------------------------------------------------------------------
-- Seed Swift catalog (placeholders intact)
-- ---------------------------------------------------------------------------
INSERT INTO business_services (
  business_id, name, slug, description, preliminary_estimate_cents, starting_label,
  includes, line_items, notes, hide_pricing, is_recommended, display_order, aliases
)
SELECT
  '00000000-0000-0000-0000-000000000001'::uuid,
  x.name,
  x.slug,
  x.description,
  x.preliminary_estimate_cents,
  x.starting_label,
  x.includes,
  x.line_items,
  x.notes,
  x.hide_pricing,
  x.is_recommended,
  x.display_order,
  x.aliases
FROM jsonb_to_recordset($swift_services$[
  {
    "slug": "aerial_photography",
    "name": "Aerial Photography",
    "description": null,
    "preliminary_estimate_cents": 24900,
    "starting_label": "Starting at $249",
    "includes": [
      "FAA Part 107 licensed pilot",
      "20–30 professionally edited aerial images",
      "Multiple property overview angles",
      "Waterfront or neighborhood context (when applicable)",
      "MLS-ready high-resolution images",
      "Commercial usage rights",
      "Secure {{portalName}} delivery",
      "Typical turnaround: 24–48 hours"
    ],
    "line_items": [
      {
        "description": "Aerial Photography",
        "amount_cents": 24900
      }
    ],
    "notes": "Final pricing depends on property size, accessibility, airspace, travel, and requested shot list.",
    "hide_pricing": false,
    "is_recommended": false,
    "display_order": 0,
    "aliases": [
      "Aerial Photography"
    ]
  },
  {
    "slug": "aerial_videography",
    "name": "Aerial Videography",
    "description": null,
    "preliminary_estimate_cents": 39900,
    "starting_label": "Starting at $399",
    "includes": [
      "Cinematic drone flight",
      "Professionally edited highlight video",
      "Licensed music",
      "Color grading",
      "Social media version",
      "Website version",
      "Commercial usage rights",
      "{{portalName}} delivery"
    ],
    "line_items": [
      {
        "description": "Aerial Videography",
        "amount_cents": 39900
      }
    ],
    "notes": "",
    "hide_pricing": false,
    "is_recommended": false,
    "display_order": 1,
    "aliases": [
      "Aerial Videography"
    ]
  },
  {
    "slug": "exterior_360_tour",
    "name": "Exterior 360° Virtual Tour",
    "description": "Designed for homes, commercial properties, developments, golf courses, resorts, marinas, and outdoor spaces.",
    "preliminary_estimate_cents": 29900,
    "starting_label": "Starting at $299",
    "includes": [
      "Exterior-only 360° capture",
      "Hosted interactive tour",
      "Shareable tour link",
      "Website embed code",
      "{{portalName}} access"
    ],
    "line_items": [
      {
        "description": "Exterior 360° Virtual Tour",
        "amount_cents": 29900
      }
    ],
    "notes": "This service is for exterior virtual tours only. Interior Matterport-style walkthroughs are not included. Pricing varies based on project size.",
    "hide_pricing": false,
    "is_recommended": false,
    "display_order": 2,
    "aliases": [
      "360 Virtual Tour",
      "Exterior 360° Virtual Tour"
    ]
  },
  {
    "slug": "drone_mapping",
    "name": "Drone Mapping",
    "description": null,
    "preliminary_estimate_cents": 59900,
    "starting_label": "Starting at $599",
    "includes": [
      "High-overlap mapping mission",
      "Orthomosaic map",
      "Site documentation",
      "Organized digital deliverables"
    ],
    "line_items": [
      {
        "description": "Drone Mapping",
        "amount_cents": 59900
      }
    ],
    "notes": "",
    "hide_pricing": false,
    "is_recommended": false,
    "display_order": 3,
    "aliases": [
      "Drone Mapping"
    ]
  },
  {
    "slug": "real_estate_media_package",
    "name": "Real Estate Media Package",
    "description": null,
    "preliminary_estimate_cents": 49900,
    "starting_label": "Starting at $499",
    "includes": [
      "Professional aerial photography",
      "Cinematic aerial video",
      "MLS-ready media",
      "Social media video",
      "Commercial usage rights",
      "{{portalName}} delivery"
    ],
    "line_items": [
      {
        "description": "Real Estate Media Package",
        "amount_cents": 49900
      }
    ],
    "notes": "",
    "hide_pricing": false,
    "is_recommended": true,
    "display_order": 4,
    "aliases": [
      "Real Estate Media Package"
    ]
  },
  {
    "slug": "commercial_aerial",
    "name": "Commercial Aerial Media",
    "description": null,
    "preliminary_estimate_cents": 79900,
    "starting_label": "Starting at $799",
    "includes": [
      "Discovery consultation",
      "Commercial aerial photography",
      "Commercial aerial video",
      "Marketing-ready media",
      "Commercial licensing"
    ],
    "line_items": [
      {
        "description": "Commercial Aerial Media",
        "amount_cents": 79900
      }
    ],
    "notes": "",
    "hide_pricing": false,
    "is_recommended": false,
    "display_order": 5,
    "aliases": [
      "Commercial Aerial",
      "Commercial Aerial Media"
    ]
  },
  {
    "slug": "event_coverage",
    "name": "Event Coverage",
    "description": null,
    "preliminary_estimate_cents": 59900,
    "starting_label": "Starting at $599",
    "includes": [
      "Drone photography",
      "Drone videography",
      "Highlight video",
      "Commercial licensing",
      "{{portalName}} delivery"
    ],
    "line_items": [
      {
        "description": "Event Coverage",
        "amount_cents": 59900
      }
    ],
    "notes": "",
    "hide_pricing": false,
    "is_recommended": false,
    "display_order": 6,
    "aliases": [
      "Event Coverage"
    ]
  },
  {
    "slug": "construction_progress",
    "name": "Construction Progress Documentation",
    "description": null,
    "preliminary_estimate_cents": 29900,
    "starting_label": "Starting at $299 per visit",
    "includes": [
      "Scheduled drone site visit",
      "Progress photography",
      "Progress video",
      "Chronological project archive",
      "Secure {{portalName}} delivery"
    ],
    "line_items": [
      {
        "description": "Construction Progress Documentation",
        "amount_cents": 29900
      }
    ],
    "notes": "",
    "hide_pricing": false,
    "is_recommended": false,
    "display_order": 7,
    "aliases": [
      "Construction Progress Documentation"
    ]
  },
  {
    "slug": "land_listing",
    "name": "Land Listing Package",
    "description": null,
    "preliminary_estimate_cents": 34900,
    "starting_label": "Starting at $349",
    "includes": [
      "Property overview photography",
      "Boundary highlight imagery",
      "Access road imagery",
      "Nearby landmarks",
      "Waterfront context when applicable",
      "MLS-ready images"
    ],
    "line_items": [
      {
        "description": "Land Listing Package",
        "amount_cents": 34900
      }
    ],
    "notes": "",
    "hide_pricing": false,
    "is_recommended": false,
    "display_order": 8,
    "aliases": [
      "Land Listing Package"
    ]
  },
  {
    "slug": "golf_resort",
    "name": "Golf Course & Resort Marketing",
    "description": "Custom proposal based on property size, deliverables, and marketing goals.",
    "preliminary_estimate_cents": 0,
    "starting_label": "Custom Proposal Required",
    "includes": [],
    "line_items": [
      {
        "description": "Custom Proposal Required",
        "amount_cents": 0
      }
    ],
    "notes": "A custom official proposal will be prepared after project review.",
    "hide_pricing": true,
    "is_recommended": false,
    "display_order": 9,
    "aliases": [
      "Golf Course & Resort Marketing"
    ]
  },
  {
    "slug": "roof_inspection",
    "name": "Roof Inspection",
    "description": null,
    "preliminary_estimate_cents": 19900,
    "starting_label": "Starting at $199",
    "includes": [
      "High-resolution inspection imagery",
      "Roof overview",
      "Chimney",
      "Flashing",
      "Gutters",
      "Roof penetrations",
      "Secure digital delivery"
    ],
    "line_items": [
      {
        "description": "Roof Inspection",
        "amount_cents": 19900
      }
    ],
    "notes": "",
    "hide_pricing": false,
    "is_recommended": false,
    "display_order": 10,
    "aliases": [
      "Roof Inspection"
    ]
  },
  {
    "slug": "property_documentation",
    "name": "Property Documentation",
    "description": null,
    "preliminary_estimate_cents": 24900,
    "starting_label": "Starting at $249",
    "includes": [
      "Exterior property overview",
      "Roof imagery",
      "Storm damage documentation",
      "High-resolution photography",
      "Date-stamped digital delivery",
      "Secure {{portalName}} delivery"
    ],
    "line_items": [
      {
        "description": "Property Documentation",
        "amount_cents": 24900
      }
    ],
    "notes": "{{businessName}} documents visible property conditions from the air. We do not provide engineering reports or insurance adjusting services.",
    "hide_pricing": false,
    "is_recommended": false,
    "display_order": 11,
    "aliases": [
      "Property Documentation",
      "Insurance Documentation"
    ]
  },
  {
    "slug": "marina_waterfront",
    "name": "Marina & Waterfront Marketing",
    "description": null,
    "preliminary_estimate_cents": 39900,
    "starting_label": "Starting at $399",
    "includes": [
      "Marina overview imagery",
      "Waterfront context",
      "Lifestyle photography",
      "Commercial usage rights"
    ],
    "line_items": [
      {
        "description": "Marina & Waterfront Marketing",
        "amount_cents": 39900
      }
    ],
    "notes": "",
    "hide_pricing": false,
    "is_recommended": false,
    "display_order": 12,
    "aliases": [
      "Marina & Waterfront Marketing"
    ]
  },
  {
    "slug": "hoa_community",
    "name": "HOA & Community Marketing",
    "description": null,
    "preliminary_estimate_cents": 49900,
    "starting_label": "Starting at $499",
    "includes": [
      "Entrance monument",
      "Amenities",
      "Pool",
      "Clubhouse",
      "Walking trails",
      "Common areas",
      "Aerial overview"
    ],
    "line_items": [
      {
        "description": "HOA & Community Marketing",
        "amount_cents": 49900
      }
    ],
    "notes": "",
    "hide_pricing": false,
    "is_recommended": false,
    "display_order": 13,
    "aliases": [
      "HOA & Community Marketing"
    ]
  },
  {
    "slug": "custom_project",
    "name": "Custom Project",
    "description": "{{businessName}} will review your request and prepare a custom proposal based on the project scope.",
    "preliminary_estimate_cents": 0,
    "starting_label": "Custom Quote",
    "includes": [],
    "line_items": [
      {
        "description": "Custom Proposal Required",
        "amount_cents": 0
      }
    ],
    "notes": "Final pricing will be confirmed after scope review and scheduling.",
    "hide_pricing": true,
    "is_recommended": false,
    "display_order": 14,
    "aliases": [
      "Other",
      "Custom Project"
    ]
  }
]$swift_services$::jsonb)
  AS x(
    slug text,
    name text,
    description text,
    preliminary_estimate_cents integer,
    starting_label text,
    includes jsonb,
    line_items jsonb,
    notes text,
    hide_pricing boolean,
    is_recommended boolean,
    display_order integer,
    aliases jsonb
  )
ON CONFLICT (business_id, slug) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Seed Test Pilot Drones starter catalog
-- ---------------------------------------------------------------------------
INSERT INTO business_services (
  business_id, name, slug, description, preliminary_estimate_cents, starting_label,
  includes, line_items, notes, hide_pricing, is_recommended, display_order, aliases
)
SELECT
  '00000000-0000-0000-0000-0000000000aa'::uuid,
  x.name,
  x.slug,
  x.description,
  x.preliminary_estimate_cents,
  x.starting_label,
  x.includes,
  x.line_items,
  x.notes,
  x.hide_pricing,
  x.is_recommended,
  x.display_order,
  x.aliases
FROM jsonb_to_recordset($pilot_services$[
  {
    "slug": "aerial_photography",
    "name": "Aerial Photography",
    "description": "Professional aerial stills for listings, sites, and marketing.",
    "preliminary_estimate_cents": 24900,
    "starting_label": "Starting at $249",
    "includes": ["Licensed drone pilot", "Edited aerial stills", "Digital delivery via {{portalName}}"],
    "line_items": [{"description": "Aerial Photography", "amount_cents": 24900}],
    "notes": "Final pricing depends on property size, access, and shot list.",
    "hide_pricing": false,
    "is_recommended": true,
    "display_order": 0,
    "aliases": ["Aerial Photography"]
  },
  {
    "slug": "aerial_videography",
    "name": "Aerial Videography",
    "description": "Cinematic aerial video for marketing and social media.",
    "preliminary_estimate_cents": 39900,
    "starting_label": "Starting at $399",
    "includes": ["Cinematic drone flight", "Edited highlight video", "{{portalName}} delivery"],
    "line_items": [{"description": "Aerial Videography", "amount_cents": 39900}],
    "notes": "",
    "hide_pricing": false,
    "is_recommended": false,
    "display_order": 1,
    "aliases": ["Aerial Videography"]
  },
  {
    "slug": "drone_mapping",
    "name": "Aerial Mapping",
    "description": "Orthomosaic mapping and site documentation.",
    "preliminary_estimate_cents": 59900,
    "starting_label": "Starting at $599",
    "includes": ["Mapping mission", "Orthomosaic map", "Organized digital deliverables"],
    "line_items": [{"description": "Aerial Mapping", "amount_cents": 59900}],
    "notes": "",
    "hide_pricing": false,
    "is_recommended": false,
    "display_order": 2,
    "aliases": ["Aerial Mapping", "Drone Mapping"]
  },
  {
    "slug": "custom_project",
    "name": "Custom Project",
    "description": "{{businessName}} will review your request and prepare a custom proposal based on the project scope.",
    "preliminary_estimate_cents": 0,
    "starting_label": "Custom Quote",
    "includes": [],
    "line_items": [{"description": "Custom Proposal Required", "amount_cents": 0}],
    "notes": "Final pricing will be confirmed after scope review and scheduling.",
    "hide_pricing": true,
    "is_recommended": false,
    "display_order": 3,
    "aliases": ["Other", "Custom Project"]
  }
]$pilot_services$::jsonb)
  AS x(
    slug text,
    name text,
    description text,
    preliminary_estimate_cents integer,
    starting_label text,
    includes jsonb,
    line_items jsonb,
    notes text,
    hide_pricing boolean,
    is_recommended boolean,
    display_order integer,
    aliases jsonb
  )
ON CONFLICT (business_id, slug) DO NOTHING;

-- ---------------------------------------------------------------------------
-- preliminaryDisclaimer on proposals settings (placeholder intact)
-- ---------------------------------------------------------------------------
UPDATE business_settings
SET
  settings = jsonb_set(
    coalesce(settings, '{}'::jsonb),
    '{proposals,preliminaryDisclaimer}',
    to_jsonb($disc$This estimate is generated automatically based on the service you selected. It is intended to provide a realistic starting price for your project. Final pricing may be adjusted after {{businessName}} reviews the property, confirms the scope of work, and schedules the shoot.$disc$::text),
    true
  ),
  updated_at = now()
WHERE business_id IN (
  '00000000-0000-0000-0000-000000000001'::uuid,
  '00000000-0000-0000-0000-0000000000aa'::uuid
)
AND coalesce(settings#>>'{proposals,preliminaryDisclaimer}', '') = '';

-- ---------------------------------------------------------------------------
-- Backfill projects.service_id within the same business
-- ---------------------------------------------------------------------------
UPDATE projects p
SET service_id = matched.sid
FROM (
  SELECT p2.id AS pid, s.id AS sid
  FROM projects p2
  JOIN business_services s ON s.business_id = p2.business_id
  WHERE p2.service_id IS NULL
    AND p2.service_type IS NOT NULL
    AND (
      lower(trim(p2.service_type)) = lower(trim(s.name))
      OR EXISTS (
        SELECT 1
        FROM jsonb_array_elements_text(s.aliases) a
        WHERE lower(trim(a)) = lower(trim(p2.service_type))
      )
    )
) matched
WHERE p.id = matched.pid
  AND p.service_id IS NULL;

SELECT
  count(*) FILTER (WHERE service_id IS NOT NULL) AS matched_with_service_id,
  count(*) FILTER (WHERE service_id IS NULL) AS unmatched_service_id
FROM projects
WHERE deleted_at IS NULL;

SELECT id, business_id, project_name, service_type
FROM projects
WHERE deleted_at IS NULL AND service_id IS NULL
ORDER BY business_id, created_at;
