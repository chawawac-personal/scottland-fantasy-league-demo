import { Skeleton, SkeletonNavTabs, SkeletonChatMessage } from "@/components/ui/Skeleton";

export default function CommunityLoading() {
  return (
    <div className="min-h-screen">
      <div className="h-16 flex items-center justify-between px-6 border-b border-slate-200 bg-white">
        <div className="space-y-1.5">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-3 w-36" />
        </div>
      </div>

      <div className="p-6 space-y-5">
        <SkeletonNavTabs count={3} />

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
          {/* Chat area */}
          <div className="col-span-1 xl:col-span-3 glass-card overflow-hidden flex flex-col" style={{ height: "600px" }}>
            <div className="p-4 border-b border-slate-200 flex items-center gap-2">
              <Skeleton className="w-2 h-2 rounded-full" />
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-16 ml-auto" />
            </div>
            <div className="flex-1 p-4 space-y-4 overflow-hidden">
              <SkeletonChatMessage />
              <SkeletonChatMessage reverse />
              <SkeletonChatMessage />
              <SkeletonChatMessage />
              <SkeletonChatMessage reverse />
              <SkeletonChatMessage />
            </div>
            {/* Input */}
            <div className="p-4 border-t border-slate-200">
              <div className="flex items-center gap-3">
                <div className="flex gap-1.5">
                  {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="w-7 h-7 rounded-lg" />)}
                </div>
                <Skeleton className="flex-1 h-10 rounded-xl" />
                <Skeleton className="h-10 w-10 rounded-xl shrink-0" />
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            <div className="glass-card p-4 space-y-3">
              <Skeleton className="h-5 w-36" />
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-2 py-2">
                  <Skeleton className="w-6 h-6 rounded-lg" />
                  <Skeleton className="h-4 flex-1" />
                  <Skeleton className="h-3 w-12" />
                </div>
              ))}
            </div>
            <div className="glass-card p-4 space-y-2">
              <Skeleton className="h-5 w-32" />
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-5 w-28" />)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


