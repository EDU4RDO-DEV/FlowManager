import {
  LogisticsCardsSkeleton,
  LogisticsTableSkeleton,
} from "@/app/logistics/_components/logistics-skeletons";

export default function ExpensesLoading() {
  return (
    <div className="space-y-6 p-4 md:p-6">
      <LogisticsCardsSkeleton />
      <LogisticsTableSkeleton rows={8} />
    </div>
  );
}
