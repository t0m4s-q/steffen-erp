# COMPONENTS.md — ERP STEFFEN

## 1. Objetivo

Este documento define los componentes visuales reutilizables del ERP.

No contiene lógica de negocio.

Un componente no debe implementar reglas propias que contradigan `BUSINESS_RULES.md` o `FLOWS.md`.

---

# 2. Principio de reutilización

Antes de crear un componente nuevo:

1. revisar este documento;
2. reutilizar una variante existente;
3. agregar una variante solo si existe una necesidad visual real;
4. evitar componentes duplicados con nombres distintos.

Ejemplo:

No crear:

- `ClientSelect`
- `SupplierSelect`
- `ProductSelect`

como controles visualmente diferentes si todos pueden usar el mismo componente `Select` con distinta fuente de opciones.

---

# 3. Tokens base

## Colores

- Primary: `#B99D22`
- Secondary: `#000000`
- Surface: `#FBFBFB`
- Border: `#D9D9D9`
- Tertiary: `#0E50A0`
- Tertiary Hover: `#6E96C6`
- Text: `#393939`
- Green: `#008102`
- Green Hover: `#015C02`
- Red: `#DD0000`
- Red Hover: `#B10000`

## Tipografía

`Inter`

- H1 — 32 px Bold
- H2 — 22 px Bold
- B1 — 16 px Semi-bold
- B2 — 16 px Regular
- B3 — 14 px Semi-bold
- B4 — 14 px Regular

## Gaps

- 6 px
- 12 px
- 20 px

---

# 4. Button

## 4.1 Variantes

### Principal

Uso:

- confirmar acción principal;
- crear;
- registrar;
- actualizar.

### Secundario

Uso:

- cancelar;
- acción alternativa;
- navegación secundaria.

### Verde

Uso:

- acción positiva explícita cuando el diseño lo requiera.

### Rojo

Uso:

- acción destructiva;
- borrar;
- desactivar cuando implique confirmación.

---

## 4.2 Tamaños

### Small

Altura:

`40 px`

### Large

Altura:

`70 px`

---

## 4.3 Padding

Referencia:

- horizontal: `20 px`
- vertical compacto: `6 px`
- vertical estándar: `10 px`

La altura definida del botón tiene prioridad.

---

## 4.4 Estados

Según variante:

- Default
- Hover
- Selected cuando el botón se comporta como selección

No usar Selected en una acción momentánea si no representa estado persistente.

---

# 5. MenuButton

Botón de navegación principal.

Estados:

- Default
- Hover
- Selected

Selected indica el módulo activo.

No usar para acciones de formulario.

---

# 6. TabButton

Uso:

- Productos / Materias Primas / Componentes;
- otras subpestañas.

Estados:

- Default
- Hover
- Selected

Solo una pestaña del mismo grupo puede estar Selected.

---

# 7. ListSelectorButton

Uso:

- selector de Cliente en Cuentas;
- selector de Proveedor;
- selector lateral de entidades.

Estados:

- Default
- Hover
- Selected

Puede acompañarse por `VER MÁS`.

---

# 8. BackButton

Etiqueta:

`Volver`

Uso exclusivo:

volver a la pantalla anterior.

No utilizar como Cancelar dentro de formularios.

---

# 9. TextInput

Usos:

- nombre;
- domicilio;
- localidad;
- descripción;
- INCI;
- presentación;
- teléfono;
- DNI.

Estados visuales mínimos:

- Default
- Focus
- Disabled
- Error

MVP:

- Focus → borde `Primary`;
- Disabled → fondo `Surface`, borde `Border`, interacción bloqueada;
- Error → borde `Red` + mensaje B4 `Red`.

No crear una nueva identidad visual fuera de estos tokens.

---

# 10. NumberInput

Base para datos numéricos.

Variantes funcionales:

- Integer
- Decimal
- Money
- Percentage
- WeightKg

---

# 11. WeightInput

Label siempre incluye:

`(kg)`

Precisión:

hasta 3 decimales.

Ejemplos válidos:

- `0,350`
- `1,000`
- `180,000`

No mostrar ni almacenar gramos.

---

# 12. UnitInput

Uso:

- unidades de PRO;
- unidades de COM;
- cantidades AG;
- bultos.

Solo enteros.

---

# 13. MoneyInput

Uso para importes editables.

Ejemplos:

- Pago;
- Transporte;
- Gasto;
- Retiro;
- Precio Compra.

Los costos calculados no usan MoneyInput; usan `MoneyDisplay`.

---

# 14. MoneyDisplay

Componente no editable.

Uso:

- totales;
- costos;
- saldos;
- precios derivados;
- Ganancia;
- Caja.

Debe distinguirse visualmente de un input.

---

# 15. PercentageInput

Uso:

- descuento manual;
- aumento masivo de Lista.

Los descuentos de Cliente registrados en su ficha pueden utilizar este componente.

---

# 16. DateInput

Componente de fecha con:

- fecha actual por defecto cuando corresponda;
- calendario desplegable;
- posibilidad de seleccionar fecha anterior.

No reemplazar `business_date` por `created_at`.

---

# 17. Select

Componente desplegable reutilizable.

Usos:

- Cliente;
- Proveedor;
- PBA;
- GRA;
- PRO;
- MPR;
- COM;
- moneda del Proveedor al crear/editar su ficha;
- tipo;
- Lista de Precios;
- perfil de descuento.

Debe admitir contenido compuesto, por ejemplo:

`CLIENTE | SALDO`

---

# 18. SearchInput

Uso:

- búsqueda en tablas;
- Clientes;
- Proveedores;
- Stock;
- Movimientos.

No reemplaza filtros estructurados.

---

# 19. Card

Uso exclusivo para:

- KPI;
- saldo;
- indicador;
- resumen.

Estructura:

1. label;
2. valor principal;
3. contexto secundario opcional.

No usar Card para reemplazar una tabla de gestión.

---

# 20. DataTable

Componente base para listados densos.

Debe soportar:

- columnas configurables;
- alineación numérica;
- fila de total;
- fila crítica;
- acciones;
- búsqueda/filtros externos;
- orden según datos entregados.

El componente no decide la lógica de orden.

---

# 21. CriticalRow

Variante de fila.

Usa semántica roja.

Aplicaciones:

- stock debajo del mínimo;
- otras alertas confirmadas.

La fila recibe el estado desde negocio.

No calcula internamente `stock_actual / stock_minimum`.

---

# 22. TotalRow

Fila de totales.

Uso:

- ventas;
- pedidos;
- compras;
- cuentas;
- remitos.

Debe diferenciarse de las filas de datos sin competir con H1/H2.

---

# 23. ActionCell

Celda de acciones de tabla.

Acciones visuales principales:

- Ver → ojo
- Editar → lápiz
- Borrar → acción destructiva

No mostrar lápiz si el registro es inmutable.

---

# 24. StatusBadge

Uso:

- `URG PARA PEDIDOS`
- `POCO STOCK`
- estados de lote;
- estados operativos si se muestran.

Semántica visual:

- urgencia → roja;
- estado no crítico → token correspondiente definido en diseño.

No inventar nuevos significados por color.

---

# 25. Modal / OperationWindow

Contenedor reutilizable para acciones.

Estructura:

1. Header
2. Body
3. Footer de acciones

Header:

- título H2;
- cierre si se define.

Body:

- campos;
- secciones;
- tablas internas si corresponde.

Footer:

- Cancelar;
- Confirmar.

El comportamiento responsive se define en `DESIGN.md` y en la sección Responsive de este documento.

---

# 26. FormField

Wrapper de:

- Label
- Control
- Hint opcional
- Error opcional

Los labels deben permanecer visibles.

No usar placeholder como único label.

---

# 27. ReadOnlyField

Uso para valores automáticos dentro de formularios.

Ejemplos:

- Código automático;
- Precio calculado;
- kg disponibles;
- costo total;
- comisión.

Debe parecer dato del formulario, pero no editable.

---

# 28. Tabs

Componente contenedor de subpestañas.

Uso confirmado:

Stock:

- Productos
- Materias Primas
- Componentes

Debe conservar el estado Selected.

---

# 29. DragHandle

Uso:

- filas de Resumen de Pedidos;
- columnas PED.

Indica que el elemento puede reordenarse.

El componente visual no modifica stock ni genera reservas reales.

---

# 30. PlanningMatrix

Componente específico de Pedidos.

Partes:

- columna Producto;
- columnas PED;
- Total;
- Stock;
- cobertura;
- Faltante.

Capacidades:

- reorder de filas;
- reorder de columnas;
- celda crítica;
- faltante crítico.

Debe recibir resultados calculados desde el motor de planificación.

No calcular inventario dentro del componente.

---

# 31. PlanningCell

Estados:

### Normal

Cantidad completamente cubierta.

### Shortage

Cantidad del PED no completamente cubierta.

Visual:

rojo.

La cifra mostrada sigue siendo la cantidad solicitada.

---

# 32. SimulationNotice

Leyenda para zonas de simulación.

Texto conceptual:

`Simulación de planificación — no modifica stock ni genera movimientos.`

Uso:

- Resumen de Pedidos;
- Simular Compra cuando sea necesario.

---

# 33. SummaryValue

Par label/valor.

Usos:

- Subtotal;
- Total Pedido;
- Saldo;
- Total a Cobrar;
- Costo Productos;
- Transporte;
- Ganancia;
- Neto.

Debe permitir enfatizar el total final.

---

# 34. DiscountBreakdown

Representa descuentos sucesivos.

Debe mostrar cada paso por separado.

Ejemplo:

- 30%
- 10%
- 5%

No mostrar simplemente 45%.

---

# 35. PriceListSelector

Select especializado de Listas activas.

Opciones mínimas:

- Salón
- Público
- Ecommerce

Puede incluir listas futuras.

---

# 36. DiscountProfileSelector

Uso exclusivo en Costo-Ganancia.

Opciones iniciales:

- 35%
- 30% + 10% + 5%
- 40% + 10%
- 50%

Es simulación.

No modifica fichas de Clientes.

---

# 37. CurrencyRateField

Bloque para cotización USD.

Partes:

- Cotización Actual;
- Última actualización;
- Nueva Cotización;
- Actualizar.

---

# 38. PurchaseFxOverride

Visible únicamente en CMP de proveedor USD.

Partes:

- Cotización global propuesta;
- input Cotización utilizada en esta compra.

Debe comunicar que cambiar este input:

- modifica solo la CMP;
- no actualiza la cotización global.

---

# 39. AccountSummaryTable

Uso:

- Resumen Clientes;
- Deudas Proveedores.

Variantes:

### Clientes

Muestra todos.

Saldo positivo:

fila crítica/roja y prioritaria.

### Proveedores

Muestra solo deuda positiva.

---

# 40. LedgerTable

Uso para cuenta corriente de Cliente/Proveedor.

Formato tipo asiento.

Debe admitir:

- fecha;
- referencia;
- débito/crédito o campos equivalentes definidos por pantalla;
- saldo acumulado;
- acciones.

El cálculo del saldo no ocurre en UI.

---

# 41. MovementTable

Variantes:

- MST
- MFA
- MOV

Todas comparten patrón tabular, pero sus columnas difieren.

No mezclar los tres tipos en un único historial visual si el módulo requiere uno específico.

---

# 42. DocumentLink

Acción para abrir:

- RTO;
- RTM;
- PDF Estado de Cuenta.

No debe simular edición.

---

# 43. ConfirmationDialog

Obligatorio para acciones destructivas confirmadas.

Caso explícito:

- Borrar PED abierto.

Contenido mínimo:

- acción;
- entidad afectada;
- Cancelar;
- Confirmar.

No usar para acciones normales.

---

# 44. InlineEditAction

Icono lápiz.

Solo mostrar donde la edición esté permitida.

Casos:

- ficha Cliente;
- ficha Proveedor;
- Pago;
- Compra;
- MPR/COM asociado a Proveedor;
- Fórmula vigente mediante flujo de versión.

No mostrar para:

- RTO COMPLETED;
- RTM;
- históricos inmutables.

---

# 45. CostBreakdown

Componente visual para:

- Producto Final;
- Fórmula;
- RTM.

Permite listar:

- concepto;
- cantidad;
- costo unitario;
- costo total.

No recalcula por sí mismo.

---

# 46. StockPriorityTable

Configuración de DataTable para:

- PRO;
- MPR;
- COM.

Recibe filas ya ordenadas por:

`stock_actual / stock_mínimo ASC`

CriticalRow:

`stock_actual < stock_mínimo`

---

# 47. FilterBar

Contenedor de filtros.

Usos:

Movimientos:
- fecha desde;
- fecha hasta;
- tipo;
- búsqueda.

Ventas:
- año;
- mes.

Stock:
- proveedor;
- búsqueda.

No mezclar filtros con acciones primarias.

---

# 48. EntityPicker

Patrón compuesto para pantallas de cuentas.

Partes:

- botones/lista de entidades recientes;
- Selected;
- Ver Más;
- Buscar opcional.

Orden entregado desde backend:

`updated_at DESC`

---

# 49. QuickActionGrid

Uso Dashboard.

Acciones confirmadas:

- Compra;
- Nuevo Pedido;
- Envasado;
- Fabricación;
- Pago Cliente;
- Pago Proveedor.

Cada botón abre el flujo original.

---

# 50. MarketplaceSettlementSummary

Componente específico de Liquidación ML.

Muestra:

- Saldo Caja ML;
- Bruto;
- Neto;
- Comisión.

Relación visual:

`Bruto = Neto + Comisión`

---

# 51. EmptyState

Estado vacío MVP:

- texto B2/B4 según densidad;
- color `Text`;
- sin ilustraciones;
- sin nuevos colores;
- mensaje específico al contexto;
- acción primaria solo cuando exista una acción obvia.

Ejemplos:

- `No hay pedidos abiertos.`
- `No hay lotes de granel disponibles.`
- `No hay proveedores con deuda pendiente.`

---

# 52. Loading / Error global

## Loading

Durante una operación que confirma datos:

- deshabilitar temporalmente la acción que la disparó;
- mostrar indicador de carga dentro del botón o zona correspondiente;
- no mostrar éxito antes del commit;
- evitar doble envío.

## Error

Error de validación:

- borde/estado `Red`;
- mensaje B4 próximo al campo o bloque afectado.

Error transaccional/general:

- mostrar mensaje visible con causa concreta cuando esté disponible;
- mantener los datos ingresados siempre que sea seguro;
- ofrecer Reintentar cuando corresponda.

No utilizar errores silenciosos.

---

# 53. Formato numérico

## Pesos argentinos

Mostrar con separador de miles.

Listas de Precios:

sin centavos.

Costos internos:

pueden conservar decimales aunque la presentación puede redondearse visualmente según contexto.

No truncar el valor persistido.

## Kg

Mostrar máximo 3 decimales.

## Unidades

Enteros.

---

# 54. Nomenclaturas a corregir del Figma

Implementar:

- `MPR`, no MAT.
- `MST`, no MVS.
- `MFA`, no MVF.
- `Costo-Ganancia`, no Margen por producto.
- `Ganancia`, no Margen.
- `Peso (kg)`.
- `Agregar componente`, no Agregar materia prima dentro de Nuevo Producto.
- `Costo extra variable`, no Costo embalaje.
- `Proveedor`, no Cliente en Pago a Proveedores.
- `Total Pedido`.
- `Total a Cobrar`.

---

# 55. Componentes pendientes de especificación visual

El MVP ya define comportamiento suficiente para implementar:

- Focus;
- Disabled;
- Error;
- Loading;
- Empty State;
- responsive;
- navegación mobile;
- tablas mobile;
- PDFs.

Quedan como refinamiento visual posterior:

- apariencia exacta del calendario desplegado del DatePicker;
- apariencia exacta del menú desplegado del Select;
- Toast/feedback no crítico;
- animaciones/transiciones.

Estos refinamientos no deben modificar reglas funcionales ni bloquear el MVP.


---

# 56. Responsive behavior

## Button

Mobile:

- mantiene mínimo 40 px de alto;
- puede ocupar 100% del ancho en formularios;
- acciones secundarias pueden compartir fila si entran cómodamente.

## DataTable

Debe soportar:

- modo normal desktop;
- overflow horizontal;
- primera columna sticky;
- header sticky;
- render alternativo tipo bloques cuando la pantalla lo defina.

La estrategia la decide la pantalla, no el componente por sí solo.

## Modal / OperationWindow

Desktop:

- modal/ventana.

Mobile:

- variante `full-screen`;
- header fijo opcional;
- footer de acciones fijo opcional;
- body scrolleable.

## Tabs

En mobile:

- si son pocas y entran, mantener tabs;
- si no entran, usar scroll horizontal solo para subpestañas;
- la navegación principal no usa tabs horizontales.

## PlanningMatrix

Mobile:

- overflow horizontal;
- primera columna sticky;
- header sticky;
- drag touch;
- alternativa `Ordenar prioridad`.

## Card

Mobile:

- `width: 100%` por defecto;
- KPI compactos pueden ocupar 50% si el ancho útil lo permite.

## FilterBar

Desktop:

- horizontal.

Mobile:

- wrap vertical;
- controles 100% ancho cuando sea necesario.

## EntityPicker

Desktop:

- lista visible.

Mobile:

- selector/search compacto;
- no ocupar altura excesiva con muchas entidades.

## ActionCell

Touch target mínimo:

`40 × 40 px`

## FormField

Mobile:

- width 100%;
- label siempre visible.

---

# 57. MobileFullScreenForm

Variante de contenedor para operaciones complejas en mobile.

Estructura:

1. Header
   - volver/cerrar;
   - título.
2. Body scrolleable.
3. Footer de acciones.

Uso:

- Compra;
- Pedido;
- Fabricación;
- Envasado;
- Fórmula;
- Producto;
- Pago;
- Gasto;
- Liquidación ML.

---

# 58. PriorityReorderSheet

Alternativa mobile al drag dentro de PlanningMatrix.

Contenido:

- título;
- lista vertical;
- DragHandle;
- etiqueta del Producto o PED;
- acción Guardar.

Permite ordenar:

- Productos;
- Pedidos.

No genera movimientos de negocio.

---

# 59. SupplierCurrencyDisplay

Uso:

- Compra;
- ficha/resumen de Proveedor.

Muestra la moneda definida en la ficha del Proveedor:

- ARS;
- USD.

Dentro de una CMP es un valor automático/no editable.

En la ficha de un Proveedor ya registrado también es solo lectura.

Si el Proveedor usa USD, `PurchaseFxOverride` permite modificar únicamente la cotización usada por esa CMP.


---

# 60. ReportMetricCard

Card específica de la pestaña Reportes.

Contenido:

1. valor;
2. label.

Variantes del MVP:

### NeutralPrimaryBorder

Uso:

- Ventas del mes;
- Total facturado.

Visual:

- fondo `Surface`;
- borde `Primary`;
- texto `Secondary/Text`.

### Positive

Uso:

- Ganancia.

Visual:

- fondo `Green`;
- texto de alto contraste.

### Dark

Uso:

- Pedidos abiertos.

Visual:

- fondo `Secondary`;
- texto de alto contraste.

Labels exactos:

- `VENTAS DEL MES`
- `TOTAL FACTURADO`
- `GANANCIA`
- `PEDIDOS ABIERTOS`

No utilizar `MARGEN NETO`.
