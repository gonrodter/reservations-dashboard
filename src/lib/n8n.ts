import "server-only";
import { BackendError } from "@/lib/errors";

const BASE_URL = "https://gonrodter.app.n8n.cloud/webhook";

async function post(path: string, payload: Record<string, unknown>) {
  let response: Response;
  try {
    response = await fetch(`${BASE_URL}/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      cache: "no-store",
    });
  } catch {
    throw new BackendError(
      "Could not reach the reservations service. Check your connection and try again."
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
      "The reservations service could not complete this request. Please try again."
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
        : "The reservations service rejected this request."
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
