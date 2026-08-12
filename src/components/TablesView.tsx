"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Restaurant, RestaurantTable, TableCombination } from "@/lib/types";
import {
  saveCombination,
  saveTable,
  setCombinationActive,
  setTableActive,
  saveStrictTableCapacity,
} from "@/lib/config-actions";
import { TopBar } from "@/components/TopBar";
import { TableDialog } from "@/components/TableDialog";
import { CombinationDialog } from "@/components/CombinationDialog";
import { PageHeading, Segmented } from "@/components/ui";
import { TablesEditor } from "@/components/editors/TablesEditor";
import { CombinationsEditor } from "@/components/editors/CombinationsEditor";
import { TableCapacityPolicy } from "@/components/editors/TableCapacityPolicy";

type Tab = "tables" | "combinations";

export function TablesView({
  restaurant,
  tables,
  combinations,
  strictTableCapacity,
}: {
  restaurant: Restaurant;
  tables: RestaurantTable[];
  combinations: TableCombination[];
  strictTableCapacity: boolean;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("tables");
  const [addingTable, setAddingTable] = useState(false);
  const [addingCombination, setAddingCombination] = useState(false);

  const zones = useMemo(
    () => [...new Set(tables.map((table) => table.zone).filter(Boolean))] as string[],
    [tables]
  );

  const inService = tables.filter((table) => table.active);
  const seats = inService.reduce((sum, table) => sum + (table.capacity ?? 0), 0);
  const refresh = () => router.refresh();

  return (
    <>
      <TopBar
        title={restaurant.name}
        onNew={() =>
          tab === "tables" ? setAddingTable(true) : setAddingCombination(true)
        }
        newLabel={tab === "tables" ? "Nueva mesa" : "Nueva combinación"}
      />

      <div className="thin-scroll min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-3 py-4 md:px-6">
          <PageHeading
            title="Mesas"
            description={`${inService.length} en servicio · ${seats} plazas · ${combinations.filter((c) => c.active).length} combinaciones`}
            action={
              <Segmented
                label="Sección"
                value={tab}
                options={[
                  { value: "tables", label: "Mesas" },
                  { value: "combinations", label: "Combinaciones" },
                ]}
                onChange={setTab}
              />
            }
          />

          <div className="mt-5">
            {tab === "tables" ? (
              <>
                <TableCapacityPolicy
                  enabled={strictTableCapacity}
                  save={saveStrictTableCapacity}
                  onSaved={refresh}
                />
                <TablesEditor
                  tables={tables}
                  actions={{ save: saveTable, setActive: setTableActive }}
                  onChanged={refresh}
                />
              </>
            ) : (
              <CombinationsEditor
                combinations={combinations}
                tables={tables}
                actions={{ save: saveCombination, setActive: setCombinationActive }}
                onChanged={refresh}
              />
            )}
          </div>
        </div>
      </div>

      {addingTable && (
        <TableDialog
          zones={zones}
          onClose={() => setAddingTable(false)}
          onSaved={() => {
            setAddingTable(false);
            refresh();
          }}
        />
      )}
      {addingCombination && (
        <CombinationDialog
          tables={tables}
          onClose={() => setAddingCombination(false)}
          onSaved={() => {
            setAddingCombination(false);
            refresh();
          }}
        />
      )}
    </>
  );
}
