import {
  ClientsCardsSkeleton,
  ClientsTableSkeleton,
} from "@/app/clients/_components/clients-skeletons";

export default function ClientsLoading() {
  return (
    <div className="space-y-6 p-4 md:p-6">
      <ClientsCardsSkeleton />
      <ClientsTableSkeleton rows={8} />
    </div>
  );
}
