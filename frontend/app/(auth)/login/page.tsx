"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getApiErrorMessage } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [correo, setCorreo] = useState("");
  const [clave, setClave] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!correo.trim() || !clave) {
      toast.error("Ingresa tu correo y contraseña.");
      return;
    }

    setIsSubmitting(true);
    try {
      const user = await login({ correo: correo.trim(), clave });
      toast.success(`Bienvenido, ${user.nombre}.`);
      router.replace("/");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo iniciar sesión."));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Card className="border-border/70 shadow-sm">
      <CardHeader>
        <CardTitle className="text-2xl tracking-tight">Iniciar sesión</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-5" noValidate>
          <div className="space-y-2">
            <Label htmlFor="correo">Correo</Label>
            <Input
              id="correo"
              type="email"
              autoComplete="email"
              placeholder="operador@basan.com"
              value={correo}
              onChange={(e) => setCorreo(e.target.value)}
              disabled={isSubmitting}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="clave">Contraseña</Label>
            <Input
              id="clave"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              value={clave}
              onChange={(e) => setClave(e.target.value)}
              disabled={isSubmitting}
              required
            />
          </div>
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Ingresando…
              </>
            ) : (
              "Ingresar"
            )}
          </Button>
        </form>

      </CardContent>
    </Card>
  );
}
