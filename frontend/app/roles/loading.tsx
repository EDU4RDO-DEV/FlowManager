import {
  RolesCardsSkeleton,
  RolesTableSkeleton,
} from "@/app/roles/_components/roles-skeletons";

export default function RolesLoading() {
  return (
    <div className="space-y-6 p-4 md:p-6">
      <RolesCardsSkeleton />
      <RolesTableSkeleton rows={8} />
    </div>
  );
}
