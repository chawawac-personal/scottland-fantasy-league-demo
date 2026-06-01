import { Skeleton } from "@/components/ui/Skeleton";

export default function SettingsLoading() {
  return (
    <div className="min-h-screen">
      <div className="h-16 flex items-center justify-between px-6 border-b border-slate-200 bg-white">
        <div className="space-y-1.5">
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-3 w-36" />
        </div>
      </div>

      <div className="p-6 max-w-2xl space-y-5">
        {/* Notifications card */}
        <div className="glass-card p-6 space-y-4">
          <Skeleton className="h-5 w-44" />
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="w-11 h-6 rounded-full" />
            </div>
          ))}
        </div>

        {/* Security card */}
        <div className="glass-card p-6 space-y-3">
          <Skeleton className="h-5 w-36" />
          <Skeleton className="h-10 w-full rounded-xl" />
          <Skeleton className="h-10 w-full rounded-xl" />
        </div>

        <Skeleton className="h-10 w-32 rounded-xl" />
      </div>
    </div>
  );
}


