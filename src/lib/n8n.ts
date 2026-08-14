import "server-only";
import { BackendError } from "@/lib/errors";

const BASE_URL = "https://gonrodter.app.n8n.cloud/webhook";

async function post(path: string, payload: Record<string, unknown>) {
  let response: Response;
  try {
    const webhookSecret = process.env.N8N_WEBHOOK_SECRET?.trim();
    response = await fetch(`${BASE_URL}/${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(webhookSecret
          ? { Authorization: `Bearer ${webhookSecret}` }
          : {}),
      },
      body: JSON.stringify(payload),
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw new BackendError(
      "No se pudo contactar con el servicio de reservas. Comprueba tu conexión e inténtalo de nuevo."
    );
  }

  let data: unknown = null;
  try {
    const text = await response.text();
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }

  if (!response.ok) {
    throw new BackendError(
      "El servicio de reservas no pudo completar la solicitud. Inténtalo de nuevo."
    );
  }

  if (
    data &&
    typeof data === "object" &&
    "success" in data &&
    (data as { success: unknown }).success === false
  ) {
    const message = (data as { message?: unknown }).message;
    throw new BackendError(
      typeof message === "string" && message.length < 200
        ? message
        : "El servicio de reservas rechazó la solicitud."
    );
  }

  return data;
}

// Availability responses can come in a few shapes ({slots: [...]},
// {availableSlots: [...]}, a bare array, "HH:mm" strings or {time} objects).
// Walk the payload and collect anything that looks like a time slot.
function collectSlots(value: unknown, found: Set<string>, depth = 0) {
  if (depth > 4 || value === null || value === undefined) return;
  if (typeof value === "string") {
    const match = value.match(/^(\d{1,2}):(\d{2})/);
    if (match) found.add(`${match[1].padStart(2, "0")}:${match[2]}`);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectSlots(item, found, depth + 1);
    return;
  }
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    for (const key of ["time", "slot", "start", "startTime", "hour"]) {
      if (typeof obj[key] === "string") collectSlots(obj[key], found, depth + 1);
    }
    for (const key of ["slots", "availableSlots", "availability", "times", "data", "available"]) {
      if (obj[key] !== undefined) collectSlots(obj[key], found, depth + 1);
    }
  }
}

export async function fetchAvailability(
  restaurantSlug: string,
  date: string,
  partySize: number,
  strictTableCapacity: boolean
): Promise<string[]> {
  const data = await post("restaurant-availability", {
    restaurantSlug,
    date,
    partySize,
    strictTableCapacity,
  });
  const found = new Set<string>();
  collectSlots(data, found);
  return [...found].sort();
}

export async function createBooking(payload: {
  restaurantSlug: string;
  date: string;
  time: string;
  partySize: number;
  name: string;
  phone: string;
  email: string;
  notes: string;
  strictTableCapacity: boolean;
}) {
  return post("restaurant-create-booking", payload);
}

export async function updateBooking(payload: {
  restaurantSlug: string;
  bookingId: string;
  phone: string;
  date: string;
  time: string;
  partySize: number;
  strictTableCapacity: boolean;
}) {
  return post("restaurant-update-booking", payload);
}

export async function cancelBooking(payload: {
  restaurantSlug: string;
  bookingId: string;
  phone: string;
}) {
  return post("restaurant-cancel-booking", payload);
}
