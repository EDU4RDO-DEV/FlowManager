import {
  EmployeesCardsSkeleton,
  EmployeesTableSkeleton,
} from "@/app/employees/_components/employees-skeletons";

export default function EmployeesLoading() {
  return (
    <div className="space-y-6 p-4 md:p-6">
      <EmployeesCardsSkeleton />
      <EmployeesTableSkeleton rows={8} />
    </div>
  );
}
