"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * Keeps reservation pages fresh when a booking is created or changed
 * elsewhere — typically from the public booking site.
 *
 * Supabase Realtime is the fast path. It needs the bookings table added to a
 * publication, which is a project setting we cannot guarantee, so a refresh on
 * window focus plus a slow interval always runs as a fallback. Both funnel
 * into router.refresh(), so the existing server components stay the single
 * source of truth and no data fetching is duplicated on the client.
 */
export function useLiveBookings(restaurantId: string) {
  const router = useRouter();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;

    // Collapses bursts of changes (a booking plus its booking_tables rows)
    // into a single refresh.
    const refresh = () => {
      if (cancelled) return;
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => router.refresh(), 400);
    };

    const supabase = createClient();
    const channel = supabase
      .channel(`bookings:${restaurantId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "bookings",
          filter: `restaurant_id=eq.${restaurantId}`,
        },
        refresh
      )
      .subscribe();

    const onFocus = () => refresh();
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);
    const interval = setInterval(refresh, 60_000);

    return () => {
      cancelled = true;
      if (timerRef.current) clearTimeout(timerRef.current);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [restaurantId, router]);
}
