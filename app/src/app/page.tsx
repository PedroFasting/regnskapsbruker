import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

/**
 * Rotsiden redirecter til riktig dashboard basert på brukerrolle.
 */
export default async function Home() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  if (session.user.role === "rf" || session.user.role === "admin") {
    redirect("/rf/dashboard");
  }

  redirect("/kunde/dashboard");
}
