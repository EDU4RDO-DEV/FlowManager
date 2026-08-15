"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { DashboardShell } from "@/components/dashboard-shell";
import { RequireAuth } from "@/components/require-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getApiErrorMessage } from "@/lib/api";
import { listProducts } from "@/services/products.service";
import type { ProductDto } from "@/types/products";

export default function InventoryStructureIndexPage() {
  const [items, setItems] = useState<ProductDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [query, setQuery] = useState("");

  useEffect(() => {
    void loadData();
  }, []);

  async function loadData() {
    try {
      setIsLoading(true);
      const response = await listProducts({
        page: 1,
        limit: 100,
        anulado: false,
        categoria: "PRODUCTO_TERMINADO",
      });
      setItems(response.items);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo cargar productos para estructura."));
    } finally {
      setIsLoading(false);
    }
  }

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return items;

    return items.filter((item) =>
      item.nombre.toLowerCase().includes(normalized),
    );
  }, [items, query]);

  return (
    <RequireAuth>
      <DashboardShell
        title="Estructura / Recetas (BOM)"
        description="Selecciona un producto terminado para gestionar su estructura"
      >
        <div className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4">
              <div>
                <CardTitle>Productos Terminados</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Accede a la estructura BOM de cada producto.
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={() => void loadData()} disabled={isLoading}>
                <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
                Recargar
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="search">Buscar producto</Label>
                <Input
                  id="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Escribe el nombre del producto"
                />
              </div>

              <div className="overflow-x-auto rounded-xl border border-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>Producto</TableHead>
                      <TableHead>Categoría</TableHead>
                      <TableHead>Existencia</TableHead>
                      <TableHead className="text-right">Acción</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-mono text-xs">#{item.id}</TableCell>
                        <TableCell className="font-medium">{item.nombre}</TableCell>
                        <TableCell>{item.categoria}</TableCell>
                        <TableCell>{item.existencia}</TableCell>
                        <TableCell className="text-right">
                          <Button asChild size="sm" variant="outline">
                            <Link href={`/inventory/${item.id}/structure`}>
                              Gestionar BOM
                              <ArrowRight className="ml-2 h-4 w-4" />
                            </Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}

                    {!isLoading && filtered.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                          No hay productos terminados disponibles.
                        </TableCell>
                      </TableRow>
                    ) : null}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      </DashboardShell>
    </RequireAuth>
  );
}
