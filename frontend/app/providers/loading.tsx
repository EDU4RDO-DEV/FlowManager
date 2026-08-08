import {
  ProvidersCardsSkeleton,
  ProvidersTableSkeleton,
} from "@/app/providers/_components/providers-skeletons";

export default function ProvidersLoading() {
  return (
    <div className="space-y-6 p-4 md:p-6">
      <ProvidersCardsSkeleton />
      <ProvidersTableSkeleton rows={8} />
    </div>
  );
}
