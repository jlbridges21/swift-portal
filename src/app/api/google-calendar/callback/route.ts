import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { requireAdmin } from "@/lib/auth";
import {
  exchangeGoogleCode,
  getGoogleUserEmail,
  saveGoogleCalendarConnection,
  listGoogleCalendars,
  setGoogleCalendarId,
} from "@/lib/google-calendar";

export async function GET(request: Request) {
  try {
    const profile = await requireAdmin();
    const { searchParams } = new URL(request.url);
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const error = searchParams.get("error");

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

    if (error) {
      return NextResponse.redirect(`${appUrl}/admin/settings?gcal=error`);
    }

    const cookieStore = await cookies();
    const savedState = cookieStore.get("gcal_oauth_state")?.value;
    if (!code || !state || state !== savedState) {
      return NextResponse.redirect(`${appUrl}/admin/settings?gcal=invalid`);
    }

    const tokens = await exchangeGoogleCode(code);
    const email = await getGoogleUserEmail(tokens.access_token);

    await saveGoogleCalendarConnection({
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token ?? "",
      expiresIn: tokens.expires_in,
      email,
      userId: profile.id,
    });

    const calendars = await listGoogleCalendars();
    const primary = calendars.find((c) => c.primary) ?? calendars[0];
    if (primary) {
      await setGoogleCalendarId(primary.id, primary.summary);
    }

    const response = NextResponse.redirect(`${appUrl}/admin/settings?gcal=connected`);
    response.cookies.delete("gcal_oauth_state");
    return response;
  } catch {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    return NextResponse.redirect(`${appUrl}/admin/settings?gcal=error`);
  }
}
