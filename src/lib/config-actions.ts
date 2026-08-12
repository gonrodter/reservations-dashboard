"use server";

import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { requireRestaurant } from "@/lib/data";
import { errorMessage, type ActionResult } from "@/lib/errors";
import { GRID_SIZE } from "@/lib/floor-grid";
import {
  deleteRow,
  setRowActive,
  writeCombination,
  writePeriod,
  writeSettings,
  writeSpecialDate,
  writeStrictTableCapacity,
  writeTable,
  writeTableLayout,
  type CombinationInput,
  type PeriodInput,
  type SettingsInput,
  type SpecialDateInput,
  type TableInput,
  type TablePosition,
} from "@/lib/restaurant-config";

// Configuration writes made by restaurant staff. The restaurant is always
// resolved from the session's restaurant_users membership — never from the
// client — and the shared writers in restaurant-config.ts scope every statement
// by that id on top of RLS.

export type {
  CombinationInput,
  PeriodInput,
  SettingsInput,
  SpecialDateInput,
  TableInput,
  TablePosition,
};

async function run(
  paths: string[],
  write: (restaurantId: string) => Promise<ActionResult>
): Promise<ActionResult> {
  try {
    const restaurant = await requireRestaurant();
    const result = await write(restaurant.id);
    if (result.ok) for (const path of paths) revalidatePath(path);
    return result;
  } catch (error) {
    // An expired session redirects to /login; that must not be swallowed here.
    unstable_rethrow(error);
    return { ok: false, error: errorMessage(error) };
  }
}

// ---------------------------------------------------------------- tables

export async function saveTable(input: TableInput): Promise<ActionResult> {
  return run(["/tables", "/"], (id) => writeTable(id, input));
}

/**
 * Tables are deactivated rather than deleted so historical booking_tables rows
 * keep pointing at a real table.
 */
export async function setTableActive(
  tableId: string,
  active: boolean
): Promise<ActionResult> {
  return run(["/tables", "/"], (id) =>
    setRowActive("restaurant_tables", id, tableId, active)
  );
}

/** Where each table sits on the floor map, after the owner rearranges it. */
export async function saveTableLayout(
  positions: TablePosition[]
): Promise<ActionResult> {
  return run(["/tables", "/"], (id) =>
    writeTableLayout(id, positions, GRID_SIZE)
  );
}

// ---------------------------------------------------- table combinations

export async function saveCombination(
  input: CombinationInput
): Promise<ActionResult> {
  return run(["/tables"], (id) => writeCombination(id, input));
}

export async function setCombinationActive(
  combinationId: string,
  active: boolean
): Promise<ActionResult> {
  return run(["/tables"], (id) =>
    setRowActive("table_combinations", id, combinationId, active)
  );
}

// -------------------------------------------------------- booking hours

export async function savePeriod(input: PeriodInput): Promise<ActionResult> {
  return run(["/schedule", "/calendar"], (id) => writePeriod(id, input));
}

export async function setPeriodActive(
  periodId: string,
  active: boolean
): Promise<ActionResult> {
  return run(["/schedule", "/calendar"], (id) =>
    setRowActive("booking_hours", id, periodId, active)
  );
}

export async function deletePeriod(periodId: string): Promise<ActionResult> {
  return run(["/schedule", "/calendar"], (id) =>
    deleteRow("booking_hours", id, periodId)
  );
}

// --------------------------------------------------------- special dates

export async function saveSpecialDate(
  input: SpecialDateInput
): Promise<ActionResult> {
  return run(["/special-dates"], (id) => writeSpecialDate(id, input));
}

export async function deleteSpecialDate(id: string): Promise<ActionResult> {
  return run(["/special-dates"], (restaurantId) =>
    deleteRow("special_dates", restaurantId, id)
  );
}

// -------------------------------------------------------------- settings

export async function saveSettings(input: SettingsInput): Promise<ActionResult> {
  return run(
    ["/", "/settings", "/reservations", "/calendar", "/schedule"],
    (id) => writeSettings(id, input)
  );
}

export async function saveStrictTableCapacity(
  enabled: boolean
): Promise<ActionResult> {
  return run(["/tables", "/settings"], (id) =>
    writeStrictTableCapacity(id, enabled)
  );
}
