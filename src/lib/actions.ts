"use server";

import { revalidatePath } from "next/cache";
import { redirect, unstable_rethrow } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  getBookingById,
  getBookingHours,
  getSettings,
  getSpecialDates,
  requireRestaurant,
} from "@/lib/data";
import { errorMessage, type ActionResult } from "@/lib/errors";
import { addDays, minutesFromHHMM, weekdayOf, zonedToInstant } from "@/lib/dates";
import type { AvailabilitySlot, BookingHour, SpecialDate } from "@/lib/types";
import {
  cancelBooking,
  createBooking,
  fetchAvailability,
  updateBooking,
} from "@/lib/n8n";

/** Every page that shows reservations reads from these paths. */
function revalidateReservations() {
  for (const path of ["/", "/reservations", "/calendar"]) revalidatePath(path);
}

const MAX_PARTY_SIZE = 100;
const MAX_NAME_LENGTH = 120;
const MAX_PHONE_LENGTH = 50;
const MAX_EMAIL_LENGTH = 254;
const MAX_NOTES_LENGTH = 2000;
const MAX_BOOKING_ID_LENGTH = 128;

function isValidDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function isValidTime(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{2}:\d{2}$/.test(value)) return false;
  const [hour, minute] = value.split(":").map(Number);
  return hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59;
}

function isValidPartySize(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= 1 &&
    value <= MAX_PARTY_SIZE
  );
}

function isValidOptionalEmail(value: string): boolean {
  if (!value) return true;
  if (value.length > MAX_EMAIL_LENGTH) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isValidBookingId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= MAX_BOOKING_ID_LENGTH
  );
}

/**
 * Availability occasionally includes slots that have already started on the
 * restaurant's current local date. Keep those slots out of the UI and repeat
 * the check on submit so a slot cannot expire while the dialog is open.
 */
function isPastSlot(date: string, time: string, timezone?: string, now = new Date()) {
  return zonedToInstant(date, time, timezone).getTime() <= now.getTime();
}

/**
 * n8n returns availability as wall-clock times for a service date. For an
 * overnight Tuesday service, `00:00` is therefore Wednesday at midnight.
 * Resolve that missing calendar-date information from the saved schedule.
 */
function resolveSlot(
  serviceDate: string,
  time: string,
  bookingHours: BookingHour[],
  specialDates: SpecialDate[]
): AvailabilitySlot {
  const minute = minutesFromHHMM(time);
  const special = specialDates.find((item) => item.date === serviceDate);

  let periods: Array<{
    startTime: string;
    endTime: string;
    spansNextDay: boolean;
  }>;

  if (special) {
    periods =
      !special.closed && special.startTime && special.endTime
        ? [special as { startTime: string; endTime: string; spansNextDay: boolean }]
        : [];
  } else {
    const weekday = weekdayOf(serviceDate);
    periods = bookingHours.filter(
      (period) => period.active && period.dayOfWeek === weekday
    );
  }

  // Prefer an ordinary same-day period if schedules overlap. Otherwise, an
  // early time inside the tail of an overnight period belongs to the next day.
  const coveredSameDay = periods.some((period) => {
    const start = minutesFromHHMM(period.startTime);
    const end = minutesFromHHMM(period.endTime);
    return period.spansNextDay
      ? minute >= start
      : minute >= start && minute <= end;
  });
  const nextDay =
    !coveredSameDay &&
    periods.some(
      (period) =>
        period.spansNextDay && minute <= minutesFromHHMM(period.endTime)
    );

  return {
    time,
    date: nextDay ? addDays(serviceDate, 1) : serviceDate,
    nextDay,
  };
}

export async function login(
  _prev: { error: string; email: string } | null,
  formData: FormData
): Promise<{ error: string; email: string }> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password)
    return { error: "Introduce tu correo electrónico y tu contraseña.", email };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error)
    return { error: "El correo electrónico o la contraseña son incorrectos.", email };

  redirect("/");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

// The restaurant slug is always resolved server-side from the session, never
// accepted from the client.
export async function getAvailability(
  date: string,
  partySize: number
): Promise<ActionResult<AvailabilitySlot[]>> {
  try {
    const restaurant = await requireRestaurant();
    if (!isValidDate(date) || !isValidPartySize(partySize)) {
      return { ok: false, error: "Elige una fecha y un número de comensales válidos." };
    }
    const [settings, bookingHours, specialDates] = await Promise.all([
      getSettings(restaurant.id),
      getBookingHours(restaurant.id),
      getSpecialDates(restaurant.id),
    ]);
    const times = await fetchAvailability(
      restaurant.slug,
      date,
      partySize,
      settings?.strictTableCapacity ?? false
    );
    const slots = times
      .map((time) => resolveSlot(date, time, bookingHours, specialDates))
      // Keep an overnight service chronological: Tuesday 23:30 must appear
      // before Wednesday 00:00, even though "00:00" sorts first as text.
      .sort((a, b) =>
        `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`)
      );
    const now = new Date();
    return {
      ok: true,
      data: slots.filter(
        (slot) => !isPastSlot(slot.date, slot.time, restaurant.timezone, now)
      ),
    };
  } catch (error) {
    // redirect() and notFound() travel as thrown values; let them through.
    unstable_rethrow(error);
    return { ok: false, error: errorMessage(error) };
  }
}

export async function createReservation(input: {
  date: string;
  time: string;
  partySize: number;
  name: string;
  phone: string;
  email: string;
  notes: string;
}): Promise<ActionResult> {
  try {
    const restaurant = await requireRestaurant();
    const settings = await getSettings(restaurant.id);
    if (!input || typeof input !== "object") {
      return { ok: false, error: "Los datos de la reserva no son válidos." };
    }
    const name = typeof input.name === "string" ? input.name.trim() : "";
    const phone = typeof input.phone === "string" ? input.phone.trim() : "";
    const email = typeof input.email === "string" ? input.email.trim() : "";
    const notes = typeof input.notes === "string" ? input.notes.trim() : "";

    if (!name || !phone) {
      return { ok: false, error: "El nombre y el teléfono son obligatorios." };
    }
    if (name.length > MAX_NAME_LENGTH || phone.length > MAX_PHONE_LENGTH) {
      return { ok: false, error: "El nombre o el teléfono son demasiado largos." };
    }
    if (!isValidOptionalEmail(email)) {
      return { ok: false, error: "Introduce un correo electrónico válido." };
    }
    if (notes.length > MAX_NOTES_LENGTH) {
      return { ok: false, error: "Las notas no pueden superar los 2000 caracteres." };
    }
    if (
      !isValidDate(input.date) ||
      !isValidTime(input.time) ||
      !isValidPartySize(input.partySize)
    ) {
      return { ok: false, error: "Elige una fecha y una hora válidas." };
    }
    if (isPastSlot(input.date, input.time, restaurant.timezone)) {
      return { ok: false, error: "Esa hora ya ha pasado. Elige una franja posterior." };
    }
    await createBooking({
      restaurantSlug: restaurant.slug,
      date: input.date,
      time: input.time,
      partySize: input.partySize,
      name,
      phone,
      email,
      notes,
      strictTableCapacity: settings?.strictTableCapacity ?? false,
    });
    revalidateReservations();
    return { ok: true, data: undefined };
  } catch (error) {
    // redirect() and notFound() travel as thrown values; let them through.
    unstable_rethrow(error);
    return { ok: false, error: errorMessage(error) };
  }
}

/**
 * Confirms the caller can reach the booking under RLS and returns the phone
 * the n8n backend expects. The phone is never taken from the client.
 */
async function findAccessibleBooking(bookingId: string) {
  const restaurant = await requireRestaurant();
  if (!isValidBookingId(bookingId)) {
    return { restaurant, booking: null };
  }
  const booking = await getBookingById(restaurant, bookingId);
  return { restaurant, booking };
}

export async function updateReservation(input: {
  bookingId: string;
  date: string;
  time: string;
  partySize: number;
}): Promise<ActionResult> {
  try {
    if (!input || typeof input !== "object") {
      await requireRestaurant();
      return { ok: false, error: "Los datos de la reserva no son válidos." };
    }
    const { restaurant, booking } = await findAccessibleBooking(input.bookingId);
    if (!booking) return { ok: false, error: "No se encontró esta reserva." };
    if (
      !isValidDate(input.date) ||
      !isValidTime(input.time) ||
      !isValidPartySize(input.partySize)
    ) {
      return { ok: false, error: "Elige una fecha y una hora válidas." };
    }
    if (isPastSlot(input.date, input.time, restaurant.timezone)) {
      return { ok: false, error: "Esa hora ya ha pasado. Elige una franja posterior." };
    }
    await updateBooking({
      restaurantSlug: restaurant.slug,
      bookingId: booking.id,
      phone: booking.phone,
      date: input.date,
      time: input.time,
      partySize: input.partySize,
      strictTableCapacity:
        (await getSettings(restaurant.id))?.strictTableCapacity ?? false,
    });
    revalidateReservations();
    return { ok: true, data: undefined };
  } catch (error) {
    // redirect() and notFound() travel as thrown values; let them through.
    unstable_rethrow(error);
    return { ok: false, error: errorMessage(error) };
  }
}

export async function cancelReservation(bookingId: string): Promise<ActionResult> {
  try {
    const { restaurant, booking } = await findAccessibleBooking(bookingId);
    if (!booking) return { ok: false, error: "No se encontró esta reserva." };
    await cancelBooking({
      restaurantSlug: restaurant.slug,
      bookingId: booking.id,
      phone: booking.phone,
    });
    revalidateReservations();
    return { ok: true, data: undefined };
  } catch (error) {
    // redirect() and notFound() travel as thrown values; let them through.
    unstable_rethrow(error);
    return { ok: false, error: errorMessage(error) };
  }
}
