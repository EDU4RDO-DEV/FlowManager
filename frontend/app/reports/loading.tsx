import { ReportCategoriesSkeleton, ReportListSkeleton } from "@/app/reports/_components/reports-skeletons";

export default function ReportsLoading() {
  return (
    <div className="space-y-6 p-4 md:p-6">
      <ReportCategoriesSkeleton />
      <ReportListSkeleton />
    </div>
  );
}
