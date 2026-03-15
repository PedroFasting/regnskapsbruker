/**
 * Middleware – Rollebasert tilgangskontroll
 *
 * Beskytter ruter basert på brukerrolle:
 * - /rf/* -> kun RF-brukere
 * - /kunde/* -> kun kunde-brukere
 * - /login, /register -> kun uinnloggede
 */

import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const user = req.auth?.user;
  const isLoggedIn = !!user;
  const role = (user as { role?: string })?.role;

  // Auth-sider: redirect til dashboard hvis allerede innlogget
  if (pathname.startsWith("/login") || pathname.startsWith("/register")) {
    if (isLoggedIn) {
      const dashboardUrl =
        role === "rf" ? "/rf/dashboard" : "/kunde/dashboard";
      return NextResponse.redirect(new URL(dashboardUrl, req.url));
    }
    return NextResponse.next();
  }

  // RF-ruter: krev RF-rolle
  if (pathname.startsWith("/rf")) {
    if (!isLoggedIn) {
      return NextResponse.redirect(new URL("/login", req.url));
    }
    if (role !== "rf" && role !== "admin") {
      return NextResponse.redirect(new URL("/kunde/dashboard", req.url));
    }
    return NextResponse.next();
  }

  // Kunde-ruter: krev kunde-rolle
  if (pathname.startsWith("/kunde")) {
    if (!isLoggedIn) {
      return NextResponse.redirect(new URL("/login", req.url));
    }
    if (role !== "kunde" && role !== "admin") {
      return NextResponse.redirect(new URL("/rf/dashboard", req.url));
    }
    return NextResponse.next();
  }

  // API-ruter: krev innlogging (unntatt auth-endepunkter)
  if (pathname.startsWith("/api") && !pathname.startsWith("/api/auth")) {
    if (!isLoggedIn) {
      return NextResponse.json({ error: "Ikke autorisert" }, { status: 401 });
    }
    return NextResponse.next();
  }

  return NextResponse.next();
});

export const config = {
  // Matcher alt unntatt statiske filer og Next.js internals
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|public/).*)",
  ],
};
