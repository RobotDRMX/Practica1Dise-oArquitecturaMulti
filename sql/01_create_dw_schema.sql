-- =============================================================================
-- SCRIPT DDL: Esquema Analítico Data Warehouse
-- Proyecto   : Práctica 1 — Extracción de Conocimiento en Bases de Datos
-- Dataset    : E-Commerce Data (Kaggle - carrie1)
-- Estándar   : Kimball Star Schema
-- Motor      : PostgreSQL 14+
-- Esquema    : dw_analytics
-- Fecha      : 2026-05-20
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 0. CREACIÓN DEL ESQUEMA ANALÍTICO
-- -----------------------------------------------------------------------------
CREATE SCHEMA IF NOT EXISTS dw_analytics;

SET search_path TO dw_analytics;

-- =============================================================================
-- 1. TABLAS DE DIMENSIONES
-- =============================================================================

-- -----------------------------------------------------------------------------
-- DIM_FECHA
-- Granularidad: un registro por combinación única de fecha+hora de factura.
-- Permite análisis de series de tiempo, estacionalidad y comparativos YOY.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS dw_analytics.dim_fecha (
    id_fecha_sk         SERIAL          PRIMARY KEY,
    fecha_completa      TIMESTAMP       NOT NULL,
    fecha               DATE            NOT NULL,
    anio                SMALLINT        NOT NULL CHECK (anio BETWEEN 2000 AND 2100),
    trimestre           SMALLINT        NOT NULL CHECK (trimestre BETWEEN 1 AND 4),
    mes                 SMALLINT        NOT NULL CHECK (mes BETWEEN 1 AND 12),
    nombre_mes          VARCHAR(20)     NOT NULL,
    semana_del_anio     SMALLINT        NOT NULL CHECK (semana_del_anio BETWEEN 1 AND 53),
    dia                 SMALLINT        NOT NULL CHECK (dia BETWEEN 1 AND 31),
    nombre_dia_semana   VARCHAR(20)     NOT NULL,
    numero_dia_semana   SMALLINT        NOT NULL CHECK (numero_dia_semana BETWEEN 1 AND 7),
    hora                SMALLINT        NOT NULL CHECK (hora BETWEEN 0 AND 23),
    minuto              SMALLINT        NOT NULL CHECK (minuto BETWEEN 0 AND 59),
    es_fin_de_semana    BOOLEAN         NOT NULL DEFAULT FALSE,

    CONSTRAINT uq_dim_fecha_completa UNIQUE (fecha_completa)
);

COMMENT ON TABLE  dw_analytics.dim_fecha IS 'Dimensión temporal. Cada fila representa un instante de facturación único derivado de InvoiceDate.';
COMMENT ON COLUMN dw_analytics.dim_fecha.id_fecha_sk       IS 'Clave subrogada autogenerada. No corresponde a ningún valor del sistema origen.';
COMMENT ON COLUMN dw_analytics.dim_fecha.fecha_completa    IS 'Timestamp original de InvoiceDate parseado desde el formato MM/DD/YYYY HH:MM del origen.';
COMMENT ON COLUMN dw_analytics.dim_fecha.es_fin_de_semana  IS 'TRUE si numero_dia_semana IN (6, 7) — Sábado o Domingo.';

-- -----------------------------------------------------------------------------
-- DIM_PRODUCTO
-- Granularidad: un registro por StockCode único del sistema origen.
-- Excluye códigos no-producto (POST, M, D, DOT, BANK CHARGES, etc.) mediante
-- el indicador es_codigo_especial.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS dw_analytics.dim_producto (
    id_producto_sk          SERIAL          PRIMARY KEY,
    codigo_producto_origen  VARCHAR(20)     NOT NULL,
    descripcion_producto    VARCHAR(255)    NOT NULL DEFAULT 'SIN DESCRIPCIÓN',
    es_codigo_especial      BOOLEAN         NOT NULL DEFAULT FALSE,

    CONSTRAINT uq_dim_producto_codigo UNIQUE (codigo_producto_origen)
);

COMMENT ON TABLE  dw_analytics.dim_producto IS 'Dimensión de productos. Deriva de los campos StockCode y Description del archivo origen.';
COMMENT ON COLUMN dw_analytics.dim_producto.codigo_producto_origen IS 'Valor original de StockCode. Preservado como atributo descriptivo, no como clave de negocio.';
COMMENT ON COLUMN dw_analytics.dim_producto.descripcion_producto   IS 'Descripción normalizada a MAYÚSCULAS, sin espacios dobles. Derivada de Description.';
COMMENT ON COLUMN dw_analytics.dim_producto.es_codigo_especial     IS 'TRUE para registros como POST, DOT, M, D, BANK CHARGES. Se excluyen del análisis de ventas de producto.';

-- -----------------------------------------------------------------------------
-- DIM_CLIENTE
-- Granularidad: un registro por CustomerID único.
-- Los registros con CustomerID nulo en el origen se consolidan en el
-- registro especial id_cliente_sk = -1 (Cliente Anónimo).
-- Nota: El registro fantasma se inserta manualmente antes de la carga ETL.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS dw_analytics.dim_cliente (
    id_cliente_sk           INTEGER         PRIMARY KEY DEFAULT nextval('dw_analytics.dim_cliente_id_cliente_sk_seq'),
    codigo_cliente_origen   VARCHAR(10),
    es_cliente_anonimo      BOOLEAN         NOT NULL DEFAULT FALSE,

    CONSTRAINT uq_dim_cliente_codigo UNIQUE (codigo_cliente_origen)
);

-- Crear secuencia explícita para poder reservar el valor -1
CREATE SEQUENCE IF NOT EXISTS dw_analytics.dim_cliente_id_cliente_sk_seq START WITH 1 INCREMENT BY 1;

COMMENT ON TABLE  dw_analytics.dim_cliente IS 'Dimensión de clientes. CustomerID nulo en origen se mapea al registro con id_cliente_sk = -1.';
COMMENT ON COLUMN dw_analytics.dim_cliente.codigo_cliente_origen IS 'Valor original de CustomerID convertido a VARCHAR. El tipo float del origen (17850.0) se limpia a "17850".';
COMMENT ON COLUMN dw_analytics.dim_cliente.es_cliente_anonimo    IS 'TRUE cuando el CustomerID del origen era NULL. Permite filtrar transacciones anónimas en reportes.';

-- Registro fantasma para clientes anónimos (CustomerID = NULL en origen)
INSERT INTO dw_analytics.dim_cliente (id_cliente_sk, codigo_cliente_origen, es_cliente_anonimo)
VALUES (-1, 'ANÓNIMO', TRUE)
ON CONFLICT (id_cliente_sk) DO NOTHING;

-- -----------------------------------------------------------------------------
-- DIM_GEOGRAFIA
-- Granularidad: un registro por Country único del sistema origen.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS dw_analytics.dim_geografia (
    id_geografia_sk     SERIAL          PRIMARY KEY,
    pais                VARCHAR(100)    NOT NULL,
    region              VARCHAR(100),

    CONSTRAINT uq_dim_geografia_pais UNIQUE (pais)
);

COMMENT ON TABLE  dw_analytics.dim_geografia IS 'Dimensión geográfica. Deriva del campo Country del archivo origen.';
COMMENT ON COLUMN dw_analytics.dim_geografia.pais    IS 'Nombre del país normalizado. Valor directo de Country con trim() aplicado.';
COMMENT ON COLUMN dw_analytics.dim_geografia.region  IS 'Agrupación regional (Europa, Asia, América, etc.). Calculada en la capa ETL mediante lookup table.';

-- -----------------------------------------------------------------------------
-- DIM_FACTURA
-- Granularidad: un registro por InvoiceNo único del sistema origen.
-- El indicador es_cancelacion identifica facturas con prefijo "C".
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS dw_analytics.dim_factura (
    id_factura_sk               SERIAL          PRIMARY KEY,
    numero_factura_origen       VARCHAR(20)     NOT NULL,
    es_cancelacion              BOOLEAN         NOT NULL DEFAULT FALSE,

    CONSTRAINT uq_dim_factura_numero UNIQUE (numero_factura_origen)
);

COMMENT ON TABLE  dw_analytics.dim_factura IS 'Dimensión de transacciones/facturas. Deriva del campo InvoiceNo.';
COMMENT ON COLUMN dw_analytics.dim_factura.numero_factura_origen IS 'Valor original de InvoiceNo. Puede iniciar con "C" si es cancelación.';
COMMENT ON COLUMN dw_analytics.dim_factura.es_cancelacion        IS 'TRUE cuando InvoiceNo inicia con el carácter "C". Derivado en ETL con: LEFT(InvoiceNo,1) = ''C''.';

-- =============================================================================
-- 2. TABLA DE HECHOS
-- =============================================================================

-- -----------------------------------------------------------------------------
-- FACT_VENTAS
-- Grano: una línea de artículo por factura (InvoiceNo + StockCode).
-- Métricas: cantidad vendida, precio unitario y monto total calculado.
-- El campo es_devolucion replica el indicador de dim_factura para permitir
-- filtrado directo sin JOIN adicional en consultas de alto volumen.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS dw_analytics.fact_ventas (
    id_venta_sk         BIGSERIAL       PRIMARY KEY,
    id_fecha_sk         INTEGER         NOT NULL,
    id_producto_sk      INTEGER         NOT NULL,
    id_cliente_sk       INTEGER         NOT NULL DEFAULT -1,
    id_geografia_sk     INTEGER         NOT NULL,
    id_factura_sk       INTEGER         NOT NULL,

    -- Métricas
    cantidad            INTEGER         NOT NULL,
    precio_unitario     NUMERIC(10, 2)  NOT NULL,
    monto_total         NUMERIC(12, 2)  NOT NULL,

    -- Indicador degenerado (optimización de consulta)
    es_devolucion       BOOLEAN         NOT NULL DEFAULT FALSE,

    -- Restricciones de integridad referencial
    CONSTRAINT fk_fact_ventas_fecha
        FOREIGN KEY (id_fecha_sk)     REFERENCES dw_analytics.dim_fecha      (id_fecha_sk),
    CONSTRAINT fk_fact_ventas_producto
        FOREIGN KEY (id_producto_sk)  REFERENCES dw_analytics.dim_producto   (id_producto_sk),
    CONSTRAINT fk_fact_ventas_cliente
        FOREIGN KEY (id_cliente_sk)   REFERENCES dw_analytics.dim_cliente    (id_cliente_sk),
    CONSTRAINT fk_fact_ventas_geografia
        FOREIGN KEY (id_geografia_sk) REFERENCES dw_analytics.dim_geografia  (id_geografia_sk),
    CONSTRAINT fk_fact_ventas_factura
        FOREIGN KEY (id_factura_sk)   REFERENCES dw_analytics.dim_factura    (id_factura_sk)
);

COMMENT ON TABLE  dw_analytics.fact_ventas IS 'Tabla de hechos central. Grano: una línea de artículo (InvoiceNo + StockCode). Cada fila es un evento de venta o devolución.';
COMMENT ON COLUMN dw_analytics.fact_ventas.id_cliente_sk    IS 'DEFAULT -1 apunta al registro de Cliente Anónimo en dim_cliente cuando CustomerID era NULL en origen.';
COMMENT ON COLUMN dw_analytics.fact_ventas.cantidad         IS 'Valor de Quantity del origen. Negativo indica devolución o cancelación.';
COMMENT ON COLUMN dw_analytics.fact_ventas.precio_unitario  IS 'Valor de UnitPrice en GBP. Limpiado: registros con UnitPrice <= 0 reciben tratamiento especial en ETL.';
COMMENT ON COLUMN dw_analytics.fact_ventas.monto_total      IS 'Calculado en ETL: cantidad * precio_unitario. Puede ser negativo en devoluciones.';
COMMENT ON COLUMN dw_analytics.fact_ventas.es_devolucion    IS 'Desnormalización de dim_factura.es_cancelacion para optimizar filtros frecuentes.';

-- =============================================================================
-- 3. ÍNDICES PARA OPTIMIZACIÓN DE CONSULTAS ANALÍTICAS
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_fact_ventas_fecha_sk     ON dw_analytics.fact_ventas (id_fecha_sk);
CREATE INDEX IF NOT EXISTS idx_fact_ventas_producto_sk  ON dw_analytics.fact_ventas (id_producto_sk);
CREATE INDEX IF NOT EXISTS idx_fact_ventas_cliente_sk   ON dw_analytics.fact_ventas (id_cliente_sk);
CREATE INDEX IF NOT EXISTS idx_fact_ventas_geografia_sk ON dw_analytics.fact_ventas (id_geografia_sk);
CREATE INDEX IF NOT EXISTS idx_fact_ventas_factura_sk   ON dw_analytics.fact_ventas (id_factura_sk);
CREATE INDEX IF NOT EXISTS idx_fact_ventas_devolucion   ON dw_analytics.fact_ventas (es_devolucion);

CREATE INDEX IF NOT EXISTS idx_dim_fecha_fecha          ON dw_analytics.dim_fecha (fecha);
CREATE INDEX IF NOT EXISTS idx_dim_fecha_anio_mes       ON dw_analytics.dim_fecha (anio, mes);
CREATE INDEX IF NOT EXISTS idx_dim_producto_codigo      ON dw_analytics.dim_producto (codigo_producto_origen);
CREATE INDEX IF NOT EXISTS idx_dim_cliente_codigo       ON dw_analytics.dim_cliente (codigo_cliente_origen);
CREATE INDEX IF NOT EXISTS idx_dim_geografia_pais       ON dw_analytics.dim_geografia (pais);

-- =============================================================================
-- FIN DEL SCRIPT
-- =============================================================================
