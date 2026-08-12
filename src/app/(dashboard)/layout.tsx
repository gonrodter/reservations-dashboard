import Link from "next/link";
import { getSessionContext } from "@/lib/data";
import { isSuperadmin } from "@/lib/admin-data";
import { Shell } from "@/components/Shell";
import { logout } from "@/lib/actions";
import { AlertIcon } from "@/components/icons";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [{ restaurant }, admin] = await Promise.all([
    getSessionContext(),
    isSuperadmin(),
  ]);

  if (!restaurant) {
    // A superadmin normally has no restaurant of their own, so send them
    // somewhere useful instead of leaving them on a dead end.
    return (
      <main className="canvas-decor flex min-h-dvh items-center justify-center p-4">
        <div className="w-full max-w-sm rounded-2xl bg-surface p-6 text-center shadow-frame">
          <div className="mx-auto flex size-10 items-center justify-center rounded-xl bg-warn-soft text-warn">
            <AlertIcon size={18} />
          </div>
          <h1 className="mt-3 text-sm font-semibold">
            {admin ? "No tienes un restaurante propio" : "No hay ningún restaurante asignado"}
          </h1>
          <p className="mt-1 text-xs leading-5 text-muted">
            {admin
              ? "Tu cuenta no está vinculada a un restaurante. Usa el área de administración para incorporar y gestionar restaurantes."
              : "Tu cuenta está activa, pero todavía no está vinculada a un restaurante. Pide acceso al administrador y vuelve a iniciar sesión."}
          </p>
          {admin && (
            <Link
              href="/admin"
              className="mt-4 inline-flex w-full items-center justify-center rounded-lg bg-ink px-3 py-2 text-[13px] font-medium text-surface hover:opacity-85"
            >
              Abrir administración
            </Link>
          )}
          <form action={logout} className="mt-2">
            <button
              type="submit"
              className="w-full rounded-lg border border-line py-2 text-[13px] font-medium hover:bg-sunken"
            >
              Cerrar sesión
            </button>
          </form>
        </div>
      </main>
    );
  }

  return (
    <Shell restaurantName={restaurant.name} canAccessAdmin={admin}>
      {children}
    </Shell>
  );
}
