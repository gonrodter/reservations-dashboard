import type { Metadata } from "next";
import { requireSuperadmin } from "@/lib/admin-data";
import { AdminShell } from "@/components/admin/AdminShell";

export const metadata: Metadata = {
  title: "Terron Studio admin",
};

/**
 * The gate for the whole admin area. requireSuperadmin() reads the signed-in
 * user's user_profiles.global_role and redirects anyone else to their own
 * dashboard, so a restaurant user can never render an admin page — and because
 * every admin action repeats the check, they cannot reach the writes either.
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireSuperadmin();

  return <AdminShell>{children}</AdminShell>;
}
