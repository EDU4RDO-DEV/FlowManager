import { api } from "@/lib/api";
import type { ApiResponse } from "@/types/auth";
import type {
  CreateEmployeePayload,
  DeleteEmployeePayload,
  EmployeeDto,
  EmployeesListResponse,
  UpdateEmployeePayload,
} from "@/types/employees";

export async function listEmployees(): Promise<EmployeeDto[]> {
  const { data } = await api.get<EmployeesListResponse>("/api/employees");
  return data.data ?? [];
}

export async function getEmployeeById(id: number): Promise<EmployeeDto> {
  const { data } = await api.get<ApiResponse<EmployeeDto>>(`/api/employees/${id}`);
  if (!data.data) {
    throw new Error(data.message || "Respuesta invalida al obtener empleado");
  }
  return data.data;
}

export async function createEmployee(payload: CreateEmployeePayload): Promise<EmployeeDto> {
  const { data } = await api.post<ApiResponse<EmployeeDto>>("/api/employees", payload);
  if (!data.data) {
    throw new Error(data.message || "Respuesta invalida al crear empleado");
  }
  return data.data;
}

export async function updateEmployee(id: number, payload: UpdateEmployeePayload): Promise<EmployeeDto> {
  const { data } = await api.patch<ApiResponse<EmployeeDto>>(`/api/employees/${id}`, payload);
  if (!data.data) {
    throw new Error(data.message || "Respuesta invalida al actualizar empleado");
  }
  return data.data;
}

export async function deleteEmployee(id: number, payload?: DeleteEmployeePayload): Promise<void> {
  await api.delete(`/api/employees/${id}`, { data: payload });
}
