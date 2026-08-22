import {
  PayrollCardsSkeleton,
  PayrollTableSkeleton,
} from "@/app/payroll/_components/payroll-skeletons";

export default function PayrollLoading() {
  return (
    <div className="space-y-6 p-4 md:p-6">
      <PayrollCardsSkeleton />
      <PayrollTableSkeleton rows={8} />
    </div>
  );
}
