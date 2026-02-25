import { redirect } from "next/navigation";

/** Root page redirects to dashboard (or login if not authenticated via middleware). */
export default function HomePage() {
  redirect("/dashboard");
}
