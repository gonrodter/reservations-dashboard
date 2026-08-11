export default function DashboardLoading() {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-3 border-b border-line px-4 py-2.5">
        <div className="h-4 w-32 animate-pulse rounded-md bg-sunken" />
        <div className="mx-auto h-8 w-full max-w-md animate-pulse rounded-lg bg-sunken" />
        <div className="h-8 w-36 animate-pulse rounded-lg bg-sunken" />
      </div>
      <div className="flex min-h-0 flex-1">
        <div className="w-full space-y-2 p-4 lg:w-[340px] lg:border-r lg:border-line">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-20 animate-pulse rounded-xl border border-line bg-sunken/60"
            />
          ))}
        </div>
        <div className="hidden flex-1 items-center justify-center lg:flex">
          <div className="size-72 animate-pulse rounded-2xl bg-sunken" />
        </div>
      </div>
    </div>
  );
}
