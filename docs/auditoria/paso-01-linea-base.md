# Paso 01 - Linea base tecnica y contractual

Fecha: 2026-08-15

## 1) Estado de compilacion y pruebas

### Backend
- Build: FAIL
- Test: OK (7/7)
- Error de compilacion detectado en ajuste de validadores Zod:
  - Archivo: backend/src/validators/adjustment.validators.ts
  - Linea: 55
  - Error: uso de z.enum con propiedad errorMap no soportada por la firma actual.

### Frontend
- Lint: FAIL
- Build: OK
- Errores de lint principales:
  - react-hooks/set-state-in-effect en multiples paginas de modulos:
    - app/users/page.tsx
    - app/roles/page.tsx
    - app/sessions/page.tsx
    - app/clients/page.tsx
    - app/providers/page.tsx
    - app/purchases/page.tsx
    - components/theme-provider.tsx
  - react-hooks/static-components:
    - components/theme-toggle.tsx
  - no-empty-object-type:
    - types/product-structure.ts

## 2) Mapa de middleware y proteccion

- Enrutamiento principal: backend/src/app.ts
- Publico:
  - POST /api/auth/login
  - POST /api/auth/refresh
  - POST /api/auth/register (con condicion bootstrap)
- Protegido con requireAuth:
  - /api/adjustments
  - /api/clients
  - /api/employees
  - /api/inventory-log
  - /api/planilla
  - /api/products
  - /api/product-structure
  - /api/compras
  - /api/providers
  - /api/roles
  - /api/sessions
  - /api/users

## 3) Estado RBAC actual

### Backend
- Fuente: backend/src/middlewares/auth.middleware.ts
- Modelo: matriz estatica por modulo y accion (read/create/update/delete).
- Observacion: autorizacion acoplada a nombres de rol normalizados.

### Frontend
- Fuente: frontend/lib/rbac.ts
- Modelo: matriz estatica por modulo (sin nivel por accion).
- Riesgo contractual: duplicacion de reglas y posible desincronizacion con backend.

## 4) Brechas criticas confirmadas en este paso

1. No hay modelo persistente de permisos (rol-permiso por modulo/accion) en base de datos.
2. Frontend no tiene autorizacion por accion (solo visibilidad modular en sidebar).
3. Compras no expone restauracion en rutas:
   - Falta GET /api/compras/anulados
   - Falta PATCH /api/compras/:id/restaurar
   - Falta restauracion de gastos asociados
4. Cobertura automatizada insuficiente:
   - Solo existe backend/src/tests/auth-rbac.spec.ts con 7 pruebas.

## 5) Estado de codigos HTTP (linea base)

- Existe uso extendido de 200, 201, 400, 401, 403, 404, 409 y 500 en controladores.
- Se requiere estandarizacion fina por modulo para cerrar diferencias semanticas por caso de negocio.

## 6) Resultado del paso

Paso 01 completado: linea base levantada con evidencia de build/lint/test y mapa inicial de contratos.

## 7) Siguiente paso (Paso 02)

Definir e implementar arquitectura de permisos persistentes (tabla modulo, tabla accion, tabla rol_permiso), conservar soft delete y migrar validacion RBAC del backend a fuente unica en DB.
