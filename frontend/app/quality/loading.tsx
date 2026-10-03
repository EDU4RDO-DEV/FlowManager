import {
  QualityCardsSkeleton,
  QualityTableSkeleton,
} from "@/app/quality/_components/quality-skeletons";

export default function QualityLoading() {
  return (
    <div className="space-y-6 p-4 md:p-6">
      <QualityCardsSkeleton />
      <QualityTableSkeleton rows={8} />
    </div>
  );
}
