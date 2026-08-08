import {
  SessionsCardsSkeleton,
  SessionsTableSkeleton,
} from "@/app/sessions/_components/sessions-skeletons";

export default function SessionsLoading() {
  return (
    <div className="space-y-6 p-4 md:p-6">
      <SessionsCardsSkeleton />
      <SessionsTableSkeleton rows={8} />
    </div>
  );
}
