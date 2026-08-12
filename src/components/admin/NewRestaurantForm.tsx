"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { createRestaurant } from "@/lib/admin-actions";
import { TopBar } from "@/components/TopBar";
import { PageHeading } from "@/components/ui";
import { BasicsForm } from "@/components/admin/BasicsForm";
import { ChevronLeftIcon } from "@/components/icons";

export function NewRestaurantForm() {
  const router = useRouter();

  return (
    <>
      <TopBar title="Administración de Terron Studio" />

      <div className="thin-scroll min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-xl px-3 py-4 md:px-6">
          <Link
            href="/admin/restaurants"
            className="inline-flex items-center gap-1 text-xs font-medium text-muted hover:text-ink"
          >
            <ChevronLeftIcon size={13} /> Todos los restaurantes
          </Link>

          <div className="mt-3">
            <PageHeading
              title="Incorporar un restaurante"
              description="Empieza con su identidad y propietario. Enviaremos al propietario una invitación para crear su contraseña, mientras el restaurante permanece desactivado hasta completar la configuración."
            />
          </div>

          <div className="mt-4">
            <BasicsForm
              submitLabel="Crear y continuar"
              save={async (input) => {
                const result = await createRestaurant(input);
                if (result.ok) {
                  router.replace(`/admin/restaurants/${result.data.id}?step=settings`);
                }
                return result;
              }}
            />
          </div>
        </div>
      </div>
    </>
  );
}
