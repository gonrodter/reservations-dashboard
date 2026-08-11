import { redirect } from "next/navigation";

/** The MVP's Upcoming view is now the Reservations page's default range. */
export default function UpcomingPage() {
  redirect("/reservations?range=upcoming");
}
