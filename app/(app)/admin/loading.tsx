import { Skeleton, SkeletonNavTabs, SkeletonTableRow } from "@/components/ui/Skeleton";

export default function AdminLoading() {
  return (
    <div className="min-h-screen">
      <div className="h-16 flex items-center justify-between px-6 border-b border-slate-200 bg-white">
        <div className="space-y-1.5">
          <Skeleton className="h-5 w-28" />
          <Skeleton className="h-3 w-52" />
        </div>
        <Skeleton className="h-7 w-28 rounded-xl" />
      </div>

      <div className="p-6 space-y-5">
        <SkeletonNavTabs count={5} />

        {/* Overview stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="glass-card p-5 space-y-3">
              <Skeleton className="w-9 h-9 rounded-lg" />
              <Skeleton className="h-9 w-20" />
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-3 w-20" />
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Health metrics */}
          <div className="glass-card p-5 space-y-4">
            <Skeleton className="h-5 w-36" />
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="space-y-1.5">
                <div className="flex justify-between">
                  <Skeleton className="h-3.5 w-36" />
                  <Skeleton className="h-3.5 w-12" />
                </div>
                <Skeleton className="h-1.5 w-full rounded-full" />
              </div>
            ))}
          </div>

          {/* Alerts */}
          <div className="glass-card p-5 space-y-3">
            <Skeleton className="h-5 w-28" />
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-xl border border-slate-100">
                <Skeleton className="w-3 h-3 rounded shrink-0" />
                <Skeleton className="h-3.5 flex-1" />
                <Skeleton className="h-3 w-12 shrink-0" />
              </div>
            ))}
          </div>
        </div>

        {/* Table preview */}
        <div className="glass-card overflow-x-auto">
          <div className="p-4 border-b border-slate-200 flex justify-between items-center">
            <Skeleton className="h-5 w-36" />
            <Skeleton className="h-8 w-24 rounded-xl" />
          </div>
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                {Array.from({ length: 7 }).map((_, i) => (
                  <th key={i} className="px-4 py-3"><Skeleton className="h-3 w-16" /></th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 5 }).map((_, i) => <SkeletonTableRow key={i} cols={7} />)}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}


