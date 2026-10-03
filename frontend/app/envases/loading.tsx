import {
  EnvasesCardsSkeleton,
  EnvasesTableSkeleton,
} from "@/app/envases/_components/envases-skeletons";

export default function EnvasesLoading() {
  return (
    <div className="space-y-6 p-4 md:p-6">
      <EnvasesCardsSkeleton />
      <EnvasesTableSkeleton rows={8} />
    </div>
  );
}
