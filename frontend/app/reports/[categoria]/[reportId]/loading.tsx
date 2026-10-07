import { ReportResultsSkeleton } from "@/app/reports/_components/reports-skeletons";

export default function ReportRunnerLoading() {
  return (
    <div className="space-y-6 p-4 md:p-6">
      <ReportResultsSkeleton />
    </div>
  );
}
