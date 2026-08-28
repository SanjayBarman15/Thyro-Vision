// app/api/admin/performance/snapshot/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function POST() {
  const supabase = await createClient();

  // Verify user is authenticated
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get the user's access token to forward to FastAPI
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) {
    return NextResponse.json({ error: "No session" }, { status: 401 });
  }

  // Forward to FastAPI with user's JWT
  const response = await fetch(
    `${process.env.NEXT_PUBLIC_BACKEND_URL}/admin/performance/snapshot`,
    {
      method: "POST",
      headers: {
        // ✅ Send user JWT — FastAPI verifies this + checks admin role
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
      },
    },
  );

  if (!response.ok) {
    const error = await response.json();
    return NextResponse.json(error, { status: response.status });
  }

  const data = await response.json();
  return NextResponse.json(data);
}
