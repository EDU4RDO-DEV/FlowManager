declare global {
  namespace Express {
    interface Request {
      auth?: {
        userId: number;
        idRol: number | null;
        correo?: string;
        nombre?: string;
      };
    }
  }
}

export {};
