import type { EmployeeDto } from "../types/employees";

export function getLogisticsEmployeeOptions(employeeList: EmployeeDto[]) {
  const employeesByUser = new Map<number, { userId: number; nombre: string }>();

  for (const employee of employeeList) {
    const userId = employee.idUsuarioVinculado;
    if (userId !== null && userId > 0 && !employeesByUser.has(userId)) {
      employeesByUser.set(userId, {
        userId,
        nombre: employee.entidad.nombreCompleto,
      });
    }
  }

  return Array.from(employeesByUser.values());
}
