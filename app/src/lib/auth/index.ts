/**
 * NextAuth.js (Auth.js v5) – Konfigurasjon
 *
 * To autentiseringsmetoder:
 * - RF (regnskapsfører): E-post + passord (Credentials provider)
 * - Kunde: Magic link via e-post (Email provider via Resend)
 *
 * Lazy-initialisert slik at build ikke krasjer uten DATABASE_URL.
 */

import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Resend from "next-auth/providers/resend";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { getDb } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

function createAuth() {
  const hasDb = !!process.env.DATABASE_URL;
  const db = hasDb ? getDb() : null;

  return NextAuth({
    // DrizzleAdapter krever en ekte databasetilkobling.
    // Under build (uten DATABASE_URL) hopper vi over adapter.
    ...(db ? { adapter: DrizzleAdapter(db) } : {}),
    session: {
      strategy: "jwt",
    },
    pages: {
      signIn: "/login",
      error: "/login",
    },
    providers: [
      // RF-innlogging: e-post + passord
      Credentials({
        id: "credentials",
        name: "E-post og passord",
        credentials: {
          email: { label: "E-post", type: "email" },
          password: { label: "Passord", type: "password" },
        },
        async authorize(credentials) {
          if (!credentials?.email || !credentials?.password) {
            return null;
          }

          const email = credentials.email as string;
          const password = credentials.password as string;

          const currentDb = getDb();
          const [user] = await currentDb
            .select()
            .from(users)
            .where(eq(users.email, email.toLowerCase()))
            .limit(1);

          if (!user || !user.passwordHash) {
            return null;
          }

          const isValidPassword = await bcrypt.compare(
            password,
            user.passwordHash
          );
          if (!isValidPassword) {
            return null;
          }

          return {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
          };
        },
      }),

      // Kunde-innlogging: magic link via Resend
      Resend({
        apiKey: process.env.RESEND_API_KEY,
        from:
          process.env.EMAIL_FROM ??
          "Regnskapsbruker <noreply@regnskapsbruker.no>",
      }),
    ],
    callbacks: {
      async jwt({ token, user }) {
        if (user) {
          token.id = user.id ?? "";
          token.role = (user as { role?: string }).role ?? "kunde";
        }
        return token;
      },
      async session({ session, token }) {
        if (session.user) {
          session.user.id = token.id as string;
          (session.user as { role?: string }).role = token.role as string;
        }
        return session;
      },
      async signIn({ user, account }) {
        // For magic link: opprett bruker som kunde hvis de ikke finnes
        if (account?.provider === "resend" && user.email) {
          const currentDb = getDb();
          const [existing] = await currentDb
            .select()
            .from(users)
            .where(eq(users.email, user.email.toLowerCase()))
            .limit(1);

          if (!existing) {
            await currentDb.insert(users).values({
              email: user.email.toLowerCase(),
              name: user.email.split("@")[0],
              role: "kunde",
            });
          }
        }
        return true;
      },
    },
  });
}

// Lazy-initialiserte exports
let _auth: ReturnType<typeof createAuth> | null = null;

function getAuth() {
  if (!_auth) {
    _auth = createAuth();
  }
  return _auth;
}

type AuthReturn = ReturnType<typeof NextAuth>;

export const handlers = new Proxy({} as AuthReturn["handlers"], {
  get(_target, prop, receiver) {
    return Reflect.get(getAuth().handlers, prop, receiver);
  },
});

// Auth har mange overloads (middleware, API route, server component, etc.)
// Vi eksporterer den som-den-er via en lazy wrapper.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const auth: AuthReturn["auth"] = ((...args: any[]) =>
  (getAuth().auth as (...a: unknown[]) => unknown)(...args)) as AuthReturn["auth"];

export const signIn: AuthReturn["signIn"] = ((...args: unknown[]) =>
  (getAuth().signIn as (...a: unknown[]) => unknown)(...args)) as AuthReturn["signIn"];

export const signOut: AuthReturn["signOut"] = ((...args: unknown[]) =>
  (getAuth().signOut as (...a: unknown[]) => unknown)(...args)) as AuthReturn["signOut"];
