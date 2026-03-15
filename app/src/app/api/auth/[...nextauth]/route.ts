/**
 * NextAuth.js API Route Handler
 *
 * Håndterer alle /api/auth/* requests (sign-in, sign-out, callback, etc.)
 */

import { handlers } from "@/lib/auth";

export const { GET, POST } = handlers;
