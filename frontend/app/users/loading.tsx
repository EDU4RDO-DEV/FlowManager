import {
  UsersCardsSkeleton,
  UsersTableSkeleton,
} from "@/app/users/_components/users-skeletons";

export default function UsersLoading() {
  return (
    <div className="space-y-6 p-4 md:p-6">
      <UsersCardsSkeleton />
      <UsersTableSkeleton rows={8} />
    </div>
  );
}
