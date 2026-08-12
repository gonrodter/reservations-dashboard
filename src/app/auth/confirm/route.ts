import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Verifies owner invitations on our own domain. Email templates link here with
 * a token hash, avoiding a visible supabase.co URL that mail filters can treat
 * as a sender/link domain mismatch.
 */
export async function GET(request: NextRequest) {
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type");
  const destination = new URL("/set-password", request.url);

  if (tokenHash && type === "invite") {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: "invite",
    });

    if (!error) return NextResponse.redirect(destination);
  }

  destination.searchParams.set("error", "invalid_invitation");
  return NextResponse.redirect(destination);
}
