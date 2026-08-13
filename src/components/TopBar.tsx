"use client";

import type { ReactNode } from "react";
import { PlusIcon, SearchIcon } from "@/components/icons";

/**
 * The row that sits above every page's content: restaurant identity on the
 * left, optional search in the middle, primary action on the right. Without a
 * search the row would leave the action hanging alone, so it drops to a
 * floating pill at the bottom of the page instead.
 */
export function TopBar({
  title,
  search,
  onNew,
  newLabel = "Nueva reserva",
  extra,
  leading,
}: {
  title: string;
  search?: {
    value: string;
    onChange: (value: string) => void;
    placeholder: string;
  };
  onNew?: () => void;
  newLabel?: string;
  extra?: ReactNode;
  /** Sits at the start of the row, on the same line as the title. */
  leading?: ReactNode;
}) {
  const floating = Boolean(onNew) && !search;

  return (
    <>
    <div className="flex shrink-0 items-center gap-3 border-b border-line px-3 py-2.5 md:px-4">
      {leading}
      <h1 className="hidden truncate text-sm font-semibold md:block md:w-48">
        {title}
      </h1>

      {search ? (
        <label className="relative flex-1 md:mx-auto md:max-w-md">
          <span className="sr-only">{search.placeholder}</span>
          <SearchIcon
            size={14}
            className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted"
          />
          <input
            type="search"
            value={search.value}
            onChange={(event) => search.onChange(event.target.value)}
            placeholder={search.placeholder}
            className="w-full rounded-lg border border-line bg-sunken py-1.5 pl-8 pr-3 text-[13px] outline-none transition-colors placeholder:text-muted focus:border-line-strong focus:bg-surface"
          />
        </label>
      ) : (
        <div className="flex-1" />
      )}

      <div className="flex shrink-0 items-center gap-2 md:w-48 md:justify-end">
        {extra}
        {onNew && !floating && (
          <button
            type="button"
            onClick={() => onNew()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-ok px-3 py-1.5 text-[13px] font-medium text-white transition-all hover:opacity-85 active:scale-[0.97]"
          >
            <PlusIcon size={14} />
            <span className="hidden sm:inline">{newLabel}</span>
            <span className="sm:hidden">Nueva</span>
          </button>
        )}
      </div>
    </div>

    {onNew && floating && (
      <button
        type="button"
        onClick={() => onNew()}
        className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] left-1/2 z-30 inline-flex -translate-x-1/2 items-center gap-1.5 rounded-lg bg-ok px-4 py-2.5 text-[13px] font-medium text-white shadow-float transition-all hover:opacity-90 active:scale-[0.97]"
      >
        <PlusIcon size={15} />
        {newLabel}
      </button>
    )}
    </>
  );
}
