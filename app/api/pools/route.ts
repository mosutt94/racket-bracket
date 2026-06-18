import { NextResponse } from "next/server";
import { createPool, createPoolByEmail, isSupabaseConfigured, listPools } from "@/lib/supabase/persistence";
import { hashPassword } from "@/lib/auth/password";
import { setCommissionerCookie } from "@/lib/auth/cookie";
import { validatePassword } from "@/lib/password-rules";
import type { Gender, SlamType } from "@/lib/types";

const VALID_SLAMS: ReadonlyArray<SlamType> = ["australian_open", "french_open", "wimbledon", "us_open"];
const VALID_GENDERS: ReadonlyArray<Gender> = ["men", "women"];

export async function GET(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "Supabase is not configured." }, { status: 500 });
  }
  const userId = new URL(request.url).searchParams.get("userId");
  try {
    return NextResponse.json(await listPools(userId));
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Could not load brackets." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "Supabase is not configured." }, { status: 500 });
  }

  const { name, commissionerUserId, inviteCode, email, displayName, slamType, year, gender, password } = await request.json();

  if (!name || (!commissionerUserId && !email)) {
    return NextResponse.json({ ok: false, error: "Bracket name and commissioner email are required." }, { status: 400 });
  }
  // A password is optional (commissioners can set it later in Admin), but if one
  // is provided it must be valid before we create anything.
  if (password !== undefined && password !== null && password !== "") {
    const passwordError = validatePassword(password);
    if (passwordError) {
      return NextResponse.json({ ok: false, error: passwordError }, { status: 400 });
    }
  }
  if (!slamType || !VALID_SLAMS.includes(slamType)) {
    return NextResponse.json({ ok: false, error: "Pick a Grand Slam (Australian Open, French Open, Wimbledon, or US Open)." }, { status: 400 });
  }
  if (!gender || !VALID_GENDERS.includes(gender)) {
    return NextResponse.json({ ok: false, error: "Pick a draw: men's or women's singles." }, { status: 400 });
  }
  const parsedYear = Number(year);
  if (!Number.isInteger(parsedYear) || parsedYear < 2000 || parsedYear > 2100) {
    return NextResponse.json({ ok: false, error: "Pick a valid tournament year." }, { status: 400 });
  }

  const hasPasswordInput = typeof password === "string" && password !== "";
  try {
    const result = email
      ? await createPoolByEmail({
          name,
          email,
          displayName: displayName || "Commissioner",
          inviteCode,
          slamType,
          year: parsedYear,
          gender,
          passwordHash: hasPasswordInput ? hashPassword(password) : undefined
        })
      : await createPool({ name, commissionerUserId, inviteCode, slamType, year: parsedYear, gender });
    // If the new commissioner just set a password, sign them in (capability
    // cookie) so they can manage the bracket without a second sign-in.
    const createdProfile = (result as { profile?: { id: string; hasPassword?: boolean } }).profile;
    if (hasPasswordInput && createdProfile?.hasPassword) {
      setCommissionerCookie(createdProfile.id);
    }
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Could not create bracket." },
      { status: 500 }
    );
  }
}
