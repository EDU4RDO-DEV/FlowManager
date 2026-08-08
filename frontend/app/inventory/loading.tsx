import { CardSkeleton, TableSkeleton } from "@/app/inventory/_components/inventory-skeletons";

export default function InventoryLoading() {
  return (
    <div className="space-y-6 p-4 md:p-6">
      <CardSkeleton count={4} />
      <TableSkeleton rows={8} columns={9} />
    </div>
  );
}
