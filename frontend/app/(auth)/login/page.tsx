"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { ArrowRight, Eye, Loader2, LockKeyhole, User } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getApiErrorMessage } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [correo, setCorreo] = useState("");
  const [clave, setClave] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!correo.trim() || !clave) {
      toast.error("Ingresa tu correo y contrasena.");
      return;
    }

    setIsSubmitting(true);
    try {
      const user = await login({ correo: correo.trim(), clave });
      toast.success(`Bienvenido, ${user.nombre}.`);
      router.replace("/");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo iniciar sesion."));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="relative w-full max-w-6xl overflow-hidden rounded-[28px] bg-white shadow-[0_30px_80px_rgba(0,0,0,0.28)]">
      <div className="grid min-h-[620px] grid-cols-1 lg:grid-cols-[1.05fr_1fr]">
        <aside className="relative overflow-hidden bg-gradient-to-br from-[oklch(0.56_0.14_244)] via-[oklch(0.45_0.12_244)] to-[oklch(0.39_0.1_244)] px-8 py-10 text-white lg:px-12 lg:py-12">
          <div
            aria-hidden
            className="pointer-events-none absolute -bottom-20 -left-20 size-72 rounded-full bg-[radial-gradient(circle_at_30%_30%,oklch(0.72_0.13_220),oklch(0.42_0.1_240))]"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute bottom-8 right-10 size-44 rounded-full bg-[radial-gradient(circle_at_35%_30%,oklch(0.71_0.14_220),oklch(0.45_0.11_242))]"
          />

          <div className="relative z-10 flex h-full flex-col justify-between gap-12">
            <div className="space-y-6">
              <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs uppercase tracking-[0.16em] ring-1 ring-white/35">
                FlowManager
              </span>

              <div className="space-y-4">
                <h1 className="text-4xl font-semibold tracking-[0.06em] lg:text-5xl">WELCOME</h1>
                <p className="text-sm font-medium uppercase tracking-[0.16em] text-white/85">
                  INDUSTRIAS BASAN
                </p>
                <p className="max-w-sm text-sm text-white/80 lg:text-base">
                  Controla operaciones, inventario y sesiones de manera segura
                  desde una sola plataforma de trabajo.
                </p>
              </div>
            </div>

            <p className="text-xs text-white/75">© {new Date().getFullYear()} FlowManager</p>
          </div>

          <div
            aria-hidden
            className="pointer-events-none absolute -right-16 top-1/2 hidden h-[130%] w-44 -translate-y-1/2 rounded-l-[140px] bg-white lg:block"
          />
        </aside>

        <main className="relative flex items-center justify-center bg-white px-6 py-10 lg:px-12">
          <div
            aria-hidden
            className="pointer-events-none absolute -bottom-20 -right-20 hidden size-44 rounded-full bg-[radial-gradient(circle_at_35%_35%,oklch(0.72_0.14_220),oklch(0.48_0.1_242))] lg:block"
          />

          <div className="relative z-10 w-full max-w-md space-y-6">
            <header className="space-y-2 text-slate-800">
              <h2 className="text-4xl font-semibold tracking-tight">Sign in</h2>
              <p className="text-sm text-slate-500">Accede a tu panel operativo con tu usuario activo.</p>
            </header>

            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              <div className="space-y-1.5">
                <Label htmlFor="correo" className="text-xs font-medium text-slate-600">User Name</Label>
                <div className="relative">
                  <User className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    id="correo"
                    type="email"
                    autoComplete="email"
                    placeholder="operador@basan.com"
                    value={correo}
                    onChange={(e) => setCorreo(e.target.value)}
                    disabled={isSubmitting}
                    className="h-11 rounded-lg border-slate-200 bg-slate-50 pl-9 text-slate-800"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="clave" className="text-xs font-medium text-slate-600">Password</Label>
                <div className="relative">
                  <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    id="clave"
                    type="password"
                    autoComplete="current-password"
                    placeholder="••••••••"
                    value={clave}
                    onChange={(e) => setClave(e.target.value)}
                    disabled={isSubmitting}
                    className="h-11 rounded-lg border-slate-200 bg-slate-50 pl-9 pr-14 text-slate-800"
                    required
                  />
                  <span className="absolute right-3 top-1/2 inline-flex -translate-y-1/2 items-center gap-1 text-xs font-medium uppercase tracking-[0.06em] text-slate-500">
                    <Eye className="size-3.5" /> Show
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 text-xs text-slate-600">
                <label className="inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="size-4 rounded border-slate-300"
                  />
                  Remember me
                </label>
                <button type="button" className="font-medium text-slate-500 hover:text-slate-700">
                  Forgot Password?
                </button>
              </div>

              <Button
                type="submit"
                className="h-11 w-full rounded-lg bg-[oklch(0.39_0.1_244)] text-white hover:bg-[oklch(0.34_0.09_244)]"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Ingresando...
                  </>
                ) : (
                  <>
                    Sign in
                    <ArrowRight className="size-4" />
                  </>
                )}
              </Button>

              <div className="flex items-center gap-3 py-1 text-xs text-slate-400">
                <span className="h-px flex-1 bg-slate-200" />
                <span>Or</span>
                <span className="h-px flex-1 bg-slate-200" />
              </div>

              <Button
                type="button"
                variant="outline"
                className="h-11 w-full rounded-lg border-slate-300 text-slate-700 hover:bg-slate-50"
              >
                Sign in with other
              </Button>
            </form>

            <p className="text-center text-sm text-slate-500">
              Don't have an account?{" "}
              <Link href="/register" className="font-semibold text-[oklch(0.39_0.1_244)] hover:underline">
                Sign Up
              </Link>
            </p>
          </div>
        </main>
      </div>
    </section>
  );
}
