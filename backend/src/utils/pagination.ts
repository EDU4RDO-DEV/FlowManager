// Fase 14: patrón page/limit/skip + totalPages repetido idéntico en ~6 services.
export function resolvePagination(input: { page?: number; limit?: number }) {
  const page = input.page ?? 1;
  const limit = input.limit ?? 20;
  const skip = (page - 1) * limit;

  return { page, limit, skip };
}

export function buildPaginationMeta(page: number, limit: number, total: number) {
  return {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  };
}
