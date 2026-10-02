# AGENT_INSTRUCTIONS.md — ERP STEFFEN

## 1. Rol

Actuás como agente de implementación del ERP Steffen.

Tu tarea es implementar la especificación existente.

No sos responsable de rediseñar el negocio.

---

# 2. Documentos obligatorios

Antes de programar, leer en este orden:

1. `PROJECT.md`
2. `BUSINESS_RULES.md`
3. `DATA_MODEL.md`
4. `FLOWS.md`
5. `DESIGN.md`
6. `COMPONENTS.md`
7. `PDFS.md`
8. `AUDIT.md`
9. `IMPLEMENTATION_PLAN.md`

No comenzar una fase sin haber leído los documentos que la afectan.

---

# 3. Jerarquía

Ante conflicto:

1. `BUSINESS_RULES.md`
2. `DATA_MODEL.md`
3. `FLOWS.md`
4. `DESIGN.md`
5. `COMPONENTS.md`
6. `PDFS.md`
7. `IMPLEMENTATION_PLAN.md`

`PROJECT.md` define contexto y alcance.

`AUDIT.md` documenta la revisión final.

---

# 4. Regla principal

> No inventar reglas de negocio.

Si encontrás:

- una contradicción;
- un cálculo ambiguo;
- una relación no definida;
- una excepción no contemplada;
- una pantalla que contradice negocio;
- una necesidad de cambiar estructura;

no elijas una solución arbitraria.

Hacé lo siguiente:

1. detener únicamente la parte afectada;
2. describir el problema;
3. citar los documentos involucrados;
4. proponer alternativas técnicas si ayuda;
5. solicitar definición.

Podés continuar con tareas independientes no bloqueadas.

---

# 5. Figma y diseño

Figma es referencia visual.

No es fuente de verdad de negocio.

Si Figma contradice los MD:

- implementar los MD;
- adaptar la UI;
- no cambiar la lógica para coincidir con una maqueta vieja.

Nomenclaturas antiguas del Figma deben reemplazarse por las vigentes.

Ejemplos:

- MPR, no MAT;
- MST, no MVS;
- MFA, no MVF;
- Costo-Ganancia, no Margen por producto;
- Ganancia, no Margen neto.

---

# 6. No duplicar lógica

No implementar reglas importantes directamente dentro de componentes UI.

Ejemplo incorrecto:

un componente React calcula y modifica stock.

Ejemplo correcto:

la UI llama a:

`packageProduct(...)`

y el servicio de dominio realiza la operación completa.

---

# 7. Transacciones

Toda operación multi-entidad debe ser atómica.

No realizar pasos críticos como llamadas independientes que puedan dejar el sistema parcialmente actualizado.

Aplicar especialmente a:

- Fabricación;
- Envasado;
- Compra;
- RTO;
- RTM;
- Pagos;
- Liquidación ML;
- Ajustes.

---

# 8. Backend como autoridad

El frontend puede validar para UX.

Pero todas las reglas críticas deben revalidarse en backend dentro de la transacción.

Nunca confiar en:

- stock leído por frontend;
- saldo leído previamente;
- kg disponibles enviados por el cliente;
- totales enviados por frontend;
- precios calculados por frontend.

Los importes definitivos se recalculan en backend.

---

# 9. Dinero

No utilizar `float` para importes.

Utilizar tipos decimales adecuados.

La precisión interna debe conservarse.

Listas de precios:

pesos enteros.

Costos:

precisión interna.

---

# 10. Peso

Toda unidad de peso:

`kg`

Precisión máxima:

3 decimales.

Nunca inferir peso desde presentación.

---

# 11. Históricos

Nunca recalcular retroactivamente:

- GRA;
- ENV;
- CMP;
- RTO;
- RTM;
- MOV;
- MST;
- MFA.

Usar snapshots según los MD.

---

# 12. Stock

Nunca actualizar stock sin respaldo de MST.

`stock_balances` es saldo actual.

`stock_movements` es historial.

No escribir directamente el balance desde una pantalla.

---

# 13. Patrimonio

Nunca modificar Caja/Deudas sin `financial_entries`.

`financial_accounts.current_balance` es saldo actual.

`financial_entries` es historial contable interno del sistema.

---

# 14. Costos

Costo actual MPR/COM:

Proveedor ↔ Ítem con `price_updated_at` más reciente.

No usar Fecha de compra.

Costo oficial:

con IVA incluido.

IVA MVP:

21%.

---

# 15. Proveedores

Moneda:

- obligatoria;
- ARS o USD;
- inmutable luego del alta.

No crear una opción de edición de moneda para PRV existente.

---

# 16. Fórmulas

No existe `FMLxxxx`.

La fórmula pertenece al PBA.

Editar fórmula:

- nueva versión;
- mismo PBA;
- histórico anterior intacto.

---

# 17. Fabricación

Fabricación genera directamente:

`GRAxxxx`

No crear entidad/código FAB visible.

---

# 18. Envasado

Envasado genera:

`ENVxxxx`

Debe validar:

- GRA;
- kg;
- componentes;
- PRO correspondiente.

Último lote:

permite registrar merma/sobrante y cerrar GRA.

---

# 19. Pedidos

PED OPEN:

- editable;
- borrable;
- no mueve stock;
- no mueve patrimonio.

Planificación:

simulación pura.

No persistir reservas.

---

# 20. RTO

Confirmar RTO:

- materializa venta;
- descuenta stock;
- genera patrimonio;
- convierte PED;
- deja RTO inmutable;
- pasa a RTM_PENDING.

No permitir otro RTO mientras exista RTM pendiente.

---

# 21. RTM

RTM obligatorio.

Usa costo teórico vigente en ese momento.

Congelar snapshot.

Después:

RTO → COMPLETED.

---

# 22. Mercado Libre

Venta:

`Caja Mercado Libre += Total Pedido`

Liquidación:

- Caja ML -= bruto
- Caja Steffen += neto
- Comisión = bruto - neto

No permitir bruto mayor al saldo de Caja ML.

---

# 23. PDFs

El PDF no es fuente de verdad.

Flujo MVP:

`datos → payload JSON → HTML/CSS → PDF → storage`

Guardar:

- payload;
- template;
- renderer;
- file_reference;
- status.

`Ver` abre PDF guardado.

No regenerar automáticamente cada vez.

---

# 24. UI

Seguir `DESIGN.md`.

Seguir `COMPONENTS.md`.

No introducir:

- otra paleta;
- otra tipografía;
- otra escala visual;
- otro patrón de navegación;

sin aprobación.

---

# 25. Responsive

Toda funcionalidad debe existir en mobile.

No eliminar módulos para resolver falta de espacio.

Aplicar:

- drawer mobile;
- modales full-screen;
- tablas según estrategia definida;
- PlanningMatrix horizontal/sticky;
- alternativa Ordenar prioridad.

---

# 26. Nombres

Usar exactamente las nomenclaturas vigentes.

Evitar términos antiguos aunque aparezcan en Figma o prototipos viejos.

---

# 27. Tests

No considerar una operación de dominio terminada sin tests.

Priorizar:

- dinero;
- stock;
- costos;
- snapshots;
- rollback;
- descuentos;
- planificación.

Tests deben cubrir happy path y errores.

---

# 28. Migraciones

Toda modificación de esquema:

- mediante migración;
- reproducible;
- versionada.

No realizar cambios manuales no documentados en producción.

---

# 29. Seguridad de datos

No confiar en IDs o importes enviados por frontend.

Verificar permisos y relaciones en backend.

No exponer:

- secretos;
- claves privadas;
- credenciales;
- tokens.

---

# 30. Concurrencia

Aunque el MVP tenga pocos usuarios:

- bloquear saldos relevantes;
- bloquear GRA;
- bloquear cuentas;
- utilizar transacciones.

No diseñar suponiendo siempre un único request.

---

# 31. Inactivos

Inactivo:

no disponible para iniciar operaciones nuevas.

Pero puede seguir apareciendo para:

- históricos;
- saldos pendientes;
- operaciones ya iniciadas.

No bloquear un Pago porque el Cliente/Proveedor fue inactivado.

---

# 32. Reportes

Implementar exactamente:

- Ventas del mes
- Total facturado
- Ganancia
- Pedidos abiertos

No agregar métricas extra por iniciativa propia.

---

# 33. Qué puede decidir el agente

Puede decidir detalles técnicos que no cambien comportamiento funcional.

Ejemplos:

- nombres internos de helpers;
- organización de carpetas;
- librerías auxiliares razonables;
- estrategias de memoización;
- implementación interna de repositorios;
- composición interna de componentes;
- optimizaciones equivalentes.

Siempre respetando los contratos documentados.

---

# 34. Qué NO puede decidir

No decidir sin aprobación:

- nuevas reglas de stock;
- nuevos estados comerciales;
- nuevas monedas;
- nuevos porcentajes;
- nuevos tipos de movimiento;
- nuevas reglas de costo;
- nueva lógica de descuento;
- eliminación de snapshots;
- cambios de unidad;
- cambiar qué afecta Caja;
- cambiar fuentes de Reportes;
- quitar funcionalidades mobile.

---

# 35. Comunicación de problemas

Formato recomendado:

## Bloqueo detectado

**Área:**  
Compra / Stock / etc.

**Documentos:**  
BUSINESS_RULES.md sección X  
DATA_MODEL.md sección Y

**Problema:**  
Descripción concreta.

**Impacto:**  
Qué no puede implementarse correctamente.

**Opciones técnicas:**  
A / B si corresponde.

**Decisión requerida:**  
Pregunta concreta.

No enviar preguntas genéricas si el resto puede resolverse leyendo los MD.

---

# 36. Entregas por fase

Al finalizar cada fase informar:

- qué se implementó;
- migraciones creadas;
- servicios creados;
- tests agregados;
- tests pasando;
- decisiones pendientes;
- archivos principales modificados.

No mezclar múltiples fases grandes en una entrega sin necesidad.

---

# 37. No refactorizar negocio silenciosamente

Si una implementación existente contradice los MD:

- no conservarla por compatibilidad silenciosa;
- no cambiar los MD unilateralmente;
- reportar la diferencia;
- corregir según fuente de verdad aprobada.

---

# 38. Definición de terminado

Una funcionalidad está terminada cuando:

- cumple BUSINESS_RULES;
- respeta DATA_MODEL;
- sigue FLOWS;
- tiene tests;
- maneja errores;
- es transaccional cuando corresponde;
- conserva históricos;
- UI respeta DESIGN/COMPONENTS;
- funciona en mobile cuando aplica.

---

# 39. Primera tarea recomendada

Antes de implementar pantallas:

1. leer todos los MD;
2. generar un mapa de entidades;
3. crear migraciones de FASE 1;
4. crear seeds;
5. validar constraints;
6. ejecutar migraciones desde cero;
7. recién después comenzar servicios de dominio.

---

# 40. Regla final

La prioridad del proyecto es:

**consistencia de datos > velocidad de implementación > estética.**

La estética se puede refinar.

Un histórico roto, un stock inconsistente o una cuenta patrimonial mal calculada no.
