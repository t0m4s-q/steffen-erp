# PROJECT.md — ERP STEFFEN

## 1. Propósito del proyecto

Este proyecto define el MVP de un sistema de gestión estilo ERP para Steffen Cosmética Capilar.

El sistema debe centralizar y relacionar:

- fabricación de productos base;
- fórmulas y versiones;
- lotes de granel;
- envasado;
- productos finales;
- materias primas;
- componentes;
- stock;
- pedidos;
- planificación de pedidos;
- remitos;
- remitos margen;
- compras;
- proveedores;
- clientes;
- cuentas corrientes;
- cajas;
- movimientos patrimoniales;
- listas de precios;
- cotización de dólar;
- ventas;
- reportes.

El objetivo principal es evitar lógica duplicada o parches locales. Todas las operaciones deben respetar una única lógica de negocio, una única fuente de datos y trazabilidad histórica.

---

## 2. Principio rector

> Si una regla no está definida explícitamente en la documentación funcional, el sistema no debe inventarla.

No se deben completar huecos por interpretación.

Cuando una regla necesaria no esté definida:

1. detener la implementación de esa parte;
2. marcarla como pendiente;
3. pedir definición funcional;
4. recién después implementarla.

---

## 3. Jerarquía documental

La documentación del proyecto se divide en:

1. `PROJECT.md`
   - alcance;
   - vocabulario;
   - módulos;
   - convenciones;
   - arquitectura conceptual.

2. `BUSINESS_RULES.md`
   - reglas funcionales;
   - cálculos;
   - efectos de cada operación;
   - validaciones;
   - comportamiento histórico.

3. `DATA_MODEL.md`
   - entidades;
   - campos;
   - relaciones;
   - restricciones;
   - snapshots;
   - índices;
   - estados.

4. `FLOWS.md`
   - secuencias transaccionales;
   - operaciones atómicas;
   - efectos cruzados entre módulos.

5. `DESIGN.md`
   - UI;
   - responsive;
   - layout;
   - jerarquía visual;
   - tablas;
   - modales;
   - estados visuales.

6. `COMPONENTS.md`
   - componentes reutilizables;
   - variantes;
   - tamaños;
   - estados;
   - comportamiento.

7. `PDFS.md`
   - documentos PDF;
   - contratos JSON;
   - estructura visual;
   - versionado de templates;
   - integración futura con renderers externos como n8n.

La lógica de negocio tiene prioridad sobre el diseño visual.

---

## 4. Módulos principales

### Dashboard

Resume información en tiempo real y ofrece accesos rápidos.

Incluye:

- indicadores;
- pedidos abiertos;
- resumen de pedidos;
- alertas de stock;
- simulación de compra;
- cuentas;
- granel disponible;
- accesos rápidos.

### Mi Fábrica

Es el núcleo productivo.

Incluye:

- acceso/resumen de fórmulas y Productos Base;
- fabricación;
- lotes de granel;
- envasado;
- productos finales;
- costos teóricos;
- Costo-Ganancia;
- movimientos de fábrica.

### Pedidos

Incluye:

- pedidos abiertos;
- creación de pedidos;
- edición de pedidos abiertos;
- planificación de cobertura;
- prioridad por producto;
- prioridad por pedido;
- remito;
- remito margen.

### Stock

Incluye:

- productos finales;
- materias primas;
- componentes;
- movimientos de stock;
- ajustes.

### Fórmulas

Incluye:

- listado de Productos Base;
- fórmula vigente;
- versiones históricas;
- creación de nueva fórmula / PBA;
- edición mediante nueva versión;
- costos teóricos actuales de fórmula.

### Administración

Incluye:

- cotización del dólar;
- ventas;
- cuentas clientes;
- cuentas proveedores;
- pagos;
- gastos operativos;
- retiros;
- movimientos patrimoniales;
- listas de precios;
- liquidaciones de Mercado Libre;
- cajas.

### Reportes

Incluye cuatro cards de información en tiempo real:

- Ventas del mes;
- Total facturado;
- Ganancia;
- Pedidos abiertos.

Las tres primeras usan el mes calendario corriente. Pedidos abiertos cuenta todos los `PED` en estado `OPEN`, sin importar en qué mes fueron creados.

El contenido visual exacto se define en `DESIGN.md`.

---

## 5. Vocabulario del dominio

### Producto Base

Producto sin presentación comercial.

Ejemplo:

- Shampoo Keratina.

Código:

`PBAxxxx`

Cada Producto Base tiene una fórmula vigente y versiones históricas.

### Producto Final

Presentación comercial envasada a partir de un Producto Base.

Ejemplo:

- Shampoo Keratina 350 cc;
- Shampoo Keratina 1000 cc.

Código:

`PROxxxx`

### Granel

Lote físico de un Producto Base fabricado y disponible para envasar.

Código:

`GRAxxxx`

El código GRA identifica directamente la fabricación/lote.

No existe un código FAB separado.

### Fórmula

Composición de un Producto Base.

No posee código visible independiente.

La fórmula pertenece directamente a un `PBAxxxx`.

### Envasado

Operación que transforma granel y componentes en Producto Final.

Código:

`ENVxxxx`

### Materia Prima

Insumo productivo medido en kilogramos.

Código:

`MPRxxxx`

### Componente

Insumo de envasado medido en unidades.

Ejemplos:

- envase;
- tapa;
- etiqueta;
- estuche.

Código:

`COMxxxx`

### Pedido

Solicitud comercial todavía abierta y editable.

Código:

`PEDxxxx`

### Remito

Documento final de venta basado en cantidades efectivamente enviadas.

Código:

`RTOxxxx`

### Remito Margen

Documento interno asociado al RTO que registra costos, transporte y ganancia.

Código:

`RTMxxxx`

### Compra

Compra de una o varias Materias Primas y/o Componentes a un mismo proveedor.

Código:

`CMPxxxx`

### Cliente

Código:

`CLIxxxx`

### Proveedor

Código:

`PRVxxxx`

### Movimiento de Fábrica

Código:

`MFAxxxx`

### Movimiento de Stock

Código:

`MSTxxxx`

### Movimiento Patrimonial

Código:

`MOVxxxx`

---

## 6. Convención de códigos

Formato visible:

`PPP0001`

Donde:

- `PPP` = prefijo de tres letras;
- la parte numérica es secuencial;
- cuatro dígitos son el mínimo visual, no un límite.

Ejemplos:

- `PRO0001`
- `PRO0045`
- `PRO9999`
- `PRO10000`

Los códigos visibles no deben ser claves primarias de base de datos.

Cada entidad debe tener un identificador interno técnico independiente.

Los códigos visibles deben generarse mediante un mecanismo seguro de secuencia/contador y no mediante un `MAX + 1` calculado desde la aplicación.

---

## 7. Prefijos confirmados

| Prefijo | Entidad |
|---|---|
| `COM` | Componente |
| `MPR` | Materia Prima |
| `PBA` | Producto Base |
| `PRO` | Producto Final |
| `GRA` | Lote de Granel / Fabricación |
| `ENV` | Envasado |
| `CLI` | Cliente |
| `PRV` | Proveedor |
| `PED` | Pedido |
| `CMP` | Compra |
| `RTO` | Remito |
| `RTM` | Remito Margen |
| `MFA` | Movimiento de Fábrica |
| `MST` | Movimiento de Stock |
| `MOV` | Movimiento Patrimonial |

No se utiliza `FML`.

No se utiliza `FAB`.

---

## 8. Unidades

### Peso

Toda magnitud interna de peso se expresa y almacena en kilogramos.

Precisión máxima:

`0,000 kg`

Resolución mínima:

`0,001 kg = 1 g`

Ejemplos:

- 350 g = `0,350 kg`
- 999 g = `0,999 kg`
- 1 kg = `1,000 kg`

En la interfaz, toda leyenda de peso debe aclarar `(kg)`.

### Presentación comercial

La presentación comercial es independiente del peso.

Puede expresarse como:

- cc;
- ml;
- g.

Ejemplo:

- Presentación: `350 cc`
- Peso interno: `0,350 kg`

El sistema nunca deduce el peso a partir de la presentación.

### Materias Primas

Stock en kilogramos.

### Componentes

Stock en unidades.

---

## 9. Monedas

Monedas iniciales:

- ARS;
- USD.

Existe una cotización global USD → ARS administrada desde Administración.

Cada proveedor opera en una única moneda definida en su ficha.

La cotización vigente afecta los valores teóricos actuales, pero nunca reescribe operaciones históricas.

Para MPR/COM con múltiples proveedores, el costo teórico vigente toma como referencia la relación Proveedor ↔ Ítem cuya **última actualización de precio** sea la más reciente. La fecha de compra no determina esa prioridad.

---

## 10. Históricos y snapshots

Regla general:

> Una operación histórica no se recalcula retroactivamente.

Ejemplos:

- una compra conserva la cotización utilizada al registrarse;
- un GRA conserva la fórmula y costos utilizados al fabricarse;
- un ENV conserva sus costos históricos;
- un RTM conserva el costo teórico vigente en el momento en que fue generado;
- una venta conserva su precio y ganancia histórica.

Los valores teóricos actuales sí pueden cambiar por:

- nueva cotización;
- cambio de precio;
- nueva compra;
- nueva versión de fórmula;
- cambio en costo de componentes.

---

## 11. Activos e inactivos

Entidades utilizadas históricamente no se eliminan físicamente.

Aplica a:

- PRO;
- PBA;
- MPR;
- COM;
- CLI;
- PRV;
- listas de precios.

Pueden marcarse como inactivas.

Un elemento inactivo:

- conserva historial;
- continúa visible en operaciones históricas;
- deja de aparecer en selectores para nuevas operaciones.

---

## 12. Operaciones históricas inmutables

Una venta finalizada mediante RTO + RTM es histórica e inmutable.

Un Pedido abierto sí puede editarse o borrarse.

Al cerrarse:

`PED → RTO`

El pedido deja de aparecer como pedido abierto.

---

## 13. Tres historiales diferentes

### MFA

Historial productivo del granel/fábrica.

### MST

Historial de stock de:

- Productos Finales;
- Materias Primas;
- Componentes.

### MOV

Historial patrimonial.

Una misma operación puede generar registros en más de uno de estos historiales.

---

## 14. Principio transaccional

Las operaciones que modifican varias entidades deben ejecutarse de forma atómica.

Ejemplo: confirmar un RTO no puede:

- descontar stock;
- y luego fallar antes de registrar la cuenta del cliente.

Debe ocurrir todo o no ocurrir nada.

Este principio debe respetarse en:

- fabricación;
- envasado;
- compra;
- venta;
- pagos;
- ajustes;
- liquidación Mercado Libre;
- cualquier otra operación con efectos múltiples.

---

## 15. Alcance del MVP

Dentro del MVP se incluyen:

- Dashboard;
- Mi Fábrica;
- Pedidos;
- Stock;
- Administración;
- Reportes;
- compras;
- ventas;
- cuentas corrientes;
- listas de precios;
- cotización USD;
- Mercado Libre;
- Consumidor Final;
- planificación de pedidos;
- PDFs de remitos y estados de cuenta.

El sistema debe quedar preparado para crecer sin alterar la lógica base.

Los PDFs finales se almacenan como archivos y se vinculan desde la base de datos. La visualización abre el archivo ya generado; no se vuelve a renderizar en cada consulta.

---

## 16. Reglas que NO deben inferirse desde Figma

Figma representa interfaz y navegación.

No debe utilizarse para inferir:

- cálculos;
- efectos patrimoniales;
- reglas de stock;
- snapshots;
- estados;
- validaciones;
- relaciones de base de datos.

Si Figma contradice `BUSINESS_RULES.md`, prevalece `BUSINESS_RULES.md`.
