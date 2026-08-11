"use server";

import { revalidatePath } from "next/cache";
import { redirect, unstable_rethrow } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  getBookingById,
  getBookingHours,
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
  _prev: { error: string } | null,
  formData: FormData
): Promise<{ error: string }> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) return { error: "Enter your email and password." };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) return { error: "Incorrect email or password." };

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
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || partySize < 1) {
      return { ok: false, error: "Choose a valid date and party size." };
    }
    const [times, bookingHours, specialDates] = await Promise.all([
      fetchAvailability(restaurant.slug, date, partySize),
      getBookingHours(restaurant.id),
      getSpecialDates(restaurant.id),
    ]);
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
    if (!input.name.trim() || !input.phone.trim()) {
      return { ok: false, error: "Name and phone are required." };
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date) || !/^\d{2}:\d{2}$/.test(input.time)) {
      return { ok: false, error: "Choose a valid date and time." };
    }
    if (isPastSlot(input.date, input.time, restaurant.timezone)) {
      return { ok: false, error: "That time has already passed. Choose a later slot." };
    }
    await createBooking({
      restaurantSlug: restaurant.slug,
      date: input.date,
      time: input.time,
      partySize: input.partySize,
      name: input.name.trim(),
      phone: input.phone.trim(),
      email: input.email.trim(),
      notes: input.notes.trim(),
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
    const { restaurant, booking } = await findAccessibleBooking(input.bookingId);
    if (!booking) return { ok: false, error: "This reservation could not be found." };
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date) || !/^\d{2}:\d{2}$/.test(input.time)) {
      return { ok: false, error: "Choose a valid date and time." };
    }
    if (isPastSlot(input.date, input.time, restaurant.timezone)) {
      return { ok: false, error: "That time has already passed. Choose a later slot." };
    }
    await updateBooking({
      restaurantSlug: restaurant.slug,
      bookingId: booking.id,
      phone: booking.phone,
      date: input.date,
      time: input.time,
      partySize: input.partySize,
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
    if (!booking) return { ok: false, error: "This reservation could not be found." };
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
