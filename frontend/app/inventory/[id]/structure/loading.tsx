import { FormSkeleton, TableSkeleton } from "@/app/inventory/_components/inventory-skeletons";

export default function ProductStructureLoading() {
  return (
    <div className="space-y-6 p-4 md:p-6">
      <FormSkeleton />
      <TableSkeleton rows={6} columns={8} />
    </div>
  );
}
