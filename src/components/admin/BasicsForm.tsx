"use client";

import { useState } from "react";
import type { ActionResult } from "@/lib/errors";
import { isValidDomain, normalizeDomain } from "@/lib/slug";
import { Button, Card, ErrorNote, Field, Input } from "@/components/ui";
import { CheckIcon } from "@/components/icons";

/**
 * Step 1, also used to edit an existing restaurant's basics.
 *
 * The domain doubles as restaurants.slug, which is the identifier the booking
 * backend resolves. Because that makes the exact string load-bearing, the
 * normalized value is shown live as the superadmin types rather than being
 * silently rewritten on save.
 */
export function BasicsForm({
  initialName = "",
  initialDomain = "",
  initialOwnerEmail = "",
  submitLabel,
  save,
  onSaved,
}: {
  initialName?: string;
  initialDomain?: string;
  initialOwnerEmail?: string;
  submitLabel: string;
  save: (input: {
    name: string;
    domain: string;
    ownerEmail: string;
  }) => Promise<ActionResult<unknown>>;
  onSaved?: () => void;
}) {
  const [name, setName] = useState(initialName);
  const [domain, setDomain] = useState(initialDomain);
  const [ownerEmail, setOwnerEmail] = useState(initialOwnerEmail);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const slug = normalizeDomain(domain);
  const slugValid = slug.length > 0 && isValidDomain(slug);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setSaved(false);

    const result = await save({ name, domain, ownerEmail });

    setPending(false);
    if (result.ok) {
      setSaved(true);
      onSaved?.();
    } else {
      setError(result.error);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <Card className="space-y-4 p-4">
        <Field label="Nombre del restaurante" required>
          <Input
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="La Terraza del Puerto"
          />
        </Field>

        <Field
          label="Dominio de producción"
          required
          hint="Pega la dirección web del restaurante. Puedes usar una URL completa o el prefijo www."
        >
          <Input
            required
            value={domain}
            onChange={(event) => setDomain(event.target.value)}
            placeholder="https://www.restaurante.com"
          />
        </Field>

        <Field
          label="Correo del propietario"
          required
          hint={
            initialOwnerEmail
              ? "Al cambiarlo se envía una nueva invitación y se retira inmediatamente el acceso al propietario anterior."
              : "Enviaremos al propietario un enlace seguro para crear su contraseña."
          }
        >
          <Input
            required
            type="email"
            autoComplete="email"
            value={ownerEmail}
            onChange={(event) => setOwnerEmail(event.target.value)}
            placeholder="propietario@restaurante.com"
          />
        </Field>

        <div className="rounded-lg bg-sunken px-3 py-2.5">
          <p className="text-[10px] font-medium uppercase tracking-wide text-muted">
            Identificador de reservas
          </p>
          {slug.length === 0 ? (
            <p className="mt-0.5 text-[13px] text-muted">
              Introduce un dominio para ver el identificador.
            </p>
          ) : (
            <>
              <p
                className={`mt-0.5 text-[13px] font-semibold ${
                  slugValid ? "text-ink" : "text-danger"
                }`}
              >
                {slug}
              </p>
              <p className="mt-1 text-[11px] leading-4 text-muted">
                {slugValid
                  ? "Este es el identificador que usará el sistema de reservas para reconocer el restaurante."
                  : "Todavía no parece un dominio. Usa algo como restaurante.com."}
              </p>
            </>
          )}
        </div>
      </Card>

      {error && <div className="mt-3">{<ErrorNote>{error}</ErrorNote>}</div>}

      <div className="mt-4 flex items-center gap-3">
        <Button
          type="submit"
          variant="primary"
          pending={pending}
          disabled={
            !slugValid || name.trim().length === 0 || ownerEmail.trim().length === 0
          }
        >
          {submitLabel}
        </Button>
        {saved && !pending && (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-ok">
            <CheckIcon size={13} /> Guardado
          </span>
        )}
      </div>
    </form>
  );
}
