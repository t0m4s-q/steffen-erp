# IMPLEMENTATION_PLAN.md — ERP STEFFEN

## 1. Objetivo

Este documento define el orden recomendado de implementación del MVP del ERP Steffen.

No redefine reglas de negocio.

El agente debe utilizar como fuentes de verdad:

1. `PROJECT.md`
2. `BUSINESS_RULES.md`
3. `DATA_MODEL.md`
4. `FLOWS.md`
5. `DESIGN.md`
6. `COMPONENTS.md`
7. `PDFS.md`
8. `AUDIT.md`

Si durante la implementación aparece una contradicción o un caso no definido, no debe inventarse una regla nueva. Debe detenerse esa parte, documentar el conflicto y pedir definición.

---

# 2. Principio de implementación

El proyecto debe construirse por capas.

Orden:

1. Base de datos
2. Dominio / backend
3. Tests
4. UI funcional
5. PDFs
6. Dashboard y Reportes
7. Responsive final y pulido
8. Auditoría funcional

No comenzar por las pantallas visuales si la lógica subyacente todavía no está implementada y testeada.

---

# 3. FASE 0 — Preparación del proyecto

## Objetivo

Dejar preparada la estructura técnica antes de implementar reglas de negocio.

## Tareas

- Inicializar proyecto.
- Configurar variables de entorno.
- Configurar conexión a PostgreSQL/Supabase.
- Definir estrategia de migraciones.
- Configurar lint/format.
- Configurar tests.
- Crear estructura inicial:
  - database
  - domain
  - services
  - repositories
  - api
  - ui
  - pdf
  - tests

## Resultado esperado

Proyecto ejecutable y conectado a una base vacía.

## No hacer todavía

- lógica de fabricación;
- lógica de stock;
- lógica patrimonial;
- pantallas finales.

---

# 4. FASE 1 — Modelo de datos y migraciones

## Objetivo

Implementar `DATA_MODEL.md` antes de desarrollar lógica de aplicación.

## Orden recomendado

### 4.1 Infraestructura base

Crear:

- `code_sequences`
- `business_operations`
- `exchange_rates`

### 4.2 Maestros

Crear:

- `customers`
- `suppliers`
- `stock_items`
- `raw_materials`
- `components`
- `base_products`
- `products`
- `product_components`

### 4.3 Fórmulas y proveedores

Crear:

- `formula_versions`
- `formula_version_items`
- `supplier_items`

### 4.4 Stock

Crear:

- `stock_balances`
- `stock_movements`
- `stock_adjustments`
- `stock_adjustment_items`

### 4.5 Fábrica

Crear:

- `bulk_lots`
- `bulk_lot_material_snapshots`
- `packaging_operations`
- `packaging_component_snapshots`
- `factory_movements`

### 4.6 Compras

Crear:

- `purchases`
- `purchase_items`

### 4.7 Precios

Crear:

- `price_lists`
- `product_price_versions`
- `discount_profiles`
- `discount_profile_steps`

### 4.8 Pedidos y ventas

Crear:

- `orders`
- `order_discount_steps`
- `order_items`
- `planning_product_priorities`
- `remittances`
- `remittance_discount_steps`
- `remittance_items`
- `margin_remittances`
- `margin_remittance_items`

### 4.9 Patrimonio

Crear:

- `financial_accounts`
- `patrimonial_movements`
- `financial_entries`
- `payments`
- `operating_expenses`
- `withdrawals`
- `marketplace_settlements`

### 4.10 Documentos

Crear:

- `generated_documents`

---

# 5. FASE 2 — Seeds y datos iniciales

## Crear automáticamente

### Cuentas

- Caja Steffen
- Caja Mercado Libre

### Listas de precios

- Lista Salón
- Lista Público
- Lista Ecommerce

Con sus respectivos roles internos.

### Perfiles Costo-Ganancia

- 35%
- 30% + 10% + 5%
- 40% + 10%
- 50%

### Cotización

No inventar una cotización inicial.

El sistema debe requerir una cotización válida antes de calcular costos USD cuando corresponda.

---

# 6. FASE 3 — Servicios base del dominio

## Objetivo

Toda lógica debe centralizarse en servicios de dominio.

La UI no debe contener reglas de negocio.

## Servicios iniciales

### Códigos

`generateVisibleCode(prefix)`

Debe utilizar `code_sequences`.

No usar `MAX + 1`.

### Costos

`getCurrentStockItemCost(stockItemId)`

`getCurrentFormulaCost(baseProductId)`

`getCurrentProductCost(productId)`

### Stock

`getStockBalance(stockItemId)`

`applyStockMovement(...)`

### Patrimonio

`postPatrimonialMovement(...)`

`getFinancialAccountBalance(...)`

### Precios

`getPriceAtSnapshot(productId, priceListId, snapshotAt)`

---

# 7. FASE 4 — Maestros

Implementar primero CRUD controlado de:

- Proveedores;
- Clientes;
- MPR;
- COM;
- PBA/Fórmulas;
- PRO;
- Listas de precios.

## Reglas importantes

- no borrar históricos;
- utilizar `active`;
- moneda de Proveedor obligatoria e inmutable;
- stock mínimo > 0;
- peso en kg con 3 decimales;
- COM/PRO en unidades enteras;
- costo extra variable PRO = 2%;
- nueva Fórmula crea PBA;
- editar Fórmula crea nueva versión;
- listas de sistema no se desactivan.

---

# 8. FASE 5 — Stock

Implementar:

- saldos actuales;
- movimientos;
- ajustes;
- stock inicial;
- prioridad visual por:
  `stock_actual / stock_minimo`.

## Tests obligatorios

- ajuste positivo;
- ajuste negativo;
- stock inicial genera MST;
- COM/PRO no acepta decimales;
- MPR acepta hasta 3 decimales;
- stock mínimo 0 es rechazado;
- prohibición de saldo negativo (stock balance >= 0 en DB y RPC);
- ajuste negativo mayor al disponible es rechazado con rollback total.

---

# 9. FASE 6 — Fabricación

Implementar servicio:

`manufactureBulkLot(...)`

## Debe hacer atómicamente

- obtener fórmula vigente;
- calcular proporciones;
- validar stock MPR;
- generar GRA;
- congelar costos;
- descontar MPR;
- generar MST;
- generar MFA;
- actualizar balances.

## Tests obligatorios

- fórmula proporcional;
- stock insuficiente hace rollback;
- histórico no cambia al modificar dólar;
- histórico no cambia al modificar fórmula;
- GRA nace OPEN;
- kg_available = kg_fabricated.

---

# 10. FASE 7 — Envasado

Implementar servicio:

`packageProduct(...)`

## Debe hacer atómicamente

- validar GRA;
- validar PRO;
- validar granel;
- validar componentes;
- generar ENV;
- descontar granel;
- descontar COM;
- aumentar PRO;
- generar MST;
- generar MFA;
- gestionar último lote;
- registrar merma/sobrante.

## Tests obligatorios

- no permite exceder GRA si no es último lote;
- no permite faltante de componentes;
- consume correctamente COM;
- aumenta PRO;
- merma cierra lote;
- sobrante cierra lote;
- GRA CLOSED queda en 0.

---

# 11. FASE 8 — Compras

Implementar:

`registerPurchase(...)`

`editPurchase(...)`

## Casos

### Pagada

- stock ↑
- MST
- Caja Steffen ↓
- MOV COMPRA

### A deuda

- stock ↑
- MST
- Deuda Proveedor ↑
- MOV COMPRA

## Reglas

- un Proveedor = una moneda;
- cotización CMP USD editable solo para esa compra;
- total patrimonial incluye IVA;
- una CMP puede tener varias líneas;
- una CMP puede asociar un ítem existente al Proveedor;
- una CMP puede crear MPR/COM nueva;
- `price_updated_at` determina costo teórico vigente.

## Tests obligatorios

- compra ARS;
- compra USD;
- override de cotización;
- compra pagada;
- compra a deuda;
- edición recalcula stock/patrimonio;
- actualización de precio cambia costo actual;
- Fecha de compra no determina costo vigente.

---

# 12. FASE 9 — Cuentas y movimientos patrimoniales

Implementar:

- Pago Cliente;
- Pago Proveedor;
- Gasto Operativo;
- Retiro;
- Liquidación Mercado Libre.

## Tests

### Pago Cliente

- deuda cliente ↓
- Caja Steffen ↑
- permite sobrepago

### Pago Proveedor

- deuda proveedor ↓
- Caja Steffen ↓
- permite sobrepago

### Mercado Libre

Venta:

- Caja ML ↑

Liquidación:

- Caja ML ↓ bruto
- Caja Steffen ↑ neto
- Comisión = bruto - neto
- comisión registrada como Gasto Operativo
- no permite liquidar más que saldo Caja ML

---

# 13. FASE 10 — Pedidos

Implementar:

`createOrder(...)`

`editOpenOrder(...)`

`cancelOpenOrder(...)`

## Reglas

- PED OPEN no genera stock/patrimonio;
- congela Lista;
- congela descuentos;
- precio no editable;
- Registered Customer → Salón;
- Mercado Libre → Ecommerce;
- Consumidor Final → Público;
- descuento manual excepcional para ML/CF.

## Tests

- descuentos sucesivos;
- precio snapshot;
- cambio posterior de Lista no altera PED;
- cambio posterior de cliente no altera descuentos;
- cancelar PED no genera movimientos.

---

# 14. FASE 11 — Planificación

Implementar un motor puro:

`calculateOrderPlanning(...)`

## Entradas

- PED OPEN;
- prioridades;
- stock PRO;
- GRA abiertos;
- stock COM;
- BOM;
- pesos.

## Salida

- cobertura;
- faltantes;
- reservas virtuales;
- detalle por PED y PRO.

## Importante

No persistir reservas.

No generar:

- MST;
- MFA;
- ENV;
- MOV.

## Tests

- prioridad de filas;
- prioridad de columnas;
- recurso compartido;
- varios GRA del mismo PBA;
- faltante de COM;
- faltante de granel;
- stock PRO cubre primero.

---

# 15. FASE 12 — RTO

Implementar:

`confirmRto(...)`

## Debe hacer

- validar PED OPEN;
- validar AG;
- exigir al menos una AG > 0;
- recalcular venta por AG;
- descontar PRO;
- generar MST;
- crear MOV;
- afectar cuenta correspondiente;
- convertir PED;
- crear RTO `RTM_PENDING`;
- congelar snapshots.

## Tests

- AG menor;
- AG igual;
- AG mayor;
- no quedan unidades pendientes;
- Cliente registrado genera deuda;
- ML genera Caja ML;
- Consumidor Final genera Caja Steffen;
- RTO queda inmutable;
- no se confirma otro RTO con RTM pendiente.

---

# 16. FASE 13 — RTM

Implementar:

`completeRtm(...)`

## Debe hacer

- tomar costo teórico actual del PRO;
- congelar costo;
- calcular Costo Productos;
- registrar Transporte;
- generar MOV Transporte;
- calcular Ganancia;
- marcar RTO COMPLETED.

## Tests

- snapshot de costo;
- costo futuro no modifica RTM;
- transporte 0 no genera MOV;
- transporte > 0 descuenta Caja;
- Ganancia correcta.

---

# 17. FASE 14 — PDFs

Implementar `PDFS.md`.

## MVP

`ERP → JSON → HTML/CSS → PDF → Storage`

## Tipos

- RTO
- RTM
- Estado Cuenta Cliente
- Estado Cuenta Proveedor

## Estados

- PENDING
- READY
- FAILED

## Reglas

- el PDF se genera una vez;
- Ver abre archivo guardado;
- no regenerar al visualizar;
- fallo de renderer no revierte negocio;
- reintento no duplica movimientos.

---

# 18. FASE 15 — UI funcional

Construir siguiendo:

- `DESIGN.md`
- `COMPONENTS.md`

Orden sugerido:

1. Proveedores
2. MPR/COM
3. Fórmulas
4. Productos
5. Stock
6. Fabricación
7. Envasado
8. Compras
9. Clientes
10. Cuentas
11. Pedidos
12. Planificación
13. RTO/RTM
14. Administración
15. Dashboard
16. Reportes

---

# 19. FASE 16 — Dashboard

Implementar usando fuentes reales.

No persistir copias de métricas.

Debe mostrar:

- indicadores;
- Resumen de Pedidos;
- Accesos rápidos;
- Alertas Stock;
- Cuentas;
- Granel disponible.

---

# 20. FASE 17 — Reportes

Exactamente cuatro cards:

- Ventas del mes
- Total facturado
- Ganancia
- Pedidos abiertos

## Regla temporal

Las primeras tres:

mes calendario corriente.

Pedidos abiertos:

todos los PED OPEN, sin filtro mensual.

---

# 21. FASE 18 — Responsive

Aplicar las reglas ya definidas.

No recortar funciones mobile.

Validar al menos:

- 360 px;
- 390 px;
- 430 px;
- 768 px;
- 1024 px;
- 1440 px.

---

# 22. FASE 19 — Auditoría final

Antes de considerar terminado el MVP:

- ejecutar todos los tests;
- comparar UI con Figma y DESIGN;
- comparar reglas con BUSINESS_RULES;
- comparar tablas con DATA_MODEL;
- comparar operaciones con FLOWS;
- revisar PDFs;
- revisar históricos;
- revisar inactivos;
- revisar concurrencia;
- revisar rollback.

---

# 23. Criterio de finalización

El MVP no se considera terminado solo porque las pantallas funcionen.

Debe cumplirse:

- lógica correcta;
- stock consistente;
- patrimonio consistente;
- históricos congelados;
- operaciones atómicas;
- tests pasando;
- PDFs reproducibles;
- UI usable desktop/mobile;
- cero decisiones de negocio inventadas.
