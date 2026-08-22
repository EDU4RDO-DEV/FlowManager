import {
  CommissionsCardsSkeleton,
  CommissionsTableSkeleton,
} from "@/app/commissions/_components/commissions-skeletons";

export default function CommissionsLoading() {
  return (
    <div className="space-y-6 p-4 md:p-6">
      <CommissionsCardsSkeleton />
      <CommissionsTableSkeleton rows={8} />
    </div>
  );
}
