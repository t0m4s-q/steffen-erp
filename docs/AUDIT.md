# AUDIT.md — ERP STEFFEN

## Auditoría cruzada

Fecha: 2026-10-01

Documentos auditados:

- PROJECT.md
- BUSINESS_RULES.md
- DATA_MODEL.md
- FLOWS.md
- DESIGN.md
- COMPONENTS.md
- PDFS.md

---

## Resultado general

La arquitectura del MVP quedó coherente entre negocio, datos, flujos, UI responsive y documentos PDF.

La auditoría corrigió inconsistencias técnicas y nomenclaturas sin cambiar las reglas comerciales confirmadas.

---

## Correcciones aplicadas

### Costos y proveedores

- el costo teórico MPR/COM usa la relación Proveedor ↔ Ítem con la última actualización de precio;
- la Fecha de compra no decide el costo vigente;
- moneda única por Proveedor;
- CMP hereda la moneda del Proveedor;
- asociación automática de MPR/COM existente a un nuevo Proveedor;
- IVA 21% incluido en todos los costos teóricos.

### Stock y fábrica

- peso en kg con 3 decimales;
- unidades COM/PRO enteras;
- fórmula no permite duplicar la misma MPR en dos filas;
- Costo Extra Variable fijado en 2% para el MVP;
- MST/MFA toman la fecha funcional de business_operations para evitar duplicación.

### Pedidos y ventas

- RTO requiere al menos una línea AG > 0;
- todas las AG deben quedar definidas antes de confirmar;
- RTO queda inmutable desde su confirmación;
- RTM pendiente persiste;
- no se permite confirmar otro RTO mientras exista un RTM pendiente;
- RTO + RTM históricos permanecen inmutables.

### Patrimonio

- financial_entries no persiste saldos intermedios que quedarían obsoletos al editar históricos;
- saldos se reconstruyen desde el ledger;
- orden histórico definido por Fecha funcional + created_at + id;
- clientes/proveedores inactivos con saldo pueden seguir registrando pagos.

### Listas de precios

- Salón, Público y Ecommerce conservan roles de sistema;
- pueden renombrarse;
- no pueden desactivarse en el MVP;
- listas adicionales sí pueden desactivarse;
- una lista nueva nace vacía.

### Inactivación

- inactivo impide iniciar nuevas operaciones;
- no impide finalizar obligaciones/operaciones existentes;
- históricos nunca se eliminan.

### PDFs

- el PDF final se genera una vez y se almacena;
- Ver PDF abre el archivo almacenado;
- no se renderiza nuevamente en cada visualización;
- payload JSON queda congelado;
- documentos tienen estados PENDING / READY / FAILED;
- un fallo del renderer no revierte operaciones de negocio;
- regeneración/reintento no duplica RTO, RTM ni movimientos;
- arquitectura preparada para sustituir renderer interno por n8n.

### Responsive

- mobile, tablet y desktop definidos;
- misma funcionalidad en todos los dispositivos;
- tablas, matriz de Pedidos, modales y navegación tienen estrategia responsive explícita.

---

## Puntos pendientes reales

No quedan decisiones funcionales conocidas pendientes para el MVP.

Las dos últimas decisiones fueron cerradas:

1. la moneda del Proveedor queda fija al crear su ficha y no cambia;
2. Reportes contiene exactamente cuatro métricas:
   - Ventas del mes corriente;
   - Total facturado del mes corriente;
   - Ganancia del mes corriente;
   - Pedidos abiertos sin filtro mensual.

## Refinamientos visuales no bloqueantes

Pueden definirse más adelante sin afectar la lógica:

- estética exacta del calendario DatePicker;
- estética exacta del dropdown Select;
- Toast;
- animaciones/transiciones.

---

## Estado

La especificación funcional, de datos, flujos, diseño responsive, componentes y PDFs queda lista para iniciar la implementación del MVP.

No quedan decisiones funcionales conocidas que deban ser inventadas por el agente.
