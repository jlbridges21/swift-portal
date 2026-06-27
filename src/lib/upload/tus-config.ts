/** Build Supabase TUS resumable upload endpoint (prefer direct storage hostname). */
export function getTusUploadEndpoint(): string {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL is not configured.");
  }

  try {
    const host = new URL(supabaseUrl).hostname;
    const match = host.match(/^([a-z0-9-]+)\.supabase\.co$/i);
    if (match?.[1]) {
      return `https://${match[1]}.storage.supabase.co/storage/v1/upload/resumable`;
    }
  } catch {
    // fall through
  }

  return `${supabaseUrl.replace(/\/$/, "")}/storage/v1/upload/resumable`;
}

/** Headers required by Supabase Storage TUS (authorization + apikey). */
export function getTusUploadHeaders(accessToken: string): Record<string, string> {
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!anonKey) {
    throw new Error("NEXT_PUBLIC_SUPABASE_ANON_KEY is not configured.");
  }

  return {
    authorization: `Bearer ${accessToken}`,
    apikey: anonKey,
    "x-upsert": "false",
  };
}
