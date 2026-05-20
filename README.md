# Práctica 1: Diseño de Arquitectura Multidimensional y Matriz de Mapeo (Source-to-Target)

**Asignatura:** Extracción de Conocimiento en Bases de Datos  
**Programa Educativo:** Ingeniería en Gestión de Desarrollo de Software  
**Universidad:** Universidad Tecnológica de Querétaro  
**Dataset:** [E-Commerce Data — Kaggle (carrie1)](https://www.kaggle.com/datasets/carrie1/ecommerce-data)

---

## Paso 1: Inspección, Análisis y Detección de Anomalías (Data Understanding)

### 1.1 Descripción General del Dataset

El archivo `data.csv` corresponde a registros transaccionales de una tienda minorista en línea con sede en el Reino Unido, que opera entre diciembre de 2010 y diciembre de 2011. El conjunto de datos contiene aproximadamente **541,909 registros** distribuidos en **8 columnas**, cuyo esquema operacional original es el siguiente:

| Campo         | Tipo Inferido    | Descripción                                      |
|---------------|------------------|--------------------------------------------------|
| `InvoiceNo`   | VARCHAR (texto)  | Número de factura (6 dígitos). Prefijo "C" indica cancelación |
| `StockCode`   | VARCHAR (texto)  | Código interno del producto (5 dígitos alfanumérico) |
| `Description` | VARCHAR (texto)  | Nombre descriptivo del artículo                  |
| `Quantity`    | INTEGER          | Cantidad de unidades por línea de transacción    |
| `InvoiceDate` | VARCHAR / DATETIME | Fecha y hora de emisión de la factura          |
| `UnitPrice`   | FLOAT            | Precio unitario en libras esterlinas (GBP)       |
| `CustomerID`  | FLOAT / VARCHAR  | Identificador del cliente (5 dígitos). Almacenado como número decimal |
| `Country`     | VARCHAR (texto)  | País de origen del pedido                        |

---

### 1.2 Diagnóstico de Calidad por Campo (Data Profiling)

#### 1.2.1 Campo `CustomerID` — Criticidad: **ALTA**

**Problema detectado:** Aproximadamente **135,080 registros (24.93%)** presentan valor nulo (`NaN`). Este campo además está almacenado como tipo `float64` en lugar de `string` o `integer`, lo que produce identificadores como `17850.0` en lugar de `17850`.

**Evidencia cuantitativa:**
- Total de registros: 541,909
- Registros con `CustomerID` nulo: ~135,080
- Porcentaje afectado: ~24.93%

**Impacto analítico sin preprocesamiento:**  
Si se intentara cargar directamente al Data Warehouse, el 25% de los hechos de venta quedarían sin clave foránea hacia `dim_cliente`, violando restricciones de integridad referencial. Cualquier análisis de comportamiento de clientes (segmentación, RFM, LTV) sería estadísticamente inválido al estar basado solo en el 75% de las transacciones. Adicionalmente, el tipo `float` generaría errores silenciosos en joins contra tablas donde `CustomerID` sea `VARCHAR` o `INTEGER`.

---

#### 1.2.2 Campo `Description` — Criticidad: **MEDIA-ALTA**

**Problemas detectados:**
- **~1,454 registros con valor nulo (`NaN`)**.
- **Inconsistencias de mayúsculas/minúsculas:** La mayoría de los registros están en MAYÚSCULAS (`"WHITE HANGING HEART T-LIGHT HOLDER"`), pero existen registros en minúsculas o mixtos generados por ajustes manuales.
- **Caracteres especiales y errores tipográficos:** Descripciones como `"??"`, `"???"`, `"check"`, `"damages"`, `"thrown away"`, `"lost"` que representan ajustes contables, no productos reales.
- **Inconsistencia entre `StockCode` y `Description`:** Un mismo `StockCode` puede tener múltiples descripciones distintas a lo largo del tiempo.

**Impacto analítico sin preprocesamiento:**  
Los registros con `Description` nula o ilegible contaminarían `dim_producto`, introduciendo entradas fantasma con nombres vacíos. Las inconsistencias de texto provocarían cardinalidad inflada: un mismo producto aparecería como múltiples entidades distintas en análisis de texto.

---

#### 1.2.3 Campo `Quantity` — Criticidad: **ALTA**

**Problemas detectados:**
- **~9,288 registros con `Quantity` negativa.** Estos corresponden a devoluciones/cancelaciones, identificables también por el prefijo `C` en `InvoiceNo`.
- Valores de `Quantity` extremadamente bajos o cero en algunos registros de ajuste.

**Impacto analítico sin preprocesamiento:**  
Al calcular métricas como `SUM(Quantity)` o `SUM(monto_total)`, los valores negativos distorsionarían los totales de ventas. Un reporte de "Top Productos Vendidos" devolvería resultados incorrectos al mezclar ventas reales con devoluciones. La métrica `monto_total = Quantity * UnitPrice` produciría valores negativos en `fact_ventas` sin que el analista sepa que representan devoluciones.

---

#### 1.2.4 Campo `UnitPrice` — Criticidad: **MEDIA**

**Problemas detectados:**
- **~2 registros con `UnitPrice` negativo** (ajustes contables).
- **Registros con `UnitPrice = 0.0`** (~2,515 registros) que corresponden a muestras, pruebas o registros de sistemas internos.
- Precios extremadamente altos (outliers) que pueden representar errores de captura.

**Impacto analítico sin preprocesamiento:**  
Los precios en cero inflarían el conteo de transacciones sin aportar valor económico real, distorsionando métricas como ticket promedio (`AVG(monto_total)`). Los precios negativos romperían cualquier cálculo de ingresos.

---

#### 1.2.5 Campo `InvoiceNo` — Criticidad: **MEDIA**

**Problemas detectados:**
- **Registros con prefijo `C`** (ej. `C536379`): indican cancelaciones/devoluciones mezcladas con ventas normales en la misma tabla sin distinción de tipo.
- El campo está almacenado como texto, lo que es correcto, pero no existe una columna booleana explícita que marque si es cancelación.

**Impacto analítico sin preprocesamiento:**  
Sin separar las cancelaciones, los reportes de ventas incluirán transacciones de devolución como si fueran ventas positivas (o negativas al calcular totales), produciendo cifras de negocio incorrectas.

---

#### 1.2.6 Campo `StockCode` — Criticidad: **MEDIA**

**Problemas detectados:**
- **Códigos no estándar** que no representan productos reales:
  - `POST` — Gastos de envío
  - `DOT` — Cargos de entrega
  - `M` — Ajuste manual
  - `D` — Descuento
  - `BANK CHARGES` — Cargos bancarios
  - `AMAZONFEE` — Comisiones de plataforma
  - `CRUK` — Donaciones a caridad
- Estos registros tienen `UnitPrice` variables y no representan líneas de venta de producto.

**Impacto analítico sin preprocesamiento:**  
`dim_producto` contendría "productos" que en realidad son conceptos financieros o logísticos, contaminando cualquier análisis de portafolio, rentabilidad por SKU o análisis ABC de inventario.

---

#### 1.2.7 Campo `InvoiceDate` — Criticidad: **MEDIA**

**Problemas detectados:**
- El campo puede estar almacenado como `string` en lugar de `TIMESTAMP` según el motor de origen.
- Formato variable: `"12/1/2010 8:26"` — mezcla de formato MM/DD/YYYY HH:MM sin ceros iniciales.

**Impacto analítico sin preprocesamiento:**  
Sin parsear correctamente la fecha, no es posible construir `dim_fecha` con los atributos temporales (año, mes, trimestre, día de semana) necesarios para análisis de series de tiempo y estacionalidad.

---

#### 1.2.8 Duplicados Exactos — Criticidad: **ALTA**

**Problema detectado:** Existen aproximadamente **5,268 filas completamente duplicadas** (mismos valores en todos los campos), lo que representa un ~0.97% del dataset. Estos duplicados son resultado de errores en el proceso de extracción del sistema transaccional original.

**Impacto analítico sin preprocesamiento:**  
Los duplicados inflarán todas las métricas de negocio: ventas totales, número de transacciones, unidades vendidas. En modelos de machine learning, los duplicados en conjuntos de entrenamiento producen overfitting.

---

### 1.3 Resumen de Anomalías Detectadas

| # | Campo           | Tipo de Problema                      | Registros Afectados | Criticidad |
|---|-----------------|---------------------------------------|---------------------|------------|
| 1 | `CustomerID`    | Valores nulos (NaN)                   | ~135,080 (24.93%)   | ALTA       |
| 2 | `CustomerID`    | Tipo de dato erróneo (float vs int)   | 541,909 (100%)      | ALTA       |
| 3 | Dataset completo | Filas duplicadas exactas             | ~5,268 (0.97%)      | ALTA       |
| 4 | `Quantity`      | Valores negativos (devoluciones)      | ~9,288 (1.71%)      | ALTA       |
| 5 | `Description`   | Valores nulos (NaN)                   | ~1,454 (0.27%)      | MEDIA-ALTA |
| 6 | `Description`   | Inconsistencias de formato/texto      | Indeterminado       | MEDIA      |
| 7 | `InvoiceNo`     | Cancelaciones no marcadas (prefijo C) | ~9,288              | MEDIA      |
| 8 | `UnitPrice`     | Valores cero o negativos              | ~2,517              | MEDIA      |
| 9 | `StockCode`     | Códigos no-producto (POST, M, D...)   | ~varios             | MEDIA      |
| 10| `InvoiceDate`   | Tipo string / formato inconsistente   | 541,909 (100%)      | MEDIA      |

---

## Paso 2: Definición del Grano y Diseño del Esquema en Estrella

### 2.1 Declaración del Grano

**Grano del análisis:**  
> *"Una línea de artículo dentro de una factura de venta: la combinación única de `InvoiceNo` + `StockCode` en una fecha y hora específica, vendida a un cliente en un país determinado."*

Este es el nivel de granularidad más fino posible en el dataset y permite agregar hacia cualquier nivel superior (por fecha, cliente, producto, país) sin pérdida de información.

### 2.2 Diagrama del Esquema en Estrella

El diagrama se encuentra en: [`/design/diagrama_estrella.png`](./design/diagrama_estrella.png)

### 2.3 Descripción de Tablas

**Tabla de Hechos: `fact_ventas`**
- Cada fila representa una línea de artículo de una factura.
- Contiene las métricas cuantitativas del negocio: cantidad, precio unitario y monto total.
- Se vincula con 5 dimensiones mediante claves subrogadas.

**Dimensiones:**
- `dim_fecha` — atributos temporales para análisis de series de tiempo y estacionalidad.
- `dim_producto` — catálogo de artículos con descripción limpia y estandarizada.
- `dim_cliente` — catálogo de clientes con manejo explícito de clientes anónimos.
- `dim_geografia` — catálogo de países para análisis geográfico.
- `dim_factura` — atributos de la transacción, incluyendo indicador de cancelación.

---

## Paso 3: Matriz de Mapeo Source-to-Target (STM)

La matriz completa se encuentra en: [`/design/matriz_mapeo.xlsx`](./design/matriz_mapeo.xlsx)

---

## Paso 4: Script DDL

El script de creación del esquema analítico se encuentra en: [`/sql/01_create_dw_schema.sql`](./sql/01_create_dw_schema.sql)

---

## Justificación Metodológica del Diseño

El diseño sigue el estándar **Kimball Bus Architecture** con esquema en estrella desnormalizado, elegido por las siguientes razones:

1. **Rendimiento de consultas analíticas:** El modelo desnormalizado elimina JOINs intermedios entre dimensiones jerarquizadas, reduciendo la latencia en herramientas OLAP y BI.
2. **Comprensibilidad para el negocio:** Las dimensiones planas con atributos descriptivos permiten que analistas no técnicos construyan reportes sin necesidad de conocer la estructura operacional original.
3. **Claves subrogadas:** Se evita el uso de las claves operacionales sucias (`CustomerID` como float, `StockCode` no estándar) como llaves primarias, garantizando estabilidad ante cambios en el sistema fuente.
4. **Manejo de valores nulos:** Los clientes anónimos se consolidan en un registro especial `id_cliente_sk = -1` ("Cliente Anónimo") en `dim_cliente`, preservando la integridad referencial sin descartar transacciones válidas.
5. **Separación de cancelaciones:** El indicador `es_cancelacion` en `dim_factura` y el indicador `es_devolucion` en `fact_ventas` permiten filtrar o incluir devoluciones según el contexto del análisis, sin necesidad de transformar los valores negativos de `Quantity`.
