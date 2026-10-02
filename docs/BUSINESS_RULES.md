# BUSINESS_RULES.md — ERP STEFFEN

## 1. Regla general

Este documento contiene la lógica funcional confirmada del ERP.

> Toda regla no definida aquí debe considerarse pendiente y no debe inventarse durante la implementación.

---

# 2. PRODUCTOS BASE Y FÓRMULAS

## 2.1 Creación

Crear una nueva fórmula crea simultáneamente un nuevo Producto Base.

Código:

`PBAxxxx`

No existe una entidad visible `FMLxxxx`.

Cada PBA posee:

- una fórmula vigente;
- versiones históricas de fórmula.

---

## 2.2 Componentes de una fórmula

Cada fila de fórmula registra:

- código de Materia Prima;
- Materia Prima;
- cantidad en kg;
- costo por kg;
- costo final.

Cálculo por fila:

`Costo final MP = Cantidad (kg) × Costo/kg`

---

## 2.3 Totales de fórmula

`Total kg granel = suma de cantidades de Materias Primas`

`Costo granel = suma de costos finales de Materias Primas`

`Costo Producto Base por kg = Costo granel / Total kg granel`

El costo por kg del PBA se utiliza posteriormente para calcular el costo del Producto Final.

---

## 2.4 Edición de fórmula

Editar una fórmula:

- conserva el mismo PBA;
- crea una nueva versión;
- la nueva versión pasa a ser vigente;
- recalcula inmediatamente el costo teórico actual;
- no modifica GRA históricos;
- no modifica ENV históricos;
- no modifica ventas históricas.

---

# 3. FABRICACIÓN Y GRANEL

## 3.1 Identidad de la fabricación

La fabricación genera directamente un lote de granel.

Código:

`GRAxxxx`

No existe código FAB independiente.

---

## 3.2 Datos de fabricación

Campos funcionales:

- Código GRA: automático.
- Fecha: actual por defecto, editable.
- Producto Base / Granel: selector de PBA con fórmula registrada.
- Kg fabricados.
- Observaciones.

---

## 3.3 Registro de fabricación

Al registrar una fabricación:

1. se obtiene la versión vigente de la fórmula;
2. se calculan proporcionalmente las cantidades de MPR necesarias para los kg fabricados;
3. se descuentan esas MPR del stock;
4. se crea el GRA;
5. el GRA registra:
   - kg fabricados;
   - kg disponibles iniciales;
6. se congelan fórmula y costos utilizados;
7. se generan movimientos de stock por consumo de MPR;
8. se genera un movimiento de fábrica tipo FABRICACIÓN.

Inicialmente:

`kg disponibles = kg fabricados`

---

## 3.4 Costos históricos del GRA

Un GRA conserva:

- versión de fórmula utilizada;
- cantidades utilizadas;
- costo unitario de MPR utilizado;
- costo total;
- costo por kg.

Cambios posteriores de:

- dólar;
- precio;
- proveedor;
- fórmula;

no recalculan ese GRA.

---

# 4. ENVASADO

## 4.1 Código

Cada operación de envasado utiliza:

`ENVxxxx`

---

## 4.2 Selección

El flujo de selección es:

1. seleccionar Producto Base;
2. listar lotes GRA abiertos de ese PBA;
3. seleccionar un lote;
4. mostrar kg disponibles del lote;
5. seleccionar Producto Final asociado al PBA.

---

## 4.3 Datos

Campos funcionales:

- Producto Base;
- Lote GRA;
- Kg disponibles;
- Producto Final;
- Cantidad de unidades;
- Observaciones;
- Último del lote.

---

## 4.4 Consumo de granel

`Kg consumidos = cantidad de unidades × peso (kg) del PRO`

El peso del PRO es un dato explícito y no se deduce de su presentación comercial.

---

## 4.5 Consumo de componentes

Por cada componente definido en el PRO:

`Consumo componente = cantidad de unidades envasadas × cantidad componente por PRO`

El envasado:

- descuenta componentes;
- descuenta granel;
- aumenta stock del Producto Final.

---

## 4.6 Movimientos generados

El envasado genera:

### MST

- salidas de Componentes;
- entrada de Producto Final.

### MFA

- consumo de granel;
- y, si corresponde, merma o sobrante.

Todos los movimientos deben referenciar el `ENVxxxx` origen.

---

## 4.7 Validaciones de disponibilidad

Si `Último del lote = NO`, el ENV no puede consumir más kg de granel que los disponibles en el GRA seleccionado.

Si los kg requeridos superan los kg disponibles:

- bloquear el registro;
- informar kg requeridos y kg disponibles.

Un sobrante solo puede registrarse al cerrar físicamente un lote mediante `Último del lote = SÍ`.

El ENV real también exige stock suficiente de todos los Componentes necesarios.

Si falta uno o más Componentes:

- bloquear el registro;
- informar por cada componente faltante:
  - componente;
  - cantidad requerida;
  - cantidad disponible.

La planificación de pedidos puede simular faltantes, pero el ENV real no puede registrarse sin existencias suficientes.

## 4.8 Último del lote

Si `Último del lote = NO`:

- el lote continúa abierto;
- el saldo de kg sigue disponible.

Si `Último del lote = SÍ`:

- el lote se considera terminado;
- cualquier diferencia entre disponibilidad teórica y resultado físico se registra;
- la diferencia no bloquea el cierre.

Si quedan menos kg físicos que los esperados:

- registrar MERMA.

Si físicamente se envasó más de lo que indicaba la disponibilidad teórica:

- registrar SOBRANTE.

---

# 5. MOVIMIENTOS DE FÁBRICA

Código:

`MFAxxxx`

Tipos confirmados:

- FABRICACIÓN;
- ENVASADO;
- MERMA;
- SOBRANTE.

Cada MFA debe registrar la operación que lo originó.

Ejemplos de origen:

- GRA;
- ENV.

---

# 6. PRODUCTOS FINALES

## 6.1 Código

`PROxxxx`

---

## 6.2 Datos

Cada PRO contiene:

- Código;
- Fecha de creación;
- Producto Base;
- Presentación comercial;
- Peso (kg);
- Stock inicial;
- Stock mínimo;
- Componentes;
- Costo extra variable;
- Costo total.

---

## 6.3 Presentación vs peso

La presentación es comercial.

Ejemplos:

- 350 cc;
- 1000 ml;
- 250 g.

El peso utilizado para cálculos siempre se guarda en kg.

---

## 6.4 Componentes

Cada componente del PRO define:

- COM;
- cantidad por unidad de producto.

El Producto Base forma parte del costo del PRO, pero no es un COM.

---

## 6.5 Costo teórico de un PRO

`Costo base = Peso (kg) × Costo actual PBA/kg`

`Costo componentes = suma(cantidad componente × costo unitario actual)`

`Subtotal = Costo base + Costo componentes`

`Costo extra variable = Subtotal × 2%`

`Costo total PRO = Subtotal × 1,02`

El 2% es fijo para este MVP.

---

# 7. COSTO-GANANCIA POR PRODUCTO

Esta sección reemplaza el nombre anterior “Margen por producto”.

La tabla debe utilizar exclusivamente la **Lista Salón**, porque se busca analizar los escenarios que más reducen la ganancia. Las listas Público y Ecommerce no intervienen en esta sección.

Columnas:

- Producto Final;
- Costo total;
- Precio de lista Salón;
- Descuento;
- Precio final;
- Markup;
- Ganancia.

El selector de descuento es independiente y sirve únicamente para simulación.

Opciones iniciales:

- 35%;
- 30% + 10% + 5%;
- 40% + 10%;
- 50%.

Los descuentos múltiples se aplican en forma sucesiva/acumulativa.

Fórmulas:

`Precio final = Precio lista Salón - descuentos aplicados`

`Markup = Precio final / Costo total`

Mostrar Markup como factor, por ejemplo:

`1,50x`

`Ganancia = Precio final - Costo total`

La selección de descuento en esta tabla:

- no modifica clientes;
- no modifica listas de precios;
- no genera movimientos;
- es únicamente una simulación de rentabilidad.

No utilizar “margen” como sinónimo de ganancia.

---

# 8. STOCK

## 8.1 Secciones

Tabs:

- Productos;
- Materias Primas;
- Componentes.

---

## 8.2 Stock mínimo

Para:

- PRO;
- MPR;
- COM;

el stock mínimo:

- es obligatorio;
- debe ser numérico;
- debe ser mayor que 0.

No se puede crear un ítem con stock mínimo igual a 0.

---

## 8.3 Orden de prioridad de stock

La prioridad se calcula mediante:

`ratio = stock_actual / stock_mínimo`

Orden:

`ratio ascendente`

Consecuencia:

1. primero aparecen los ítems más críticos;
2. todos los que tienen `ratio < 1` aparecen destacados en rojo;
3. luego aparecen los más cercanos al mínimo;
4. al final aparecen los que poseen mayor excedente proporcional.

Este orden aplica a:

- PRO;
- MPR;
- COM.

---

## 8.4 Unidades de stock

MPR:

- kg.

COM:

- unidades.

PRO:

- unidades.

---

# 9. MOVIMIENTOS DE STOCK

Código:

`MSTxxxx`

Tipos confirmados:

- VENTA;
- COMPRA;
- ENVASADO;
- FABRICACIÓN;
- AJUSTE.

---

## 9.1 Ajustes

Se pueden ajustar manualmente:

- PRO;
- MPR;
- COM.

Un ajuste puede ser:

- positivo;
- negativo.

Debe conservar motivo/observación.

---

# 10. COTIZACIÓN USD

## 10.1 Cotización global

Existe una cotización global USD → ARS.

Administración debe mostrar:

- cotización actual;
- fecha/hora de última actualización;
- input de nueva cotización;
- botón actualizar.

La nueva cotización debe ser:

- obligatoria;
- numérica;
- mayor que 0.

---

## 10.2 Historial

Cada actualización conserva historial de cotizaciones.

---

## 10.3 Efecto

Actualizar la cotización recalcula los equivalentes en pesos de precios expresados en USD.

Esto puede recalcular en cascada:

- costo teórico actual MPR/COM;
- costo teórico PBA;
- costo teórico PRO;
- Markup;
- Ganancia teórica.

No modifica:

- compras históricas;
- GRA históricos;
- ENV históricos;
- RTM históricos;
- ventas históricas.

---

## 10.4 Fecha de actualización de precio

Cambiar únicamente el dólar no modifica la fecha de “última actualización de precio” del proveedor.

Esa fecha cambia cuando cambia el precio comercial del ítem.

---

# 11. MPR/COM Y PROVEEDORES

## 11.1 Múltiples proveedores

Una misma MPR o COM puede estar asociada a múltiples proveedores.

Por lo tanto, datos comerciales como:

- proveedor;
- moneda;
- precio;
- última compra;
- última actualización de precio;

deben poder existir por relación:

`Proveedor ↔ MPR/COM`

Cada proveedor opera en una **única moneda**, definida al crear su ficha:

- ARS;
- USD.

La moneda es obligatoria y **no se modifica posteriormente**.

La moneda se hereda en sus compras y asociaciones de MPR/COM. Una CMP no mezcla monedas.

---

## 11.2 Costo teórico vigente del ítem

El costo teórico actual de una MPR/COM se basa en el precio de la relación `Proveedor ↔ MPR/COM` que tenga la **última actualización de precio más reciente**, independientemente de la fecha de compra.

La actualización de precio puede originarse por:

- creación inicial del ítem con su proveedor;
- edición manual del precio desde la ficha del proveedor;
- registro de una Compra que actualiza ese precio;
- edición válida de una Compra que modifica el precio.

Ejemplo:

- Proveedor A tiene precio actualizado el 25/9;
- hoy se actualiza el precio del mismo ítem en Proveedor B;
- el costo teórico vigente pasa a utilizar el precio de Proveedor B.

La prioridad se determina por el momento real de actualización del precio, no por la `Fecha de compra`.

Por lo tanto, una Compra cargada hoy con fecha comercial anterior puede igualmente convertirse en la nueva fuente de costo si hoy actualiza el precio.

El precio inicial cargado al crear una MPR/COM constituye su primera actualización de precio y se utiliza hasta que exista una actualización posterior.

Si el precio está en USD, su equivalente ARS actual utiliza la cotización global vigente.

### Base oficial de costo

Todos los costos teóricos del ERP se calculan **con IVA incluido**.

Para el MVP, el IVA utilizado es 21%.

Por lo tanto:

`Costo teórico bruto ARS = Precio neto × conversión a ARS × 1,21`

Cuando la moneda es ARS, la conversión a ARS es 1.

Cuando la moneda es USD, la conversión utiliza la cotización global vigente para costos teóricos actuales.

La base con IVA alimenta:

- costo de MPR/COM;
- costo de fórmulas;
- costo por kg de PBA;
- costo teórico de PRO;
- Costo-Ganancia;
- snapshot de costo utilizado por RTM.

---

## 11.3 Proveedor mostrado en Stock

Si una MPR/COM posee múltiples proveedores asociados, la vista principal de Stock muestra como proveedor de referencia al proveedor cuya relación con el ítem tenga la **última actualización de precio más reciente**.

Ese proveedor coincide con la fuente utilizada para el costo teórico vigente del ítem.

Los demás proveedores asociados siguen disponibles en la ficha/detalle del ítem.

---

# 12. NUEVA MATERIA PRIMA / COMPONENTE

Campos:

- Tipo:
  - Materia Prima;
  - Componente.
- Código automático;
- Fecha de creación;
- Nombre;
- INCI;
- Proveedor inicial;
- Moneda automática heredada del proveedor;
- Precio unitario sin IVA;
- Stock inicial;
- Stock mínimo;
- Precio equivalente en pesos con IVA.

Código:

- Materia Prima → `MPRxxxx`
- Componente → `COMxxxx`

Unidad de precio:

- MPR → precio por kg;
- COM → precio por unidad.

## 12.1 NUEVO PROVEEDOR

Al crear un proveedor se registra, como mínimo:

- Código automático `PRVxxxx`;
- Fecha de creación;
- Proveedor;
- Vendedor;
- Teléfono;
- Moneda:
  - ARS;
  - USD.

La moneda es obligatoria y única para ese proveedor.

---
---

# 13. PEDIDOS

## 13.1 Código y estado

Código:

`PEDxxxx`

Estado inicial:

`ABIERTO`

Un Pedido abierto:

- es editable;
- puede borrarse con confirmación;
- no genera movimientos reales.

---

## 13.2 Orígenes de cliente

El selector admite:

### Cliente registrado

- usa ficha `CLIxxxx`;
- utiliza Lista Salón;
- carga descuentos de su ficha.

### MERCADO LIBRE

- no crea CLI;
- utiliza Lista Ecommerce;
- no carga datos de cliente;
- por defecto no aplica descuentos;
- puede aplicarse un descuento manual excepcional.

### CONSUMIDOR FINAL

- no crea CLI;
- utiliza Lista Público;
- despliega campos manuales:
  - nombre;
  - domicilio;
  - localidad;
  - provincia;
  - teléfono;
  - transporte;
- por defecto no aplica descuentos;
- puede aplicarse un descuento manual excepcional.

---

## 13.3 Precios y descuentos congelados

El Pedido congela los precios de la lista vigentes al momento de su creación.

Para clientes registrados también congela los descuentos vigentes en la ficha del cliente al momento de crear el PED.

Cambios posteriores en:

- lista de precios;
- descuentos de la ficha del cliente;

no modifican un PED ya abierto.

El precio unitario no es editable manualmente.

---

## 13.4 Producto sin precio

Si un PRO no tiene precio definido en la lista correspondiente:

- no puede agregarse al pedido.

---

## 13.5 Líneas de pedido

Cada línea contiene:

- cantidad solicitada;
- Producto Final;
- precio unitario;
- precio total;
- AG.

`Precio total = cantidad solicitada × precio unitario`

---

## 13.6 AG

AG representa la cantidad realmente enviada.

Puede ser:

- menor que la cantidad solicitada;
- igual;
- mayor.

Ejemplos:

Pedido 10 / AG 7 → se venden 7.

Pedido 10 / AG 12 → se venden 12.

Si AG es menor, las unidades no enviadas no quedan pendientes ni generan otro registro.

---

## 13.7 Peso del pedido

`Peso total pedido = suma(cantidad solicitada × peso kg PRO)`

---

# 14. DESCUENTOS

## 14.1 Clientes registrados

Los clientes pueden tener tres descuentos.

Se aplican en forma sucesiva/acumulativa.

Ejemplo:

- 30%;
- luego 10%;
- luego 5%.

Cálculo:

`Precio = Subtotal × 0,70 × 0,90 × 0,95`

No se suman directamente los porcentajes.

---

## 14.2 Mercado Libre y Consumidor Final

Pueden tener un único descuento manual excepcional expresado como porcentaje.

Por defecto:

`0%`

---

# 15. TOTALES DE PEDIDO Y REMITO

Tanto Pedido como RTO muestran:

- Subtotal;
- Descuentos;
- Total pedido;
- Saldo anterior;
- Total a cobrar.

`Total pedido = Subtotal - descuentos`

`Total a cobrar = Total pedido + saldo anterior`

El importe propio de la operación es siempre:

`Total pedido`

El saldo anterior nunca forma parte de:

- facturación nueva;
- MOV de venta;
- ganancia;
- venta del período.

---

# 16. CIERRE DE PEDIDO Y RTO

## 16.1 Conversión

Al finalizar:

`PED → RTO`

El PED deja de aparecer en Pedidos abiertos.

Los pedidos cerrados no se muestran como pedidos cerrados en esa pantalla.

---

## 16.2 Cálculo del RTO

El RTO utiliza exclusivamente las cantidades AG.

Recalcula:

- subtotal;
- descuentos;
- Total pedido;
- saldo anterior;
- Total a cobrar.

---

## 16.3 Momento de venta real

Confirmar el RTO materializa la venta.

Desde ese momento el RTO queda **inmutable**, aunque el RTM todavía esté pendiente.

En ese momento:

1. se toman las cantidades AG;
2. se recalculan importes;
3. se descuenta stock PRO;
4. se generan MST;
5. se registra la venta;
6. se actualiza la cuenta/caja correspondiente;
7. se genera MOV;
8. el PED deja de estar abierto;
9. se exige RTM.

---

# 17. RTM

## 17.1 Obligatorio

Toda venta requiere RTM.

No existe venta completamente finalizada sin RTM.

Si el RTO fue confirmado y el RTM no se completó:

- la operación queda en estado interno `RTM pendiente`;
- debe exigirse su finalización;
- el pendiente persiste aunque se cierre la app/navegador;
- no se permite confirmar un nuevo RTO hasta completar el RTM pendiente.

---

## 17.2 Datos

RTM muestra por línea:

- cantidad realmente enviada;
- Producto Final;
- precio unitario de venta;
- precio total de venta;
- costo unitario;
- costo total.

Totales:

- Total pedido;
- Costo productos;
- Transporte;
- Ganancia.

---

## 17.3 Costo utilizado

El RTM utiliza:

> costo teórico actual del PRO en el momento en que se genera el RTM.

Ese costo se congela como snapshot.

Cambios posteriores no modifican el RTM.

---

## 17.4 Ganancia

`Costo productos = suma(cantidad enviada × costo teórico unitario snapshot)`

`Ganancia = Total pedido - Costo productos - Transporte`

Saldo anterior no participa.

---

## 17.5 Transporte

El transporte:

- se ingresa manualmente;
- si es mayor que 0:
  - genera `MOV` tipo TRANSPORTE;
  - disminuye Caja Steffen.

---

# 18. PLANIFICACIÓN DE PEDIDOS

## 18.1 Naturaleza

El Resumen de Pedidos es una herramienta de:

- simulación;
- planificación.

Sus reservas son virtuales.

No modifica stock real.

No genera:

- MST;
- MFA;
- ENV;
- MOV;
- GRA;
- ninguna otra operación real.

---

## 18.2 Productos incluidos

Solo aparecen PRO presentes en al menos un Pedido abierto.

---

## 18.3 Matriz

Filas:

- Productos Finales.

Columnas:

- Pedidos abiertos.

Cada celda indica cantidad solicitada de ese PRO en ese PED.

---

## 18.4 Prioridad de filas

Las filas se pueden mover.

El orden es persistente.

Se procesa de arriba hacia abajo.

Los productos más arriba reservan primero recursos virtuales:

- stock PRO;
- granel;
- componentes.

---

## 18.5 Prioridad de columnas

Las columnas de pedidos se pueden mover.

El orden es persistente.

Se procesan de izquierda a derecha.

Los pedidos ubicados primero reciben prioridad sobre la disponibilidad virtual.

Si una cantidad de un pedido no puede cubrirse completamente:

- su celda se destaca en rojo;
- el faltante del producto también se destaca.

---

## 18.6 Cobertura

Para cada PRO:

`Total requerido = suma de cantidades en Pedidos abiertos`

Primero:

`Pendiente = max(Total requerido - stock PRO disponible, 0)`

Luego se intenta cubrir mediante envasado virtual.

---

## 18.7 Disponibilidad de granel

Para planificación se suman todos los kg disponibles de todos los GRA abiertos del mismo PBA.

No se reserva un lote específico.

---

## 18.8 Capacidad de envasado

Por granel:

`unidades por granel = floor(kg virtuales disponibles / peso kg PRO)`

Por componente:

`unidades por componente = floor(stock virtual componente / cantidad componente por PRO)`

Capacidad máxima:

`unidades posibles = mínimo(granel, componentes)`

Cantidad a planificar:

`unidades a envasar = min(unidades pendientes, unidades posibles)`

---

## 18.9 Recursos compartidos

Cuando un PRO utiliza recursos compartidos:

- PBA;
- COM;

la fila prioritaria los reserva virtualmente.

Las filas inferiores usan únicamente el saldo virtual restante.

---

# 19. COMPRAS A PROVEEDORES

## 19.1 Código

`CMPxxxx`

---

## 19.2 Alcance

Una CMP puede contener múltiples líneas.

Todas las líneas pertenecen al mismo proveedor.

Puede incluir:

- MPR;
- COM.

---

## 19.3 Dos modalidades

### Compra pagada

Efectos:

- aumenta stock;
- genera MST;
- actualiza precios y fechas;
- genera MOV COMPRA;
- disminuye Caja Steffen.

### Compra a deuda

Efectos:

- aumenta stock;
- genera MST;
- actualiza precios y fechas;
- genera MOV COMPRA;
- aumenta Deuda Proveedores;
- no modifica Caja Steffen.

---

## 19.4 Pago parcial

No existe dentro de CMP.

Si posteriormente se realiza un pago parcial:

- se registra como Pago a Proveedor.

---

## 19.5 Importe patrimonial

El importe que afecta:

- Caja;
- Deuda Proveedor;

es siempre el total con IVA incluido.

---

## 19.6 Moneda de la CMP

Cada proveedor opera en una única moneda para sus compras.

Por lo tanto, una CMP completa utiliza la moneda configurada/definida para ese proveedor.

No se admite mezcla de monedas entre líneas de una misma CMP.

## 19.7 Cotización utilizada en una compra USD

Si la compra está expresada en USD:

- por defecto se propone la cotización global vigente;
- la cotización puede editarse manualmente dentro de la CMP antes de registrarla;
- la cotización editada aplica a toda la compra;
- modificarla dentro de la CMP no modifica la cotización global del sistema.

La CMP congela:

- precio en USD;
- cotización utilizada;
- equivalente ARS;
- IVA;
- total final.

Cambios futuros de cotización no modifican la compra histórica.

---

## 19.8 Asociación de ítems y actualización de precio

Dentro de una CMP se puede:

- seleccionar una MPR/COM ya asociada al proveedor;
- seleccionar una MPR/COM existente que todavía no esté asociada a ese proveedor;
- crear una nueva MPR/COM desde la propia Compra.

Si se selecciona una MPR/COM existente sin asociación previa:

- se crea automáticamente la relación `Proveedor ↔ MPR/COM`;
- no se duplica el maestro del ítem.

Si se crea una MPR/COM desde la Compra:

- queda asociada automáticamente al proveedor;
- su stock inicial maestro es 0;
- el ingreso físico se realiza únicamente mediante la CMP.

Registrar una Compra actualiza el precio del ítem para ese proveedor.

También actualiza:

- última compra;
- última actualización de precio.

La relación `Proveedor ↔ MPR/COM` con la actualización de precio más reciente pasa a ser la fuente del costo teórico actual, aunque la Fecha de compra sea anterior.

---

## 19.9 Edición de compra

Una compra puede editarse.

La edición recalcula:

- stock MPR/COM;
- deuda proveedor;
- MOV;
- precio;
- fechas relacionadas.

El sistema debe actualizar el registro original, no crear una compra compensatoria.

---

# 20. CUENTAS PATRIMONIALES

Cuentas iniciales:

- Caja Steffen;
- Caja Mercado Libre;
- Deudas Clientes;
- Deudas Proveedores.

---

## 20.1 Neto

`NETO = Caja Steffen + Caja Mercado Libre + Deudas Clientes - Deudas Proveedores`

Las cuentas pueden ser negativas.

---

# 21. CLIENTES Y SALDOS

## 21.1 Convención

Saldo cliente:

- `> 0` → cliente debe a Steffen;
- `= 0` → cuenta saldada;
- `< 0` → cliente tiene saldo a favor.

---

## 21.2 Pago superior a deuda

Está permitido.

Ejemplo:

Deuda:

`100.000`

Pago:

`120.000`

Nuevo saldo:

`-20.000`

---

## 21.3 Selector de Pago Cliente

Solo aparecen clientes con:

`saldo > 0`

Formato:

`CLIENTE | SALDO`

---

# 22. PROVEEDORES Y SALDOS

Saldo proveedor:

- `> 0` → Steffen debe al proveedor;
- `= 0` → cuenta saldada;
- `< 0` → Steffen tiene saldo a favor.

Pago superior a deuda:

- permitido.

Selector Pago Proveedor:

- solo proveedores con deuda positiva.

---

# 23. PAGOS

## 23.1 Pago Cliente

Efectos:

`Deudas Clientes -= importe`

`Caja Steffen += importe`

Genera:

`MOV PAGO_CLIENTE`

---

## 23.2 Pago Proveedor

Efectos:

`Deudas Proveedores -= importe`

`Caja Steffen -= importe`

Genera:

`MOV PAGO_PROVEEDOR`

---

## 23.3 Edición de pago

Editar un pago:

- modifica el MOV original;
- recalcula Caja;
- recalcula saldo de cuenta;
- no crea movimiento compensatorio.

---

# 24. CAJA NEGATIVA

Se permite Caja Steffen negativa.

No se bloquean por saldo insuficiente:

- retiros;
- pagos a proveedor;
- gastos;
- transporte;
- otras salidas confirmadas.

---

# 25. GASTOS OPERATIVOS

Tipos iniciales:

- LUZ;
- ALQUILER;
- COMISIÓN;
- OTRO.

Si `Tipo = OTRO`:

- Descripción es obligatoria.

Para los demás tipos:

- Descripción es opcional.

Para un Gasto Operativo registrado manualmente:

`Caja Steffen -= importe`

La comisión generada automáticamente al liquidar Mercado Libre es también un `GASTO_OPERATIVO / COMISIÓN`, pero su cuenta de origen es **Caja Mercado Libre**.

Genera:

`MOV GASTO_OPERATIVO`

---

# 26. RETIRO

Datos:

- Fecha;
- Descripción;
- Importe.

Efecto:

`Caja Steffen -= importe`

Genera:

`MOV RETIRO`

---

# 27. MERCADO LIBRE

## 27.1 Venta

Una venta Mercado Libre:

- utiliza Lista Ecommerce;
- no genera Deuda Clientes;
- aumenta Caja Mercado Libre por el Total pedido.

---

## 27.2 Liquidación Mercado Libre

Administración debe permitir liquidar fondos.

Datos funcionales mínimos:

- Fecha;
- Saldo Caja Mercado Libre;
- Importe bruto a liquidar;
- Importe neto que ingresa a Caja Steffen;
- Comisión.

`Comisión = Bruto - Neto`

Reglas:

- `Bruto > 0`;
- `Neto >= 0`;
- `Neto <= Bruto`;
- el Importe bruto no puede superar el saldo disponible en Caja Mercado Libre.

---

## 27.3 Efectos

Ejemplo:

Bruto:

`100.000`

Neto:

`70.000`

Comisión:

`30.000`

Resultado:

`Caja Mercado Libre -= 100.000`

`Caja Steffen += 70.000`

`Gasto operativo comisión = 30.000`

La operación debe quedar trazada mediante MOV relacionados.

---

# 28. CONSUMIDOR FINAL

Una venta Consumidor Final:

- utiliza Lista Público;
- no genera Deuda Clientes;
- ingresa directamente a Caja Steffen;
- saldo anterior = 0.

---

# 29. MOVIMIENTOS PATRIMONIALES

Código:

`MOVxxxx`

Tipos confirmados hasta el momento:

- RETIRO;
- COMPRA;
- PAGO_PROVEEDOR;
- PAGO_CLIENTE;
- TRANSPORTE;
- VENTA;
- GASTO_OPERATIVO;
- transferencia/liquidación Mercado Libre.

La tabla registra:

- Código;
- Fecha;
- Tipo;
- Descripción;
- Importe;
- Variación patrimonial.

---

# 30. HISTORIAL DE MOVIMIENTOS

Los MOV se conservan históricamente.

La pantalla:

- abre por defecto en últimos 90 días;
- no elimina movimientos anteriores;
- ordena más reciente primero;
- permite consultar períodos anteriores.

Filtros definidos:

- rango de fechas;
- tipo;
- búsqueda.

---

# 31. VENTAS

## 31.1 Historial

Las ventas se conservan permanentemente.

Orden:

- más reciente primero.

Filtros:

- año;
- mes.

---

## 31.2 Indicadores

Para el período seleccionado:

- cantidad de ventas;
- total facturado;
- ganancia total.

---

## 31.3 Tabla

Columnas:

- Fecha;
- Cliente/origen;
- Total;
- Ganancia;
- N.º Remito;
- RTO;
- RTM.

`Total = Total pedido del RTO`

`Ganancia = Ganancia snapshot del RTM`

---

# 32. CUENTAS CLIENTES

## 32.1 Navegación

Los clientes editados recientemente aparecen primero.

Existe:

- selección de clientes;
- VER MÁS;
- Nueva Cuenta.

---

## 32.2 Ficha

Datos actuales:

- Código;
- DNI;
- Domicilio;
- Provincia;
- Localidad;
- Teléfono;
- Transporte;
- Dirección transporte;
- Fecha de registro;
- Categoría;
- Descuento 1;
- Descuento 2;
- Descuento 3.

Los datos pueden editarse.

---

## 32.3 Asiento

Registra movimientos de:

- RTO / Venta;
- Pago Cliente.

RTO:

- visualizable;
- no editable desde la cuenta.

Pago:

- editable.

---

## 32.4 PDF estado de cuenta

El usuario selecciona:

- Fecha desde;
- Fecha hasta.

El PDF debe incluir:

1. saldo anterior al inicio del período;
2. movimientos dentro del período;
3. saldo final al cierre del período.

---

# 33. CUENTAS PROVEEDORES

Misma lógica general que Clientes.

Además incluye:

- MPR asociadas;
- COM asociados.

Desde la ficha pueden editarse datos de los ítems asociados, incluyendo:

- nombre;
- INCI;
- precio;
- otros datos del insumo.

El asiento registra:

- Compras;
- Pagos.

Ambos pueden editarse según las reglas definidas.

---

# 34. LISTAS DE PRECIOS

## 34.1 Listas iniciales

Como mínimo existen:

- Lista Salón;
- Lista Público;
- Lista Ecommerce.

---

## 34.2 Administración

Debe permitirse:

- crear nuevas listas;
- renombrar listas;
- activar/desactivar listas adicionales.

Las tres listas con rol de sistema:

- Salón;
- Público;
- Ecommerce;

pueden renombrarse, pero **no pueden desactivarse** en el MVP porque son requeridas por los tres canales de Pedido.

Las listas adicionales sí pueden activarse/desactivarse.

---

## 34.3 Precio por lista

Cada PRO puede tener un precio distinto en cada lista.

Precio de lista:

- expresado en pesos;
- sin centavos.

No se permite agregar a un Pedido un PRO sin precio en la lista correspondiente.

---

## 34.4 Redondeo

Las listas de precios se redondean al peso entero.

Los costos internos conservan precisión decimal.

---

## 34.5 Historial

Actualizar precio conserva:

- lista;
- PRO;
- precio anterior;
- precio nuevo;
- fecha/hora.

---

## 34.6 Actualización masiva

Debe permitirse:

- aumentar toda una lista por porcentaje;
- seleccionar productos específicos y aplicar porcentaje.

Cada precio resultante se redondea al peso.

---

# 35. DASHBOARD

## 35.1 Resumen de pedidos

Utiliza exactamente el mismo motor de planificación de la pantalla Pedidos.

Respeta:

- orden persistente de filas;
- orden persistente de columnas;
- reservas virtuales;
- faltantes.

No genera movimientos.

---

## 35.2 Simular compra

Permite indicar cantidades deseadas de MPR/COM y calcular costo estimado usando precios actuales.

Es exclusivamente simulación.

No genera:

- CMP;
- MST;
- MOV;
- deuda;
- cambios de stock.

---

## 35.3 Granel disponible

Mostrar cada GRA abierto por separado.

Datos:

- Código;
- Fecha;
- Producto Base;
- Kg disponibles.

---

## 35.4 Próximas fabricaciones

Estados:

### URG PARA PEDIDOS

Se aplica cuando existen Pedidos abiertos que contienen Productos Finales asociados a ese PBA.

Tiene prioridad visual sobre POCO STOCK.

### POCO STOCK

Se aplica cuando el stock actual del Producto Final es menor que su stock mínimo.

---

# 36. REPORTES

Reportes forma parte del MVP.

La pantalla contiene exactamente cuatro cards en tiempo real:

## 36.1 Ventas del mes

Cantidad de RTO cerrados/completados cuya `Fecha` pertenece al mes calendario corriente.

Para esta métrica:

`RTO cerrado = remittance.status = COMPLETED`

Un RTO en `RTM_PENDING` todavía no se cuenta como venta cerrada.

No importa cuándo fue creado el PED original.

---

## 36.2 Total facturado

Suma de `Total pedido` de todos los RTO `COMPLETED` cuya Fecha pertenece al mes calendario corriente.

Fórmula:

`Total facturado = Σ remittance.total_order_ars`

No incluye:

- Saldo anterior;
- Total a cobrar;
- Pedidos abiertos;
- RTO pendientes de RTM.

---

## 36.3 Ganancia

Suma de la Ganancia histórica de los RTM asociados a los RTO `COMPLETED` del mes calendario corriente.

Fórmula:

`Ganancia del mes = Σ margin_remittance.gain_ars`

La pertenencia al mes se determina por la **Fecha del RTO/venta**, no por la fecha técnica de generación del RTM.

El nombre visible es:

`GANANCIA`

No utilizar `MARGEN NETO`.

---

## 36.4 Pedidos abiertos

Cantidad total de `PED` con:

`status = OPEN`

No se filtra por mes.

Un PED cuenta mientras continúe abierto, aunque haya sido creado en un mes anterior.

Fórmula:

`Pedidos abiertos = COUNT(orders WHERE status = OPEN)`

---

## 36.5 Fuente de datos

Las cards son consultas derivadas en tiempo real.

No requieren tablas de Reportes ni valores duplicados persistidos.

---

# 37. REGLAS DE ELIMINACIÓN

## 37.1 Pedido abierto

Puede borrarse con confirmación.

Borrarlo:

- no genera movimientos;
- lo elimina de la planificación.

## 37.2 Pedido cerrado

No se mantiene como pedido abierto.

Se representa históricamente mediante RTO.

## 37.3 Entidades históricas e inactivación

PRO, PBA, MPR, COM, CLI y PRV utilizados:

- no se eliminan físicamente;
- pueden quedar inactivos.

`INACTIVO` significa que la entidad no puede utilizarse para **iniciar nuevas operaciones**.

La inactivación no puede impedir cerrar obligaciones u operaciones ya existentes.

Por lo tanto:

- un CLI inactivo con saldo pendiente sigue visible en su cuenta y puede registrar Pagos;
- un PRV inactivo con saldo pendiente sigue visible en su cuenta y puede registrar Pagos;
- un PRO inactivo que ya forma parte de un PED abierto puede completar ese PED/RTO;
- un GRA ya abierto puede terminar de envasarse aunque posteriormente se inactive su PBA o alguno de sus maestros relacionados, siempre que se cumplan las demás validaciones físicas;
- todo histórico continúa visible.

Los inactivos no aparecen para crear nuevas relaciones, nuevos Pedidos, nuevas Compras o nuevas Fabricaciones.

## 37.4 Venta

RTO + RTM finalizados:

- inmutables.

---

# 38. ESTADO DE DEFINICIÓN FUNCIONAL

La auditoría cruzada y la revisión final dejaron cerradas las decisiones funcionales del MVP.

Queda definido que:

- la moneda del Proveedor se fija al crear la ficha y no cambia;
- Reportes contiene exactamente:
  - Ventas del mes;
  - Total facturado;
  - Ganancia;
  - Pedidos abiertos.

No quedan decisiones funcionales pendientes conocidas para iniciar la implementación del MVP.

Si durante desarrollo aparece un caso no contemplado, no debe resolverse por interpretación: se documenta y se consulta antes de modificar la lógica.
