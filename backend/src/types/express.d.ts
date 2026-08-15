declare global {
  namespace Express {
    interface Request {
      auth?: {
        userId: number;
        sessionId: number | null;
        idRol: number | null;
        nombreRol?: string | null;
        correo?: string;
        nombre?: string;
      };
    }
  }
}

export {};
