
# BASAN — Instrucciones generales para GitHub Copilot

## 1. Contexto del proyecto

Basan es una plataforma web integral para gestionar las
operaciones de fabricación, inventario, compras, ventas,
distribución, logística, finanzas y administración.

Frontend: Next.js + TypeScript.
Backend: Express + TypeScript.
ORM: Prisma.
Base de datos: SQL Server.

Antes de modificar código, inspeccionar la arquitectura,
los componentes existentes y los patrones utilizados.

## 2. Principios de UI/UX

- Diseñar interfaces profesionales, modernas y funcionales.
- Mantener una identidad visual uniforme en toda la plataforma.
- Priorizar claridad, legibilidad y facilidad de uso.
- Evitar interfaces sobrecargadas.
- Mantener una jerarquía visual clara.
- Utilizar espacios, tamaños y alineaciones consistentes.
- Diseñar para escritorio y dispositivos móviles.
- Adaptar las acciones y la información al rol del usuario.

## 3. Componentes

- Reutilizar componentes existentes antes de crear otros.
- Centralizar componentes visuales compartidos.
- Utilizar componentes accesibles y semánticos.
- Mantener consistencia en botones, formularios,
  tablas, diálogos, tarjetas y menús.
- Utilizar Lucide React si ya está integrado.
- No instalar bibliotecas duplicadas.

## 4. Formularios

- Agrupar campos relacionados.
- Utilizar etiquetas claras.
- Incorporar ayudas contextuales cuando sean necesarias.
- Mostrar validaciones junto al campo correspondiente.
- Evitar formularios excesivamente extensos.
- Confirmar operaciones críticas.
- Diferenciar errores, advertencias y operaciones exitosas.

## 5. Tablas y listados

- Incorporar búsqueda, filtros y paginación cuando corresponda.
- Mantener acciones claramente identificadas.
- Diferenciar visualmente los estados.
- Evitar columnas innecesarias.
- Adaptar la presentación a pantallas pequeñas.

## 6. Experiencia de usuario

- Mantener navegación consistente.
- Evitar duplicar funcionalidades.
- Utilizar términos uniformes en toda la plataforma.
- Incorporar iconos informativos en conceptos y campos
  que puedan generar dudas.
- Proporcionar retroalimentación comprensible.
- Evitar mensajes técnicos dirigidos al usuario final.

## 7. Restricciones del modelo de negocio

No confundir categorías de artículos con sus propiedades.

Las categorías existentes son:
- Producto terminado.
- Insumos.
- Materia prima.

Las propiedades independientes incluyen:
- Es vendible.
- Es envase retornable.
- Es fabricable.
- Permite receta.

No duplicar, reemplazar ni reconstruir estos conceptos.

## 8. Restricciones de desarrollo

- No modificar funcionalidades de negocio al realizar
  mejoras exclusivamente visuales.
- No eliminar permisos ni controles de seguridad.
- No alterar contratos de API sin autorización.
- No duplicar componentes o servicios existentes.
- No modificar la base de datos por cambios de diseño.
- No instalar dependencias sin justificar su necesidad.
- Mantener compatibilidad con la arquitectura actual.

## 9. Proceso de trabajo

Antes de modificar una pantalla:

1. Inspeccionar su implementación actual.
2. Identificar componentes reutilizables.
3. Evaluar problemas de usabilidad.
4. Proponer los cambios.
5. Implementar respetando la arquitectura.
6. Comprobar visualmente el resultado.
7. Verificar que las funcionalidades existentes
   continúen funcionando.

No rediseñar módulos completos sin revisar primero
sus dependencias y funcionalidades.
