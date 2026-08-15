# Paso 12 - Hardening de rutas restore (RBAC + validacion de params)

Fecha: 2026-08-15

## Alcance ejecutado

1. Ampliacion de pruebas de integracion RBAC
- Archivo: backend/src/tests/module-endpoints-rbac.spec.ts

2. Cobertura agregada en rutas restore
- Clientes:
  - 403 con rol sin permiso de update (`logistica`).
  - 400 con `id` invalido.
- Proveedores:
  - 403 con rol sin permiso de update (`cajero`).
  - 400 con `id` invalido.
- Empleados:
  - 403 con rol sin permiso de update (`produccion`).
  - 400 con `id` invalido.

3. Objetivo de riesgo cubierto
- Evitar regresiones de autorizacion por accion (`update`) en endpoints de restauracion.
- Confirmar contrato de entrada en params para rutas críticas de restore.

## Estado
Subpaso completado. Endpoints restore de entidades principales quedan con cobertura de seguridad y validacion de entrada en pruebas de integracion.
