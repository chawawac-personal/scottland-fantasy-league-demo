import { Skeleton } from "@/components/ui/Skeleton";

export default function ManagerLoading() {
  return (
    <div className="min-h-screen">
      <div className="h-16 flex items-center justify-between px-6 border-b border-slate-200 bg-white">
        <Skeleton className="h-5 w-36" />
        <Skeleton className="h-8 w-32 rounded-xl" />
      </div>
      <div className="p-6 space-y-5">
        <div className="flex gap-2">
          <Skeleton className="h-10 w-44 rounded-xl" />
          <Skeleton className="h-10 w-32 rounded-xl" />
        </div>
        <div className="glass-card p-5 space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 py-2">
              <Skeleton className="h-8 w-20" />
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="h-6 w-20 rounded-lg" />
              <Skeleton className="h-7 w-24 rounded-lg" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
