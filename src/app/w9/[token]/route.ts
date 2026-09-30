import { NextResponse } from "next/server";
import { claimW9Download, W9_DOWNLOAD_HEADERS } from "@/lib/w9-link";
import { logW9Failure } from "@/lib/w9-tin";

export async function GET(
  _request: Request,
  context: { params: Promise<{ token: string }> }
) {
  const { token } = await context.params;
  try {
    const result = await claimW9Download(token);
    if (!result.ok) {
      const message = result.status === 410 ? "This W-9 link is no longer available." : "Not found";
      return NextResponse.json(
        { error: message },
        { status: result.status, headers: { "X-Robots-Tag": "noindex, nofollow", "Cache-Control": "private, no-store" } }
      );
    }
    return new NextResponse(new Uint8Array(result.pdf), { headers: W9_DOWNLOAD_HEADERS });
  } catch (err) {
    logW9Failure(err);
    return NextResponse.json(
      { error: "Could not download the form." },
      { status: 500, headers: { "X-Robots-Tag": "noindex, nofollow", "Cache-Control": "private, no-store" } }
    );
  }
}
