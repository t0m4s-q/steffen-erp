# DESIGN.md — ERP STEFFEN

## 1. Objetivo

Este documento define la implementación visual y de interacción del ERP Steffen.

No define lógica de negocio, cálculos, persistencia ni efectos sobre stock/patrimonio.

Prioridad documental:

1. `BUSINESS_RULES.md`
2. `DATA_MODEL.md`
3. `FLOWS.md`
4. `DESIGN.md`
5. `COMPONENTS.md`

Si el Figma o una pantalla visual contradice una regla funcional ya confirmada, se corrige la interfaz.  
La lógica funcional no se modifica para coincidir con un diseño desactualizado.

---

# 2. Fuente visual

El Figma/PDF entregado es la referencia visual actual para:

- jerarquía;
- distribución de secciones;
- paleta;
- tipografía;
- botones;
- tablas;
- formularios;
- navegación;
- ventanas operativas;
- pantallas secundarias.

Las anotaciones funcionales antiguas del Figma no reemplazan a `BUSINESS_RULES.md`.

---

# 3. Responsive y estrategia por dispositivo

## 3.1 Principio general

El ERP mantiene **la misma funcionalidad en desktop, tablet y mobile**.

Desde mobile se debe poder:

- consultar;
- fabricar;
- envasar;
- crear y editar Pedidos abiertos;
- confirmar RTO;
- completar RTM;
- registrar Compras;
- registrar Pagos;
- registrar Gastos;
- registrar Retiros;
- liquidar Mercado Libre;
- administrar Stock;
- consultar y editar Fórmulas;
- consultar Cuentas;
- generar documentos;
- utilizar planificación.

No existe una versión mobile “solo lectura”.

El responsive adapta la interfaz, pero no recorta funcionalidades.

---

## 3.2 Breakpoints

### Mobile

`360 px – 767 px`

Ancho mínimo soportado:

`360 px`

### Tablet

`768 px – 1023 px`

### Desktop

`1024 px+`

La implementación debe ser fluida dentro de cada rango.

---

## 3.3 Padding horizontal

### Mobile

- 360–390 px → `16 px`
- 391–767 px → `20 px`

### Tablet

`24 px`

### Desktop

`24–32 px`, según densidad de la pantalla.

Las tablas que necesiten más ancho pueden ocupar todo el espacio disponible del viewport.

---

## 3.4 Ancho de contenido

No utilizar un contenedor rígido pequeño para todo el ERP.

### Desktop

- utilizar el ancho disponible;
- centrar contenido cuando corresponda;
- permitir que tablas y matrices aprovechen el viewport;
- evitar un máximo tipo 1200 px que comprima información densa.

Para pantallas informativas simples puede existir un máximo amplio, pero las tablas operativas tienen prioridad sobre ese límite.

---

## 3.5 Navegación responsive

### Desktop

Mantener navegación superior completa:

- Dashboard
- Mi Fábrica
- Pedidos
- Stock
- Fórmulas
- Administración
- Reportes

### Tablet

Mantener navegación superior mientras entre correctamente.

Si deja de entrar sin compresión excesiva:

- utilizar navegación compacta;
- o menú desplegable.

### Mobile

La navegación principal pasa a:

- barra superior;
- nombre del módulo actual;
- botón menú;
- drawer lateral / menú desplegable.

El menú muestra todos los módulos.

No utilizar scroll horizontal de siete pestañas como navegación principal mobile.

---

## 3.6 Jerarquía vertical mobile

En mobile:

1. título/contexto;
2. acciones principales;
3. filtros;
4. contenido;
5. acciones secundarias.

Las secciones que en desktop están lado a lado pasan a apilarse verticalmente.

Gap principal entre secciones:

`20 px`

Gap interno habitual:

`12 px`

Gap compacto:

`6 px`

---

## 3.7 Cards responsive

### Desktop

Distribuir horizontalmente según el Figma y el ancho disponible.

### Tablet

2–3 por fila según contenido.

### Mobile

Preferencia:

- 2 KPI pequeños por fila;
- 1 por fila si el contenido necesita más ancho.

Cards de contenido complejo ocupan:

`100%`

---

## 3.8 Tablas responsive

No existe una única transformación para todas las tablas.

Se utilizan tres estrategias.

### A. Tabla simple → bloques mobile

Aplicar cuando cada fila puede comprenderse como una entidad individual con pocos campos.

Ejemplos:

- Productos;
- Pedidos abiertos;
- Granel disponible;
- Próximas fabricaciones.

En mobile cada fila puede convertirse en bloque vertical manteniendo:

- dato principal;
- datos secundarios;
- estado;
- acción.

### B. Tabla densa → scroll horizontal

Aplicar cuando transformar a cards destruiría la comparación entre columnas.

Ejemplos:

- Materias Primas;
- Movimientos;
- Ventas;
- cuentas corrientes;
- Fórmulas;
- costos;
- listas de precios.

Reglas:

- contenedor con overflow horizontal;
- conservar encabezados;
- no reducir texto a tamaños ilegibles;
- columnas numéricas mantienen alineación;
- si corresponde, primera columna sticky.

### C. Matriz → scroll horizontal + sticky

Aplicar al Resumen de Pedidos.

- primera columna Producto sticky;
- encabezado superior sticky;
- columnas PED conservan ancho legible;
- scroll horizontal;
- scroll vertical normal;
- estados críticos visibles;
- drag/reorder compatible con touch.

---

## 3.9 Sticky headers

Cuando una tabla o matriz requiere scroll:

- encabezado puede permanecer sticky;
- primera columna puede permanecer sticky cuando sea necesaria para mantener contexto.

Especialmente:

- Resumen de Pedidos;
- tablas financieras extensas;
- fórmulas extensas.

---

## 3.10 Formularios y ventanas operativas

### Desktop

Usar ventana/modal cuando corresponda.

### Tablet

Modal amplio o panel según contenido.

### Mobile

Toda operación compleja pasa a **pantalla completa**.

Ejemplos:

- Compra;
- Nuevo Pedido;
- Fabricación;
- Envasado;
- Nueva Fórmula;
- Nuevo Producto;
- Pago;
- Gasto;
- Liquidación ML.

Reglas mobile:

- inputs 100% ancho;
- secciones apiladas;
- tablas internas adaptadas;
- header con título;
- acción de volver/cerrar;
- footer fijo con acciones principales cuando sea útil.

---

## 3.11 Footer de acciones mobile

En operaciones de creación/registro:

- `Cancelar` / `Volver`
- acción primaria

pueden mantenerse fijos en la parte inferior.

Debe reservarse espacio para que el contenido no quede oculto debajo del footer.

---

## 3.12 Inputs mobile

- ancho 100%;
- labels visibles;
- separación mínima 12 px;
- controles táctiles cómodos;
- evitar controles pequeños juntos;
- selects y date pickers deben poder abrirse correctamente en viewport reducido.

No reducir tipografía por debajo de los tokens definidos solo para “hacer entrar” contenido.

---

## 3.13 Drag & drop mobile

El Resumen de Pedidos debe soportar reordenamiento con touch.

Además del drag directo, mobile debe ofrecer una alternativa:

`ORDENAR PRIORIDAD`

Esta acción abre una lista vertical reordenable.

Se aplica a:

- prioridad de Productos;
- prioridad de Pedidos.

La alternativa evita depender exclusivamente de arrastrar columnas dentro de una matriz horizontal.

---

## 3.14 Dashboard responsive

### Desktop

Mantener composición multicolumna del diseño.

### Tablet

Reorganizar en 2 columnas cuando el contenido lo permita.

### Mobile

Orden recomendado:

1. KPI;
2. Acceso Rápido;
3. Resumen de Pedidos;
4. Alertas Stock / Simular Compra;
5. Cuentas;
6. Disponible en Granel.

Los bloques ocupan ancho completo salvo KPI pequeños.

---

## 3.15 Mi Fábrica responsive

### Desktop

Mantener estructura del diseño.

### Mobile

Ordenar:

1. acciones rápidas;
2. Próximas fabricaciones;
3. Granel disponible;
4. Costo-Ganancia;
5. Movimientos de Fábrica.

Las tablas simples pueden convertirse en bloques.

Costo-Ganancia y Movimientos pueden usar scroll horizontal.

---

## 3.16 Pedidos responsive

### Lista de Pedidos abiertos

Mobile:

- filas transformables a bloques;
- código y cliente como información principal;
- importe y fecha secundarios;
- acción Ver visible.

### Resumen de Pedidos

Siempre mantener concepto de matriz.

Mobile:

- scroll horizontal;
- Producto sticky;
- encabezado sticky;
- acción `Ordenar prioridad`.

### Pedido individual

Mobile:

- cabecera en bloques;
- líneas de pedido en tabla horizontal o cards por producto, según densidad;
- AG debe quedar visible/editable;
- totales al final;
- acciones principales fijas cuando corresponda.

---

## 3.17 Stock responsive

### Productos

Mobile:

puede transformarse a bloques.

### Materias Primas / Componentes

Debido a cantidad de columnas:

- scroll horizontal;
- primera columna Código/Producto sticky cuando ayude;
- filtros arriba.

---

## 3.18 Administración responsive

### Desktop

Mantener composición por bloques.

### Mobile

Orden:

1. acciones administrativas;
2. Cotización USD;
3. Cuentas;
4. Ventas;
5. Clientes;
6. Proveedores;
7. Últimos Movimientos.

Las tablas largas usan las reglas de tabla densa.

---

## 3.19 Cuentas Cliente/Proveedor responsive

### Selector de entidades

Desktop:

lista/botones laterales o superiores según diseño.

Mobile:

- selector desplegable;
- búsqueda;
- `Ver más` si corresponde.

### Ficha

Campos en una sola columna.

### Asiento

Scroll horizontal o formato de ledger compacto.

No ocultar saldo.

---

## 3.20 Listas de Precios responsive

Mobile:

1. selector de lista;
2. acciones de lista;
3. filtros/búsqueda;
4. tabla horizontal.

La selección masiva debe seguir siendo utilizable con touch.

---

## 3.21 Reportes responsive

Cards:

- desktop → grilla;
- tablet → 2 columnas;
- mobile → 1 columna o 2 para KPI muy pequeños.

---

## 3.22 Touch targets

Elementos interactivos deben ser cómodos para touch.

Referencia mínima:

`40 px`

Aplicar a:

- botones;
- icon buttons;
- handles;
- tabs;
- filas seleccionables.

---

## 3.23 Texto y truncado

Evitar cortar información crítica.

Si el contenido es largo:

- wrap cuando sea razonable;
- ellipsis solo si existe forma de ver el contenido completo;
- no truncar importes;
- no truncar códigos esenciales;
- no truncar estados críticos.

---

## 3.24 Orientación

El sistema debe funcionar en portrait y landscape.

Mobile landscape puede aprovechar mayor ancho para tablas, pero no debe ser requisito para operar.

---

# 4. Sistema visual

## 4.1 Paleta

| Token | Valor | Uso |
|---|---|---|
| Primary | `#B99D22` | acciones principales / selección |
| Secondary | `#000000` | acciones secundarias fuertes / navegación |
| Surface | `#FBFBFB` | superficies |
| Border | `#D9D9D9` | bordes y divisores |
| Tertiary | `#0E50A0` | acciones terciarias |
| Tertiary Hover | `#6E96C6` | hover terciario |
| Text | `#393939` | texto principal |
| Green | `#008102` | estados/acciones positivas |
| Green Hover | `#015C02` | hover positivo |
| Red | `#DD0000` | riesgo, faltante, acción destructiva |
| Red Hover | `#B10000` | hover destructivo |

No crear colores semánticos nuevos si un token existente cubre el caso.

---

# 5. Tipografía

Familia:

`Inter`

Jerarquías definidas:

| Token | Tamaño | Peso |
|---|---:|---|
| H1 | 32 px | Bold |
| H2 | 22 px | Bold |
| B1 | 16 px | Semi-bold |
| B2 | 16 px | Regular |
| B3 | 14 px | Semi-bold |
| B4 | 14 px | Regular |

Regla:

- títulos de pantalla → H1;
- títulos de sección → H2;
- labels importantes / encabezados de tabla → B1 o B3 según densidad;
- contenido general → B2;
- contenido secundario denso → B4.

---

# 6. Espaciado

Tokens definidos en Figma:

`6 px`

`12 px`

`20 px`

Deben reutilizarse como escala principal de separación.

No introducir una escala arbitraria distinta sin actualizar este documento.

---

# 7. Márgenes / padding

Valores presentes en el sistema visual:

- Laterales: `20 px`
- Superior/inferior compacto: `6 px`
- Superior/inferior estándar: `10 px`

Uso exacto por componente se define en `COMPONENTS.md`.

---

# 8. Botones

Alturas definidas:

- Chico: `40 px`
- Grande: `70 px`

Variantes visuales principales:

- Principal
- Secundario
- Verde
- Rojo

Además existen tratamientos específicos para:

- Menu
- Lista
- Pestaña
- Volver

Estados visuales disponibles según componente:

- Default
- Hover
- Selected

Las reglas completas están en `COMPONENTS.md`.

---

# 9. Navegación principal

La navegación principal vigente del MVP es:

- Dashboard
- Mi Fábrica
- Pedidos
- Stock
- Fórmulas
- Administración
- Reportes

`FÓRMULAS` se conserva como pestaña principal, tal como está planteado en la referencia visual.

Mi Fábrica puede incluir accesos/resúmenes de Fórmulas, pero esos accesos deben llevar a la misma funcionalidad y no crear una implementación duplicada.

---

# 10. Patrón general de pantalla

Cada pantalla principal debe mantener:

1. navegación global superior;
2. título/contexto del módulo;
3. acciones principales próximas al contenido que modifican;
4. secciones agrupadas por función;
5. tablas para información densa;
6. cards únicamente para indicadores/resúmenes;
7. ventanas operativas para crear/registrar acciones;
8. pantallas secundarias para detalle/historial completo.

No convertir información tabular en cards si el Figma la define como tabla.

---

# 11. Patrón de ventanas operativas

Las ventanas ubicadas por encima de las pantallas principales en Figma representan acciones disparadas desde botones.

Ejemplos:

- Fabricación;
- Envasado;
- Nueva Fórmula;
- Nuevo Producto;
- Nuevo Pedido;
- Compra;
- Pago Cliente;
- Pago Proveedor;
- Gasto Operativo;
- Retiro;
- Nueva MPR/COM;
- Nuevo Cliente;
- Nuevo Proveedor.

Características visuales:

- título claro;
- labels sobre inputs;
- valores automáticos visualmente distinguibles de campos editables;
- acciones al final;
- `Cancelar` como acción secundaria;
- acción de confirmación como botón principal/semántico correspondiente.

No definir tamaños de modal o breakpoint de modal hasta cerrar responsive.

---

# 12. Patrón de tablas

Las tablas son el componente principal de información del ERP.

Deben mantener:

- encabezados consistentes;
- alineación numérica coherente;
- acciones al extremo correspondiente;
- filas densas;
- bordes/divisores usando `Border`;
- estados críticos visibles;
- totales diferenciados.

Los cálculos y criterios que determinan cada estado pertenecen a `BUSINESS_RULES.md`.

---

# 13. Estados críticos en rojo

El rojo comunica un problema operativo que requiere atención.

Casos confirmados:

- stock actual menor que stock mínimo;
- faltante de cobertura en Resumen de Pedidos;
- celda de un PED cuya cantidad no puede cubrirse completamente;
- estados/acciones destructivas cuando corresponda.

No usar rojo como decoración.

---

# 14. Acciones por icono

Patrones presentes:

- ojo → visualizar;
- lápiz → editar.

Acciones históricas inmutables deben ofrecer visualización, no edición.

Ejemplos:

- RTO finalizado → visualizar;
- RTM finalizado → visualizar.

---

# 15. Dashboard

## 15.1 Objetivo visual

Debe funcionar como resumen operativo.

Bloques:

- cards de indicadores;
- Resumen de Pedidos;
- Acceso Rápido;
- Alerta Stock MPR/COM + Simular Compra;
- Cuentas;
- Disponible en Granel.

---

## 15.2 Cards

Las cards muestran valores derivados en tiempo real.

No deben parecer inputs.

Deben priorizar:

1. nombre de métrica;
2. valor;
3. contexto temporal si aplica.

---

## 15.3 Acceso rápido

Botones visibles para:

- Compra;
- Nuevo Pedido;
- Envasado;
- Fabricación;
- Pago Clientes;
- Pago Proveedor.

Deben abrir exactamente la misma operación que su acceso desde el módulo correspondiente.

No crear flujos duplicados.

---

## 15.4 Resumen de Pedidos

Debe reutilizar visualmente la misma lógica de la matriz de Pedidos, en versión resumida.

No debe aparentar una reserva real.

---

## 15.5 Alerta stock / Simular compra

Tabla compacta con:

- Código;
- Producto;
- Proveedor;
- Actual;
- Cantidad simulada;
- Total estimado.

La simulación debe diferenciarse visualmente de una Compra real.

---

# 16. Mi Fábrica

## 16.1 Acciones principales

Botones:

- Registrar Fabricación;
- Envasado;
- Nuevo Producto;
- Nueva Fórmula;
- Ver todos según sección.

---

## 16.2 Granel disponible

Tabla/listado con:

- GRA;
- Fecha;
- Producto Base;
- kg disponibles.

Cada lote se muestra individualmente.

---

## 16.3 Próximas fabricaciones

Tabla con:

- Producto Final;
- Stock mínimo;
- Stock actual;
- Estado;
- acceso a simulación cuando corresponda.

Estados:

- `URG PARA PEDIDOS`
- `POCO STOCK`

`URG PARA PEDIDOS` tiene prioridad visual.

---

## 16.4 Fórmulas

La pantalla secundaria muestra:

- PBA;
- código MPR;
- Materia Prima;
- cantidad `(kg)`;
- costo/kg;
- costo final;
- total kg;
- costo granel;
- costo por kg.

Debe existir acción Editar Fórmula.

---

## 16.5 Productos Finales

Pantalla secundaria con lista de PRO y ficha del producto seleccionado.

Ficha:

- Código;
- Fecha creación;
- PBA;
- Presentación;
- Peso `(kg)`;
- composición;
- costo base;
- componentes;
- subtotal;
- costo extra variable 2%;
- costo total.

---

## 16.6 Costo-Ganancia

Nombre definitivo:

`COSTO-GANANCIA`

No utilizar “Margen por producto”.

Tabla:

- Producto Final;
- Costo Total;
- Precio Lista Salón;
- Descuento;
- Precio Final;
- Markup;
- Ganancia.

Selector de descuento:

- 35%;
- 30% + 10% + 5%;
- 40% + 10%;
- 50%.

La sección utiliza exclusivamente Lista Salón.

---

## 16.7 Movimientos de Fábrica

Tabla:

- Código MFA;
- Fecha;
- Tipo;
- Descripción;
- Origen/registro.

Tipos visibles:

- Fabricación;
- Envasado;
- Merma;
- Sobrante.

---

# 17. Stock

## 17.1 Subpestañas

- Productos
- Materias Primas
- Componentes

Mantener patrón de pestañas consistente.

---

## 17.2 Productos

Tabla:

- Código;
- Producto Final;
- Stock Actual;
- Stock Mínimo.

Filas críticas:

- rojo cuando `actual < mínimo`.

El orden no se representa como orden alfabético/código, sino por prioridad de stock definida en negocio.

---

## 17.3 Materias Primas

Tabla con información más densa:

- Código;
- Proveedor de referencia;
- Materia Prima;
- INCI;
- Última Compra;
- Última Actualización de Precio;
- Moneda;
- Precio unitario moneda origen;
- Precio unitario ARS;
- Precio unitario ARS + IVA;
- Stock Actual;
- Stock Mínimo.

Filtro por proveedor.

El proveedor visible principal es el de la **última actualización de precio** del ítem.

---

## 17.4 Componentes

Mismo patrón de prioridad y criticidad que Materias Primas.

Unidad de stock:

`unidades`

---

## 17.5 Movimientos de Stock

Tabla:

- Código MST;
- Fecha;
- Tipo;
- Registro;
- Descripción.

No utilizar el prefijo viejo MVS.

---

# 18. Pedidos

## 18.1 Pedidos abiertos

Tabla superior:

- Código PED;
- Fecha;
- Cliente/origen;
- Importe final potencial;
- Ver.

Solo PED abiertos.

---

## 18.2 Resumen de Pedidos

Es una matriz.

Filas:

Productos Finales presentes en al menos un pedido abierto.

Columnas:

Pedidos abiertos.

Columnas finales:

- Total;
- Stock;
- cobertura con granel;
- Faltante.

---

## 18.3 Reordenamiento

Filas y columnas son reordenables.

La UI debe dejar claro que:

- orden de filas = prioridad de productos;
- orden de columnas = prioridad de pedidos/clientes.

El orden persistido debe reflejarse al volver a entrar.

---

## 18.4 Faltantes

Si un PED no puede cubrir su cantidad:

- la celda de cantidad se marca en rojo.

Si el producto queda con faltante:

- el faltante final se marca en rojo.

---

## 18.5 Reserva simulada

Debe existir una leyenda o indicación visual que deje claro:

`Planificación / simulación — no modifica stock`

No presentar reservas virtuales como stock comprometido real.

## 18.6 RTM pendiente

Si existe un RTO en estado `RTM_PENDING`:

- mostrar una alerta persistente y prioritaria;
- ofrecer acción `COMPLETAR RTM`;
- al entrar a Pedidos, priorizar este flujo;
- deshabilitar la confirmación de un nuevo RTO hasta resolverlo.

---

# 19. Pedido abierto

Pantalla/ventana de detalle del PED.

Muestra:

- Código;
- Fecha;
- Cliente/datos;
- Domicilio;
- bultos;
- peso `(kg)`;
- líneas;
- Cantidad;
- Producto;
- PU;
- PT;
- AG;
- Subtotal;
- descuentos;
- Total Pedido;
- Saldo;
- Total a Cobrar.

Acciones por línea:

- editar;
- borrar.

Acción destructiva:

- Borrar Pedido con confirmación.

---

# 20. RTO

El RTO final:

- reemplaza cantidad solicitada por cantidad enviada AG;
- muestra cálculos reales;
- es documento histórico;
- luego de confirmar no se edita.

Debe permitir visualizar/generar PDF.

---

# 21. RTM

Misma base visual del RTO agregando:

- Costo Unitario;
- Costo Total;
- Costo Productos;
- Transporte;
- Ganancia.

No utilizar “Margen”.

---

# 22. Administración — pantalla principal

La pantalla vigente incluye:

- acciones superiores;
- Cotización USD;
- Ventas;
- Resumen Cuentas Clientes;
- Deudas Proveedores;
- Cuentas;
- Últimos Movimientos.

---

## 22.1 Acciones superiores

Accesos:

- Gasto Operativo;
- Lista de Precios;
- otras acciones administrativas definidas.

---

## 22.2 Cotización USD

Mostrar simultáneamente:

- Cotización Actual;
- última actualización;
- input Nueva Cotización;
- botón Actualizar.

No ocultar el valor actualmente vigente.

---

## 22.3 Ventas

Tabla compacta:

- Fecha;
- Cliente/origen;
- Total;
- Ganancia;
- N.º RTO;
- Ver RTO.

Acceso:

`IR A VENTAS`

---

## 22.4 Resumen Cuentas Clientes

Mostrar todos los clientes.

Clientes con saldo `> 0`:

- primero;
- destacados en rojo.

Clientes sin deuda:

- debajo.

Columnas:

- Cliente;
- Saldo;
- Último Pago;
- Última Compra;
- Cuenta.

---

## 22.5 Deudas Proveedores

Mostrar únicamente proveedores con deuda positiva.

Columnas equivalentes:

- Proveedor;
- Saldo;
- Último Pago;
- Última Compra;
- Cuenta.

---

## 22.6 Cuentas

Mostrar:

- Caja Steffen;
- Caja Mercado Libre;
- Deudas Clientes;
- Deudas Proveedores;
- Neto.

Acción:

- Retiro Caja.

También debe existir acceso al flujo de Liquidación Mercado Libre.

---

## 22.7 Últimos Movimientos

Tabla resumida:

- Código MOV;
- Fecha;
- Tipo;
- Descripción;
- Importe;
- Variación Patrimonial.

Acceso:

`IR A MOVIMIENTOS`

---

# 23. Movimientos — pantalla completa

Default:

`Últimos 90 días`

Debe permitir:

- rango de fechas;
- filtro por tipo;
- búsqueda.

Orden:

más reciente primero.

La existencia de un filtro de 90 días no debe comunicar que movimientos más antiguos fueron eliminados.

---

# 24. Ventas — pantalla completa

Elementos:

- selector de año;
- selector de mes;
- cards;
- tabla histórica.

Cards:

- cantidad de ventas;
- Total Facturado;
- Ganancia Total.

Tabla:

- Fecha;
- Cliente/origen;
- Total;
- Ganancia;
- N.º RTO;
- RTO;
- RTM.

Orden:

más reciente primero.

---

# 25. Cuentas Clientes

## 25.1 Selector de clientes

Los editados recientemente aparecen primero.

Mostrar un conjunto inicial.

Última opción:

`VER MÁS`

---

## 25.2 Nueva Cuenta

Abre Nuevo Cliente.

---

## 25.3 Ficha Cliente

Debe mostrar:

- Código;
- DNI;
- Domicilio;
- Provincia;
- Localidad;
- Transporte;
- Teléfono;
- Dirección Transporte;
- Fecha Registro;
- Categoría;
- Descuento 1;
- Descuento 2;
- Descuento 3.

Lápiz:

- editar ficha.

---

## 25.4 Asiento de cuenta

Formato de movimientos:

- Fecha;
- Venta;
- RTO;
- Pago;
- Total/Saldo.

RTO:

- visualizar.

Pago:

- editar.

---

## 25.5 Acciones

- Registrar Pago;
- PDF Estado de Cuenta.

---

# 26. Estado de Cuenta — ventana

Debe respetar el estilo de las demás ventanas operativas.

Campos:

- Cliente/Proveedor automático;
- Fecha Desde;
- Fecha Hasta.

Acciones:

- Cancelar;
- Generar PDF.

El PDF resultante contiene:

- saldo anterior;
- movimientos del período;
- saldo final.

La estructura y el template MVP del documento están definidos en `PDFS.md`.

---

# 27. Cuentas Proveedores

Mismo patrón visual de Cuentas Clientes.

Agregar sección:

`MATERIAS PRIMAS / COMPONENTES`

Los ítems asociados son editables.

Asiento:

- Compra;
- Pago.

Compra y Pago:

- editables según reglas funcionales.

---

# 28. Lista de Precios

## 28.1 Selector de Lista

Debe poder cambiar entre:

- Salón;
- Público;
- Ecommerce;
- futuras listas activas.

---

## 28.2 Tabla

- Código PRO;
- Producto Final;
- Precio Actual;
- Última Actualización;
- Editar/seleccionar.

---

## 28.3 Acciones

- Crear Lista;
- Renombrar Lista;
- Activar/Desactivar listas adicionales;
- Aumentar toda la lista;
- Aumentar productos seleccionados.

Los precios se muestran sin centavos.

---

# 29. Compra

Ventana con:

- Proveedor;
- Código CMP;
- Fecha;
- Moneda;
- Cotización si USD;
- líneas de compra;
- cantidad;
- MPR/COM;
- posibilidad de seleccionar un ítem existente aunque aún no esté asociado al proveedor;
- posibilidad de crear una nueva MPR/COM desde la Compra;
- PU neto;
- PU ARS + IVA;
- total de línea;
- total general.

Si proveedor USD:

mostrar cotización propuesta y permitir editarla solo para esa CMP.

Acciones:

- Cancelar;
- Registrar Compra;
- Registrar Deuda Proveedor.

La diferencia entre ambas acciones debe quedar visualmente clara.

---

# 30. Pago Cliente

Campos:

- Fecha;
- Cliente;
- Importe.

Selector:

`CLIENTE | SALDO`

Solo deuda positiva.

---

# 31. Pago Proveedor

Campos:

- Fecha;
- Proveedor;
- Importe.

Selector:

`PROVEEDOR | SALDO`

Solo deuda positiva.

---
## 31.1 Nuevo Proveedor

Campos:

- Código automático;
- Fecha de creación;
- Proveedor;
- Vendedor;
- Teléfono;
- Moneda:
  - ARS;
  - USD.

La moneda es obligatoria y luego se hereda automáticamente en Compras.

Después de registrar el Proveedor, Moneda se muestra como dato de solo lectura y no ofrece edición.

---

# 32. Gasto Operativo

Campos:

- Fecha;
- Tipo;
- Descripción;
- Importe.

Tipos iniciales:

- Luz;
- Alquiler;
- Comisión;
- Otro.

Si `Otro`:

la UI debe mostrar Descripción como requerida.

---

# 33. Retiro

Campos:

- Fecha;
- Descripción;
- Importe.

---

# 34. Liquidación Mercado Libre

Ventana administrativa con:

- Fecha;
- Saldo actual Caja Mercado Libre;
- Importe Bruto;
- Importe Neto a Caja Steffen;
- Comisión calculada.

Debe visualizar claramente:

`Bruto = Neto + Comisión`

---

# 35. Reportes

Pantalla compuesta por **cuatro cards**.

No contiene tablas ni inputs.

## 35.1 Layout desktop

Distribución:

`2 columnas × 2 filas`

Orden:

1. Ventas del mes
2. Total facturado
3. Ganancia
4. Pedidos abiertos

Tomar como referencia visual la composición entregada:

- título `REPORTES`;
- línea horizontal Primary;
- cards de igual jerarquía y dimensiones;
- valor numérico/monetario como elemento principal;
- label en mayúsculas.

## 35.2 Cards

### Ventas del mes

Valor:

cantidad de RTO `COMPLETED` del mes corriente.

Label:

`VENTAS DEL MES`

Tratamiento visual MVP:

- Surface;
- borde Primary.

### Total facturado

Valor monetario:

suma de Total Pedido de RTO `COMPLETED` del mes corriente.

Label:

`TOTAL FACTURADO`

Tratamiento visual MVP:

- Surface;
- borde Primary.

### Ganancia

Valor monetario:

Ganancia total asociada a RTO `COMPLETED` del mes corriente.

Label:

`GANANCIA`

No utilizar:

`MARGEN NETO`

Tratamiento visual MVP:

- fondo Green;
- texto claro/contraste alto.

### Pedidos abiertos

Valor:

cantidad total de PED `OPEN`, sin filtro mensual.

Label:

`PEDIDOS ABIERTOS`

Tratamiento visual MVP:

- fondo Secondary;
- texto claro/contraste alto.

## 35.3 Responsive

Desktop/tablet:

- preferir grilla de 2 columnas mientras cada card conserve ancho legible.

Mobile:

- 2 columnas si el viewport útil lo permite;
- pasar a 1 columna si el contenido se comprime o pierde legibilidad.

No cambiar el orden de las cuatro métricas.

---

# 36. PDFs

Documentos del MVP:

- RTO;
- RTM;
- Estado de Cuenta Cliente;
- Estado de Cuenta Proveedor.

Diseño MVP:

- formato A4 vertical;
- estilo administrativo y sobrio;
- fondo blanco;
- texto negro/gris;
- uso moderado del dorado Steffen `#B99D22`;
- logo Steffen en encabezado;
- tablas simples y legibles;
- sin elementos decorativos innecesarios.

RTM debe indicar claramente:

`USO INTERNO`

Los PDFs se generan desde datos históricos/snapshots ya confirmados.

No recalculan información vigente.

Una vez generado un PDF final, se almacena. Las acciones `Ver RTO`, `Ver RTM` y equivalentes abren el archivo almacenado; no vuelven a generarlo en cada visualización.

El contrato de datos, estructura por documento y estrategia de templates se define en `PDFS.md`.

La identidad visual podrá evolucionar posteriormente sin cambiar la lógica ni los contratos de datos.

---

# 37. Textos y nomenclaturas definitivas

Utilizar:

- `Costo-Ganancia`, no “Margen por producto”.
- `Ganancia`, no “Margen” en RTM/Ventas.
- `MFA`, no MVF.
- `MST`, no MVS.
- `MPR`, no MAT.
- `Peso (kg)`.
- `Kg disponibles`.
- `Stock mínimo`.
- `Total Pedido`.
- `Saldo`.
- `Total a Cobrar`.

Las etiquetas antiguas del Figma deben corregirse al implementar.

---

# 38. Contenido automático vs editable

La UI debe distinguir claramente:

### Automático

- códigos;
- costos calculados;
- totales;
- equivalencias ARS;
- kg disponibles;
- saldos;
- precios derivados;
- comisión calculada;
- ganancia.

### Editable

solo campos permitidos por los flujos.

No presentar un valor automático como input editable.

---

# 39. Diseño pendiente

Queda pendiente únicamente el refinamiento visual no funcional de:

- animaciones/transiciones no esenciales;
- detalles estéticos opcionales.

El responsive, mobile y tablet quedan definidos en este documento.

No inventar una identidad visual nueva para los puntos todavía pendientes.
