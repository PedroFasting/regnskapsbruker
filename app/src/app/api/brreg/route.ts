/**
 * API: GET /api/brreg?orgNr=123456789   → Oppslag på orgnr (full selskapsinfo)
 * API: GET /api/brreg?q=selskapsnavn     → Søk på navn/orgnr (liste med treff)
 *
 * Slår opp selskapsinfo fra Brønnøysundregistrene.
 * Brukes av onboarding-siden for å finne og velge selskap.
 */

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { hentSelskap, soekSelskap, BrregError } from "@/lib/brreg";

export async function GET(request: Request) {
  const session = await auth();

  if (!session?.user || session.user.role !== "rf") {
    return NextResponse.json(
      { error: "Kun regnskapsførere kan slå opp selskaper" },
      { status: 403 }
    );
  }

  const { searchParams } = new URL(request.url);
  const orgNr = searchParams.get("orgNr");
  const query = searchParams.get("q");

  try {
    // Søk på navn/orgnr → liste med treff
    if (query) {
      const treff = await soekSelskap(query);
      return NextResponse.json(treff);
    }

    // Oppslag på spesifikt orgnr → full selskapsinfo
    if (orgNr) {
      const selskap = await hentSelskap(orgNr);
      return NextResponse.json(selskap);
    }

    return NextResponse.json(
      { error: "Bruk ?q=søkeord eller ?orgNr=123456789" },
      { status: 400 }
    );
  } catch (err) {
    if (err instanceof BrregError) {
      return NextResponse.json(
        { error: err.message },
        { status: err.statusCode }
      );
    }
    throw err;
  }
}
