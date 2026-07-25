import { redirect } from "next/navigation";

/** Old Trends URL — keep bookmarks working. */
export default function TrendsRedirectPage() {
  redirect("/data");
}
