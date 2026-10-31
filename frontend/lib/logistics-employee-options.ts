import type { EmployeeDto } from "../types/employees";

export function getLogisticsEmployeeOptions(employeeList: EmployeeDto[]) {
  return employeeList
    .filter((employee) => !employee.anulado)
    .map((employee) => ({
      employeeId: employee.id,
      userId: employee.idUsuarioVinculado,
      nombre: employee.entidad.nombreCompleto,
    }));
}
