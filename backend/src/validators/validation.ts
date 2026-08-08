import { ZodError } from 'zod';

export function getZodErrorMessage(error: ZodError): string {
  const firstIssue = error.issues[0];
  if (!firstIssue) {
    return 'Datos inválidos';
  }

  const path = firstIssue.path.length > 0 ? `${firstIssue.path.join('.')}: ` : '';
  return `${path}${firstIssue.message}`;
}
