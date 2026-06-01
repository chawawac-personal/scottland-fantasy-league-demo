import { Skeleton, SkeletonTableRow } from "@/components/ui/Skeleton";

export default function MarketLoading() {
  return (
    <div className="min-h-screen">
      <div className="h-16 flex items-center justify-between px-6 border-b border-slate-200 bg-white">
        <div className="space-y-1.5">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-3 w-44" />
        </div>
      </div>

      <div className="p-6 space-y-4">
        {/* Top stat cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="glass-card p-4 space-y-2">
              <Skeleton className="h-7 w-7 rounded-lg" />
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-3 w-16" />
            </div>
          ))}
        </div>

        {/* Filter bar */}
        <div className="glass-card p-4">
          <div className="flex items-center gap-3">
            <Skeleton className="flex-1 h-10 rounded-xl" />
            <div className="flex gap-1">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-9 w-14 rounded-xl" />)}
            </div>
            <Skeleton className="h-9 w-24 rounded-xl" />
          </div>
        </div>

        {/* Table */}
        <div className="glass-card overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                {["#", "Player", "Pos", "Pts", "Price", "Form", "Goals", "Assists", "Own%", "Action"].map(h => (
                  <th key={h} className="px-4 py-3">
                    <Skeleton className="h-3 w-12" />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 15 }).map((_, i) => <SkeletonTableRow key={i} cols={10} />)}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}


