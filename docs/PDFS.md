# PDFS.md — ERP STEFFEN

## 1. Objetivo

Este documento define los PDFs del MVP y el contrato de datos que utilizarán los renderers.

Principio:

> El ERP calcula y congela la información. El generador de PDF solamente la presenta.

El diseño visual puede cambiar sin cambiar la lógica de negocio.

---

# 2. Arquitectura de generación

## 2.1 MVP

Para el MVP:

`ERP → JSON → Template HTML/CSS → PDF`

Renderer:

`INTERNAL_HTML_PDF`

La generación puede realizarse dentro del backend mediante un renderer HTML/PDF.

---

## 2.2 Evolución futura

La arquitectura debe permitir:

`ERP → JSON → Webhook n8n → Template propio → PDF`

Sin cambiar:

- tablas de negocio;
- cálculos;
- RTO;
- RTM;
- cuentas;
- snapshots.

n8n será un renderer/orquestador, no la fuente de verdad.

---

# 3. Contrato general de documento

Todos los payloads comparten una cabecera:

```json
{
  "schema_version": "1.0",
  "document_type": "RTO",
  "document_id": "uuid",
  "document_code": "RTO0001",
  "business_date": "2026-10-01",
  "generated_at": "2026-10-01T14:30:00-03:00",
  "template_key": "rto-default",
  "template_version": "1.0",
  "issuer": {
    "name": "Steffen Cosmética Capilar",
    "logo_ref": "..."
  },
  "data": {}
}
```

Reglas:

- `schema_version` versiona el contrato JSON.
- `template_version` versiona solo la presentación.
- cambiar colores/logo no exige cambiar `schema_version`.
- cambiar estructura semántica del JSON sí requiere nueva versión de schema.

---

# 4. Reglas visuales del MVP

Formato:

`A4 vertical`

Estilo:

- administrativo;
- limpio;
- profesional;
- fondo blanco;
- tipografía legible;
- uso predominante de negro/gris;
- dorado Steffen `#B99D22` como acento;
- logo en encabezado;
- tablas con bordes/divisores discretos;
- totales destacados.

No utilizar elementos decorativos pesados.

---

# 5. Encabezado común

Zona superior:

- Logo Steffen;
- Nombre de documento;
- Código;
- Fecha.

Opcional según documento:

- cliente/proveedor;
- período.

---

# 6. Pie común

Incluir:

- código del documento;
- fecha/hora de generación;
- numeración de página cuando exista más de una página.

No agregar información económica nueva en el pie.

---

# 7. RTO — Remito Cliente

## 7.1 Título

`REMITO`

Código:

`RTOxxxx`

---

## 7.2 Datos de cabecera

Mostrar:

- Fecha;
- Cliente/origen;
- Nombre destinatario;
- Domicilio;
- Localidad;
- Provincia;
- Teléfono;
- Transporte;
- Dirección de transporte;
- Cantidad de bultos;
- Peso total `(kg)`.

Mostrar solo los campos aplicables.

---

## 7.3 Tabla

Columnas:

| Cantidad | Producto | PU | PT |
|---:|---|---:|---:|

`Cantidad` = AG confirmado.

`PU` = precio unitario snapshot.

`PT` = total de línea.

---

## 7.4 Totales

Mostrar:

- Subtotal;
- cada descuento por separado;
- Total Pedido;
- Saldo anterior;
- Total a Cobrar.

No combinar descuentos sucesivos en un único porcentaje.

---

## 7.5 Payload RTO

```json
{
  "schema_version": "1.0",
  "document_type": "RTO",
  "document_id": "uuid-rto",
  "document_code": "RTO0001",
  "business_date": "2026-10-01",
  "generated_at": "2026-10-01T14:30:00-03:00",
  "template_key": "rto-default",
  "template_version": "1.0",
  "issuer": {
    "name": "Steffen Cosmética Capilar",
    "logo_ref": "steffen-logo"
  },
  "data": {
    "customer_source": "REGISTERED_CUSTOMER",
    "customer_code": "CLI0001",
    "customer_name": "Cliente Ejemplo",
    "address": "Dirección",
    "locality": "Localidad",
    "province": "Provincia",
    "phone": "Teléfono",
    "transport_name": "Transporte",
    "transport_address": "Dirección transporte",
    "package_count": 4,
    "weight_kg": 12.350,
    "items": [
      {
        "quantity": 10,
        "product_code": "PRO0001",
        "product_name": "Producto Final",
        "presentation": "350 cc",
        "unit_price_ars": 6000,
        "line_total_ars": 60000
      }
    ],
    "subtotal_ars": 60000,
    "discounts": [
      {
        "position": 1,
        "percent": 30,
        "amount_ars": 18000
      }
    ],
    "total_order_ars": 42000,
    "prior_balance_ars": 10000,
    "total_to_collect_ars": 52000
  }
}
```

---

# 8. RTM — Remito Margen interno

## 8.1 Título

`REMITO MARGEN`

Debe contener una leyenda visible:

`USO INTERNO`

Código:

`RTMxxxx`

---

## 8.2 Cabecera

Mostrar:

- Fecha;
- RTO asociado;
- Cliente/origen;
- datos básicos de envío;
- Peso;
- Transporte.

---

## 8.3 Tabla

Columnas:

| Cant. | Producto | PU Venta | PT Venta | Costo Unit. | Costo Total |
|---:|---|---:|---:|---:|---:|

---

## 8.4 Totales

Mostrar:

- Total Pedido;
- Costo Productos;
- Transporte;
- Ganancia.

No mostrar Saldo anterior como parte de la Ganancia.

---

## 8.5 Payload RTM

```json
{
  "schema_version": "1.0",
  "document_type": "RTM",
  "document_id": "uuid-rtm",
  "document_code": "RTM0001",
  "business_date": "2026-10-01",
  "generated_at": "2026-10-01T14:35:00-03:00",
  "template_key": "rtm-default",
  "template_version": "1.0",
  "issuer": {
    "name": "Steffen Cosmética Capilar",
    "logo_ref": "steffen-logo"
  },
  "data": {
    "internal_use": true,
    "rto_code": "RTO0001",
    "customer_name": "Cliente Ejemplo",
    "weight_kg": 12.350,
    "items": [
      {
        "quantity": 10,
        "product_code": "PRO0001",
        "product_name": "Producto Final",
        "unit_sale_price_ars": 6000,
        "line_sale_total_ars": 60000,
        "unit_cost_ars": 2500.456789,
        "line_cost_total_ars": 25004.567890
      }
    ],
    "total_order_ars": 42000,
    "products_cost_total_ars": 25004.567890,
    "transport_cost_ars": 3000,
    "gain_ars": 13995.432110
  }
}
```

---

# 9. Estado de Cuenta Cliente

## 9.1 Título

`ESTADO DE CUENTA - CLIENTE`

---

## 9.2 Cabecera

Mostrar:

- Cliente;
- Código CLI;
- Fecha Desde;
- Fecha Hasta.

---

## 9.3 Resumen superior

Mostrar:

`Saldo anterior`

---

## 9.4 Tabla

Columnas:

| Fecha | Tipo | Referencia | Importe | Saldo |
|---|---|---|---:|---:|

Tipos principales:

- Venta;
- Pago.

Referencia:

- RTO;
- MOV/Pago correspondiente.

---

## 9.5 Pie de totales

Mostrar:

`Saldo final`

---

## 9.6 Payload

```json
{
  "schema_version": "1.0",
  "document_type": "CUSTOMER_ACCOUNT_STATEMENT",
  "document_id": "uuid-document",
  "document_code": null,
  "business_date": "2026-10-01",
  "generated_at": "2026-10-01T14:40:00-03:00",
  "template_key": "customer-account-default",
  "template_version": "1.0",
  "issuer": {
    "name": "Steffen Cosmética Capilar",
    "logo_ref": "steffen-logo"
  },
  "data": {
    "customer_code": "CLI0001",
    "customer_name": "Cliente Ejemplo",
    "date_from": "2026-09-01",
    "date_to": "2026-09-30",
    "opening_balance_ars": 100000,
    "movements": [
      {
        "date": "2026-09-05",
        "type": "VENTA",
        "reference": "RTO0042",
        "amount_ars": 50000,
        "balance_ars": 150000
      },
      {
        "date": "2026-09-10",
        "type": "PAGO",
        "reference": "MOV0123",
        "amount_ars": -80000,
        "balance_ars": 70000
      }
    ],
    "closing_balance_ars": 70000
  }
}
```

---

# 10. Estado de Cuenta Proveedor

## 10.1 Título

`ESTADO DE CUENTA - PROVEEDOR`

---

## 10.2 Cabecera

Mostrar:

- Proveedor;
- Código PRV;
- Fecha Desde;
- Fecha Hasta.

---

## 10.3 Resumen superior

Mostrar:

`Saldo anterior`

---

## 10.4 Tabla

Columnas:

| Fecha | Tipo | Referencia | Importe | Saldo |
|---|---|---|---:|---:|

Tipos principales:

- Compra;
- Pago.

Referencia:

- CMP;
- MOV/Pago correspondiente.

---

## 10.5 Pie

Mostrar:

`Saldo final`

---

## 10.6 Payload

```json
{
  "schema_version": "1.0",
  "document_type": "SUPPLIER_ACCOUNT_STATEMENT",
  "document_id": "uuid-document",
  "document_code": null,
  "business_date": "2026-10-01",
  "generated_at": "2026-10-01T14:45:00-03:00",
  "template_key": "supplier-account-default",
  "template_version": "1.0",
  "issuer": {
    "name": "Steffen Cosmética Capilar",
    "logo_ref": "steffen-logo"
  },
  "data": {
    "supplier_code": "PRV0001",
    "supplier_name": "Proveedor Ejemplo",
    "date_from": "2026-09-01",
    "date_to": "2026-09-30",
    "opening_balance_ars": 200000,
    "movements": [
      {
        "date": "2026-09-05",
        "type": "COMPRA",
        "reference": "CMP0034",
        "amount_ars": 150000,
        "balance_ars": 350000
      },
      {
        "date": "2026-09-20",
        "type": "PAGO",
        "reference": "MOV0188",
        "amount_ars": -100000,
        "balance_ars": 250000
      }
    ],
    "closing_balance_ars": 250000
  }
}
```

---

# 11. Signo en estados de cuenta

El JSON puede utilizar signo algebraico:

Cliente:

- Venta → positivo;
- Pago → negativo.

Proveedor:

- Compra → positivo;
- Pago → negativo.

El template puede presentar columnas o etiquetas amigables, pero no debe reinterpretar el saldo.

---

# 12. Paginación

Si una tabla excede una página:

- repetir encabezado de tabla;
- conservar cabecera del documento de forma compacta;
- mostrar número de página;
- no cortar una fila entre páginas si puede evitarse;
- totales finales solo en la última página.

---

# 13. Regeneración

## 13.1 Almacenamiento y visualización

El PDF final generado se guarda en almacenamiento de archivos.

La base de datos conserva:

- los datos históricos del documento;
- el `payload_snapshot`;
- el renderer/template;
- `file_reference`;
- estado de generación.

La acción `Ver` abre el archivo almacenado.

**No se vuelve a renderizar el PDF cada vez que el usuario lo visualiza.**

Ruta recomendada:

`/<document_type>/<document_code-or-id>/<generated_document_id>.pdf`

Esto evita colisiones y permite conservar versiones.

## 13.2 Regeneración explícita

Un PDF histórico puede regenerarse usando sus snapshots.

Al regenerar:

- no usar datos actuales;
- usar el `payload_snapshot` histórico;
- generar un nuevo registro `generated_documents` si cambia template/version;
- conservar siempre la referencia del documento anterior.

Si el intento anterior quedó `FAILED`, un reintento puede actualizar ese intento o crear uno nuevo según implementación, pero nunca debe duplicar RTO/RTM ni movimientos de negocio.

---

## 13.3 Fallos de generación

Un fallo del renderer:

- no elimina datos históricos;
- no revierte RTO, RTM, MOV, MST ni MFA ya confirmados;
- marca el documento como `FAILED`;
- conserva el payload;
- permite reintentar la generación.

Los documentos se consideran disponibles para `Ver` cuando su estado es `READY`.

---

# 14. Seguridad

El renderer recibe únicamente los datos necesarios para el documento.

Si se utiliza n8n a futuro:

- webhook autenticado;
- no exponer credenciales de base de datos en el payload;
- no permitir que n8n recalcule reglas de negocio;
- no enviar secretos;
- registrar resultado/errores de generación.

---

# 15. Costo y desacople

La generación de documentos debe mantenerse independiente del proveedor tecnológico.

El ERP no debe depender de:

- n8n;
- una API específica de PDF;
- un servicio SaaS determinado.

Mientras se respete el contrato JSON, el renderer puede cambiar.

Esto permite pasar de:

`INTERNAL_HTML_PDF`

a:

`N8N_WEBHOOK`

sin reescribir el dominio del ERP.
