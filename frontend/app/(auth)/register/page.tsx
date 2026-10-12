"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Droplet, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getApiErrorMessage } from "@/lib/api";
import { register } from "@/services/auth.service";

export default function RegisterPage() {
  const router = useRouter();
  const [nombre, setNombre] = useState("");
  const [correo, setCorreo] = useState("");
  const [clave, setClave] = useState("");
  const [confirmarClave, setConfirmarClave] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!nombre.trim() || !correo.trim() || !clave) {
      toast.error("Completa nombre, correo y contraseña.");
      return;
    }
    if (clave.length < 8) {
      toast.error("La contraseña debe tener al menos 8 caracteres.");
      return;
    }
    if (clave !== confirmarClave) {
      toast.error("Las contraseñas no coinciden.");
      return;
    }

    setIsSubmitting(true);
    try {
      await register({ nombre: nombre.trim(), correo: correo.trim(), clave });
      toast.success("Usuario creado. Ya puedes iniciar sesión.");
      router.replace("/login");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo crear el usuario."));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Card className="border-border/70 shadow-sm">
      <CardHeader className="space-y-3">
        <span className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary lg:hidden">
          <Droplet className="size-6" />
        </span>
        <div className="space-y-1.5">
          <CardTitle className="text-2xl tracking-tight">Crear usuario</CardTitle>
          <CardDescription>
            Si todavía no existe un administrador, el primer registro recibirá ese rol.
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-5" noValidate>
          <div className="space-y-2">
            <Label htmlFor="nombre">Nombre completo</Label>
            <Input
              id="nombre"
              type="text"
              autoComplete="name"
              placeholder="Ana Pérez"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              disabled={isSubmitting}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="correo">Correo</Label>
            <Input
              id="correo"
              type="email"
              autoComplete="email"
              placeholder="admin@basan.com"
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
              maxLength={128}
              autoComplete="new-password"
              placeholder="Mínimo 8 caracteres"
              value={clave}
              onChange={(e) => setClave(e.target.value)}
              disabled={isSubmitting}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmarClave">Confirmar contraseña</Label>
            <Input
              id="confirmarClave"
              type="password"
              autoComplete="new-password"
              placeholder="Repite la contraseña"
              value={confirmarClave}
              onChange={(e) => setConfirmarClave(e.target.value)}
              disabled={isSubmitting}
              required
            />
          </div>
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Creando…
              </>
            ) : (
              "Crear usuario"
            )}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          ¿Ya tienes cuenta?{" "}
          <Link
            href="/login"
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            Iniciar sesión
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
