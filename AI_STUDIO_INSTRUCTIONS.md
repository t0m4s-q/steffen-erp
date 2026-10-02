# AI_STUDIO_INSTRUCTIONS.md — ERP STEFFEN

## 1. Propósito

Este repositorio implementa el MVP del ERP de Steffen Cosmética Capilar.

Este archivo define cómo debe trabajar el agente de Google AI Studio / Gemini sobre el proyecto.

La tarea principal es **implementar la especificación existente con máxima fidelidad**.

No rediseñar el negocio.

No simplificar reglas funcionales.

No inventar comportamientos que no estén documentados.

---

# 2. Documentación del proyecto

Toda la especificación vive en `/docs`.

Antes de programar, leer los documentos en este orden:

1. `docs/PROJECT.md`
2. `docs/BUSINESS_RULES.md`
3. `docs/DATA_MODEL.md`
4. `docs/FLOWS.md`
5. `docs/DESIGN.md`
6. `docs/COMPONENTS.md`
7. `docs/PDFS.md`
8. `docs/AUDIT.md`
9. `docs/IMPLEMENTATION_PLAN.md`
10. `docs/AGENT_INSTRUCTIONS.md`

No asumir que el contenido de estos archivos ya fue leído en una sesión anterior.

Antes de cada fase importante, releer los documentos que la afectan.

---

# 3. Jerarquía de autoridad

Si dos documentos parecen contradecirse, utilizar este orden:

1. `BUSINESS_RULES.md`
2. `DATA_MODEL.md`
3. `FLOWS.md`
4. `DESIGN.md`
5. `COMPONENTS.md`
6. `PDFS.md`
7. `IMPLEMENTATION_PLAN.md`

`PROJECT.md` define contexto, alcance y vocabulario general.

`AUDIT.md` documenta el estado final de revisión de la especificación.

`AGENT_INSTRUCTIONS.md` amplía las reglas de trabajo del agente.

---

# 4. Regla principal

> NO INVENTAR REGLAS DE NEGOCIO.

Si aparece:

- una contradicción;
- una regla faltante;
- un cálculo ambiguo;
- una relación no definida;
- una excepción no contemplada;
- una diferencia entre Figma y los MD;
- una decisión funcional necesaria que no esté documentada;

no elegir una solución arbitraria.

Proceder así:

1. detener únicamente la parte afectada;
2. describir el problema con precisión;
3. indicar qué documentos/secciones entran en conflicto;
4. explicar el impacto técnico;
5. proponer alternativas solo si ayuda;
6. pedir definición antes de implementar esa decisión.

Se puede continuar con tareas independientes que no estén bloqueadas.

---

# 5. Regla sobre los documentos

Los archivos dentro de `/docs` son especificación.

No modificarlos salvo pedido explícito del usuario.

Si durante la implementación se detecta una contradicción:

- no corregir los MD silenciosamente;
- no adaptar el negocio para facilitar el código;
- informar primero.

---

# 6. Figma y referencias visuales

Figma es referencia visual.

No es fuente de verdad funcional.

Si el Figma contradice los MD:

- respetar los MD;
- adaptar la interfaz;
- no modificar la lógica para copiar una maqueta antigua.

Nomenclaturas antiguas deben reemplazarse por las vigentes.

Ejemplos:

- `MPR`, no `MAT`
- `MST`, no `MVS`
- `MFA`, no `MVF`
- `Costo-Ganancia`, no `Margen por producto`
- `Ganancia`, no `Margen neto`

---

# 7. Forma de trabajo

Seguir `docs/IMPLEMENTATION_PLAN.md` por fases.

No implementar todo el ERP en una sola iteración.

Orden general:

1. preparación técnica;
2. base de datos;
3. migraciones;
4. seeds;
5. servicios de dominio;
6. tests;
7. UI funcional;
8. PDFs;
9. Dashboard;
10. Reportes;
11. responsive y pulido;
12. auditoría final.

No avanzar a una fase grande posterior sin aprobación.

Al finalizar cada fase, informar:

- qué se implementó;
- migraciones creadas;
- tablas creadas;
- servicios creados;
- tests agregados;
- tests ejecutados;
- tests pasando/fallando;
- archivos principales modificados;
- bloqueos encontrados;
- diferencias respecto de los MD.

---

# 8. Base de datos

Toda modificación de esquema debe hacerse mediante migraciones reproducibles y versionadas.

No realizar cambios manuales no documentados.

Usar UUID como PK interna.

Los códigos visibles no son PK.

Ejemplos:

- `MPR0001`
- `COM0001`
- `PBA0001`
- `PRO0001`
- `GRA0001`
- `ENV0001`
- `PED0001`
- `CMP0001`
- `RTO0001`
- `RTM0001`
- `MOV0001`

Los códigos visibles deben generarse con `code_sequences`.

No usar:

`MAX + 1`

---

# 9. Transacciones

Toda operación que modifique varias entidades debe ser atómica.

Aplicar especialmente a:

- Fabricación;
- Envasado;
- Compra;
- RTO;
- RTM;
- Pago Cliente;
- Pago Proveedor;
- Ajuste de Stock;
- Gasto Operativo;
- Retiro;
- Liquidación Mercado Libre.

Si una parte falla:

- rollback completo;
- no dejar stock parcial;
- no dejar patrimonio parcial;
- no dejar históricos incompletos.

---

# 10. Backend como autoridad

El frontend puede realizar validaciones para UX.

Pero todas las reglas críticas deben validarse nuevamente en backend dentro de la transacción.

Nunca confiar en valores enviados por el frontend para:

- stock disponible;
- kg disponibles;
- saldos;
- precios;
- costos;
- descuentos;
- totales;
- ganancia;
- cotizaciones;
- cobertura de Pedidos.

El backend debe recalcular los valores definitivos.

---

# 11. Dinero y precisión

No utilizar `float` para importes monetarios.

Utilizar tipos decimales adecuados.

Reglas:

- costos internos conservan precisión;
- precios de listas no tienen centavos;
- precios de listas redondean al peso;
- IVA MVP = 21%;
- costos teóricos incluyen IVA.

---

# 12. Peso y unidades

Toda unidad de peso se maneja internamente en:

`kg`

Precisión máxima:

`3 decimales`

Ejemplos:

- `0.001 kg`
- `0.999 kg`
- `1.000 kg`

Nunca inferir peso desde la presentación comercial.

La presentación:

- `350 cc`
- `1000 ml`
- `250 g`

es un dato comercial, no una fuente de cálculo de peso.

Unidades:

- MPR → kg;
- COM → unidades enteras;
- PRO → unidades enteras.

---

# 13. Stock

Nunca modificar stock sin respaldo de `MST`.

`stock_balances` representa el saldo actual.

`stock_movements` representa el historial.

Stock mínimo:

- obligatorio;
- mayor que 0.

El orden visual de Stock usa:

`stock_actual / stock_minimo ASC`

Los elementos por debajo del mínimo aparecen primero.

---

# 14. Patrimonio

Nunca modificar Caja o cuentas corrientes sin `financial_entries`.

`financial_accounts.current_balance` representa el saldo actual.

`financial_entries` representa el historial.

Caja Steffen puede quedar negativa.

Caja Mercado Libre no puede liquidarse por encima de su saldo disponible.

---

# 15. Costos

Costo teórico actual de MPR/COM:

usar la relación:

`Proveedor ↔ Ítem`

que tenga el `price_updated_at` más reciente.

No usar la Fecha de Compra para decidir el costo vigente.

Todos los costos teóricos usan IVA incluido.

Costo Extra Variable del PRO:

`2%`

No es editable en el MVP.

---

# 16. Proveedores

Cada Proveedor utiliza una única moneda:

- ARS;
- USD.

La moneda:

- es obligatoria;
- se define al crear la ficha;
- es inmutable posteriormente.

Las Compras heredan esa moneda.

No permitir mezclar monedas dentro de una misma CMP.

---

# 17. Fórmulas y PBA

No existe código `FML`.

La fórmula pertenece al PBA.

Crear nueva Fórmula:

crea un nuevo PBA.

Editar Fórmula:

- mantiene el mismo PBA;
- crea nueva versión;
- conserva versiones históricas.

Una misma MPR no debe repetirse en varias filas de una misma versión de fórmula.

---

# 18. Fabricación

Fabricación crea directamente un:

`GRAxxxx`

No crear código visible `FAB`.

Fabricar debe:

- obtener Fórmula vigente;
- escalar cantidades;
- validar MPR;
- consumir MPR;
- crear GRA;
- congelar fórmula/costos;
- generar MST;
- generar MFA.

Varias GRA del mismo PBA pueden permanecer abiertas simultáneamente.

---

# 19. Envasado

Envasado genera:

`ENVxxxx`

Debe validar:

- PBA;
- GRA abierta;
- kg disponibles;
- PRO correspondiente;
- Componentes suficientes.

Cálculo:

`kg consumidos = unidades × peso PRO`

Si no es último lote:

no puede consumir más kg que los disponibles.

Si es último lote:

puede cerrar el lote aunque exista diferencia matemática.

La diferencia se registra como:

- MERMA;
- SOBRANTE.

Al cerrar:

`kg_available = 0`

---

# 20. Compras

Una CMP puede contener varias líneas del mismo Proveedor.

Modos:

## Pagada

- Stock ↑
- MST
- MOV COMPRA
- Caja Steffen ↓

## A deuda

- Stock ↑
- MST
- MOV COMPRA
- Deuda Proveedor ↑
- Caja Steffen no cambia

No existe pago parcial dentro de la CMP.

Los parciales se registran posteriormente como Pago Proveedor.

Una CMP puede:

- usar ítem ya asociado;
- asociar ítem existente al Proveedor;
- crear nueva MPR/COM y asociarla.

El total patrimonial incluye IVA.

---

# 21. Pedidos

PED abierto:

- editable;
- borrable/cancelable;
- no modifica stock;
- no modifica patrimonio.

El Pedido congela:

- Lista;
- descuentos;
- precios snapshot.

Cliente registrado:

usa Lista Salón.

Mercado Libre:

usa Lista Ecommerce.

Consumidor Final:

usa Lista Público.

La planificación de Pedidos es simulación pura.

No persistir reservas virtuales.

---

# 22. Planificación

La cobertura utiliza:

1. Stock PRO existente;
2. Envasado virtual posible desde GRA + COM.

La prioridad se aplica:

- filas → Productos;
- columnas → Pedidos.

La planificación no genera:

- MST;
- MFA;
- ENV;
- MOV.

---

# 23. RTO

Confirmar RTO:

- materializa la venta;
- usa AG;
- recalcula totales reales;
- descuenta PRO;
- genera MST;
- genera MOV;
- afecta Caja/Cuenta;
- convierte el PED;
- congela snapshots;
- deja el RTO inmutable;
- pasa a `RTM_PENDING`.

Todas las líneas deben tener AG definido.

Debe existir al menos una línea con:

`AG > 0`

No permitir confirmar otro RTO mientras exista un RTM pendiente.

---

# 24. RTM

RTM es obligatorio.

Usa el costo teórico vigente del PRO en el momento de generarlo.

El costo queda congelado.

Ganancia:

`Total Pedido - Costo Productos - Transporte`

Si Transporte > 0:

- genera MOV Transporte;
- Caja Steffen ↓

Después del RTM:

`RTO → COMPLETED`

---

# 25. Mercado Libre

Venta Mercado Libre:

`Caja Mercado Libre += Total Pedido`

Liquidación:

- Caja ML -= bruto
- Caja Steffen += neto
- Comisión = bruto - neto
- Comisión = Gasto Operativo

No permitir:

`bruto > saldo Caja Mercado Libre`

---

# 26. Listas de precios

Listas de sistema:

- Salón;
- Público;
- Ecommerce.

Pueden renombrarse.

No pueden desactivarse en el MVP.

Las listas adicionales:

- pueden crearse;
- pueden activarse/desactivarse.

Una lista nueva nace sin precios cargados.

---

# 27. Reportes

Implementar exactamente cuatro cards:

## VENTAS DEL MES

Cantidad de RTO `COMPLETED` del mes calendario corriente.

## TOTAL FACTURADO

Suma de `Total Pedido` de esos RTO.

## GANANCIA

Suma de Ganancia de sus RTM.

## PEDIDOS ABIERTOS

Cantidad total de PED `OPEN`.

No lleva filtro mensual.

No agregar métricas adicionales por iniciativa propia.

---

# 28. PDFs

El PDF no es fuente de verdad.

Flujo MVP:

`datos → JSON → HTML/CSS → PDF → Storage`

Guardar:

- payload snapshot;
- renderer;
- template;
- versión;
- estado;
- file_reference.

Estados:

- `PENDING`
- `READY`
- `FAILED`

`Ver PDF` abre el archivo almacenado.

No regenerar el PDF automáticamente cada vez que se visualiza.

Un fallo del renderer:

- no revierte la venta;
- no revierte RTO;
- no revierte RTM;
- no duplica movimientos.

La arquitectura debe permitir en el futuro:

`ERP → JSON → n8n → template → PDF`

sin modificar el dominio.

---

# 29. Históricos

Nunca recalcular retroactivamente:

- GRA;
- ENV;
- CMP;
- RTO;
- RTM;
- MOV;
- MST;
- MFA.

Usar snapshots según la especificación.

RTO/RTM completados son inmutables.

---

# 30. Entidades inactivas

Inactivo significa:

no puede iniciar nuevas operaciones.

Pero sigue disponible cuando sea necesario para:

- históricos;
- pagos pendientes;
- terminar operaciones existentes.

Ejemplos:

- Cliente inactivo con deuda → puede pagar;
- Proveedor inactivo con deuda → puede recibir Pago;
- PRO inactivo ya incluido en PED → puede completar ese PED;
- GRA abierta → puede terminar de envasarse.

---

# 31. UI

Seguir:

- `docs/DESIGN.md`
- `docs/COMPONENTS.md`

No introducir sin aprobación:

- otra paleta;
- otra tipografía;
- otra navegación;
- otra nomenclatura;
- otro patrón general de interacción.

---

# 32. Responsive

Toda funcionalidad debe existir en mobile.

No resolver falta de espacio eliminando funciones.

Aplicar las estrategias documentadas para:

- menú/drawer;
- formularios full-screen;
- tablas;
- PlanningMatrix;
- sticky columns;
- sticky headers;
- prioridad mediante touch.

---

# 33. Nomenclaturas vigentes

Usar exactamente:

- MPR, no MAT
- MST, no MVS
- MFA, no MVF
- Costo-Ganancia, no Margen por producto
- Ganancia, no Margen neto
- Peso (kg)
- Kg disponibles
- Stock mínimo
- Total Pedido
- Saldo anterior
- Total a Cobrar

---

# 34. Tests

No considerar terminada una operación de dominio sin tests.

Priorizar:

- stock;
- patrimonio;
- costos;
- descuentos;
- snapshots;
- rollback;
- planificación;
- RTO/RTM;
- Mercado Libre.

Cubrir:

- happy path;
- validaciones;
- errores;
- rollback;
- casos límite relevantes.

---

# 35. Concurrencia

Aunque el MVP tenga pocos usuarios:

- usar transacciones;
- bloquear saldos relevantes;
- bloquear GRA cuando corresponda;
- bloquear cuentas financieras afectadas.

No diseñar suponiendo que siempre existe un único request.

---

# 36. Dependencias

Antes de agregar una nueva dependencia:

1. revisar el stack existente;
2. comprobar si ya existe una solución;
3. evitar librerías innecesarias;
4. mantener el proyecto simple;
5. no cambiar arquitectura por comodidad.

---

# 37. Decisiones que puede tomar el agente

Puede decidir detalles técnicos que no cambien comportamiento funcional.

Ejemplos:

- organización interna de carpetas;
- helpers;
- repositorios;
- nombres internos razonables;
- composición interna de componentes;
- estrategias de caching no funcionales;
- librerías auxiliares razonables;
- optimizaciones equivalentes.

---

# 38. Decisiones que NO puede tomar

No modificar sin aprobación:

- reglas de Stock;
- reglas patrimoniales;
- porcentajes;
- IVA;
- tipos de movimiento;
- estados comerciales;
- monedas;
- lógica de descuentos;
- reglas de costo;
- unidades;
- snapshots;
- lógica RTO/RTM;
- fuentes de Reportes;
- métricas de Reportes;
- funcionalidad mobile;
- reglas de Mercado Libre.

---

# 39. Manejo de bloqueos

Si aparece un bloqueo, responder con:

## BLOQUEO DETECTADO

**Área:**  
Nombre de la funcionalidad.

**Documentos involucrados:**  
Archivo + sección.

**Problema:**  
Descripción concreta.

**Impacto:**  
Qué parte no puede implementarse correctamente.

**Alternativas técnicas:**  
Solo si aportan claridad.

**Decisión requerida:**  
Pregunta concreta.

No hacer preguntas genéricas si la respuesta ya está documentada.

---

# 40. Primera ejecución en Google AI Studio

Antes de escribir o modificar código:

1. leer este archivo completo;
2. leer los 10 documentos de `/docs`;
3. resumir la arquitectura;
4. enumerar entidades y relaciones principales;
5. explicar las operaciones transaccionales críticas;
6. revisar contradicciones;
7. revisar `IMPLEMENTATION_PLAN.md`;
8. explicar cómo ejecutarías Fases 0, 1 y 2;
9. informar bloqueos;
10. detenerte y esperar aprobación.

NO escribir código durante esta primera revisión.

---

# 41. Implementación por fases

Después de recibir aprobación:

seguir `IMPLEMENTATION_PLAN.md`.

No interpretar:

`aprobado`

como autorización para implementar todo el ERP.

La aprobación aplica únicamente a la fase solicitada.

---

# 42. Seguridad

No exponer:

- secrets;
- API keys;
- service role keys;
- tokens;
- credenciales;
- passwords.

Usar variables de entorno.

No hardcodear secretos.

---

# 43. Definición de terminado

Una funcionalidad está terminada cuando:

- cumple BUSINESS_RULES;
- respeta DATA_MODEL;
- sigue FLOWS;
- usa transacciones cuando corresponde;
- conserva históricos;
- tiene validaciones backend;
- tiene tests;
- UI respeta DESIGN/COMPONENTS;
- funciona en responsive cuando aplica;
- no introduce reglas inventadas.

---

# 44. Regla final

Prioridad del proyecto:

**consistencia de datos > corrección funcional > velocidad de implementación > estética**

La estética puede refinarse después.

Un stock incorrecto, un histórico roto, un costo mal calculado o un patrimonio inconsistente no.
