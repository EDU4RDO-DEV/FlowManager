import type { ReactNode } from "react";
import { Droplet, ShieldCheck, Waves } from "lucide-react";

// Marco visual compartido para las pantallas de autenticación.
// Panel izquierdo: identidad "agua industrial" de Industrias Basán.
// Panel derecho: formulario (login / registro).
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-svh flex-1 lg:grid-cols-[1.1fr_1fr]">
      {/* Panel de marca */}
      <aside className="relative hidden overflow-hidden bg-primary text-primary-foreground lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-30"
          style={{
            background:
              "radial-gradient(60% 60% at 20% 15%, var(--accent) 0%, transparent 55%), radial-gradient(50% 50% at 90% 80%, var(--chart-2) 0%, transparent 60%)",
          }}
        />
        <div className="relative flex items-center gap-3">
          <span className="flex size-11 items-center justify-center rounded-xl bg-primary-foreground/10 ring-1 ring-primary-foreground/20">
            <Droplet className="size-6" />
          </span>
          <div className="leading-tight">
            <p className="text-lg font-semibold tracking-tight">FlowManager</p>
            <p className="text-sm text-primary-foreground/70">Industrias Basán</p>
          </div>
        </div>

        <div className="relative max-w-md space-y-6">
          <h1 className="text-3xl font-semibold leading-tight tracking-tight">
            Gestión clara y confiable para tu planta purificadora.
          </h1>
          <p className="text-primary-foreground/80">
            Control operativo de clientes, proveedores y usuarios en un entorno
            limpio, ordenado y seguro.
          </p>
          <ul className="space-y-3 text-sm text-primary-foreground/85">
            <li className="flex items-center gap-3">
              <Waves className="size-5 shrink-0" />
              Operación fluida para operadores y administradores.
            </li>
            <li className="flex items-center gap-3">
              <ShieldCheck className="size-5 shrink-0" />
              Sesiones protegidas con autenticación JWT.
            </li>
          </ul>
        </div>

        <p className="relative text-xs text-primary-foreground/60">
          © {new Date().getFullYear()} Industrias Basán. Todos los derechos reservados.
        </p>
      </aside>

      {/* Panel de formulario */}
      <main className="flex flex-1 items-center justify-center bg-background px-6 py-12">
        <div className="w-full max-w-sm">{children}</div>
      </main>
    </div>
  );
}
