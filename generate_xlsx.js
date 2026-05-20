const ExcelJS = require('exceljs');

const workbook = new ExcelJS.Workbook();
workbook.creator = 'Práctica 1 — UTEQ';
workbook.created = new Date();

const ws = workbook.addWorksheet('Matriz STM', {
  views: [{ state: 'frozen', ySplit: 2 }],
  pageSetup: { paperSize: 9, orientation: 'landscape' }
});

// Column widths
ws.columns = [
  { key: 'tabla_origen',   width: 22 },
  { key: 'campo_origen',   width: 28 },
  { key: 'tabla_destino',  width: 22 },
  { key: 'campo_destino',  width: 30 },
  { key: 'tipo_dato',      width: 20 },
  { key: 'regla_etl',      width: 70 },
];

// Title row (merged)
ws.mergeCells('A1:F1');
const titleCell = ws.getCell('A1');
titleCell.value = 'Matriz de Mapeo Source-to-Target (STM) — Proyecto E-Commerce Kaggle-Market';
titleCell.font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } };
titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F3460' } };
titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
ws.getRow(1).height = 30;

// Header row
const headers = ['Tabla Origen', 'Campo Origen', 'Tabla Destino', 'Campo Destino', 'Tipo Dato Destino', 'Regla de Transformación / Limpieza (ETL)'];
const headerRow = ws.addRow(headers);
headerRow.eachCell(cell => {
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A3C5E' } };
  cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
  cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  cell.border = { bottom: { style: 'medium', color: { argb: 'FF4A90D9' } } };
});
ws.getRow(2).height = 28;

// Data sections
const sections = [
  {
    label: 'DIMENSIÓN: dim_fecha',
    color: 'FF1E3A8A',
    rows: [
      ['raw_ecommerce', 'InvoiceDate', 'dim_fecha', 'id_fecha_sk', 'SERIAL (INT)', 'Clave subrogada autogenerada por secuencia. Guardar referencia del timestamp original.'],
      ['raw_ecommerce', 'InvoiceDate', 'dim_fecha', 'fecha_completa', 'TIMESTAMP', "Parsear string 'MM/DD/YYYY HH:MM' con TO_TIMESTAMP(InvoiceDate, 'MM/DD/YYYY HH24:MI')."],
      ['raw_ecommerce', 'InvoiceDate', 'dim_fecha', 'fecha', 'DATE', 'Extraer parte DATE: fecha_completa::DATE.'],
      ['raw_ecommerce', 'InvoiceDate', 'dim_fecha', 'anio', 'SMALLINT', "EXTRACT(YEAR FROM fecha_completa)."],
      ['raw_ecommerce', 'InvoiceDate', 'dim_fecha', 'trimestre', 'SMALLINT', "EXTRACT(QUARTER FROM fecha_completa)."],
      ['raw_ecommerce', 'InvoiceDate', 'dim_fecha', 'mes', 'SMALLINT', "EXTRACT(MONTH FROM fecha_completa)."],
      ['raw_ecommerce', 'InvoiceDate', 'dim_fecha', 'nombre_mes', 'VARCHAR(20)', "TO_CHAR(fecha_completa, 'TMMonth') o lookup table de meses en español."],
      ['raw_ecommerce', 'InvoiceDate', 'dim_fecha', 'semana_del_anio', 'SMALLINT', "EXTRACT(WEEK FROM fecha_completa) — semana ISO."],
      ['raw_ecommerce', 'InvoiceDate', 'dim_fecha', 'dia', 'SMALLINT', "EXTRACT(DAY FROM fecha_completa)."],
      ['raw_ecommerce', 'InvoiceDate', 'dim_fecha', 'nombre_dia_semana', 'VARCHAR(20)', "TO_CHAR(fecha_completa, 'TMDay')."],
      ['raw_ecommerce', 'InvoiceDate', 'dim_fecha', 'numero_dia_semana', 'SMALLINT', "EXTRACT(ISODOW FROM fecha_completa). 1=Lunes, 7=Domingo."],
      ['raw_ecommerce', 'InvoiceDate', 'dim_fecha', 'hora', 'SMALLINT', "EXTRACT(HOUR FROM fecha_completa)."],
      ['raw_ecommerce', 'InvoiceDate', 'dim_fecha', 'minuto', 'SMALLINT', "EXTRACT(MINUTE FROM fecha_completa)."],
      ['raw_ecommerce', 'InvoiceDate', 'dim_fecha', 'es_fin_de_semana', 'BOOLEAN', "TRUE si numero_dia_semana IN (6, 7)."],
    ]
  },
  {
    label: 'DIMENSIÓN: dim_producto',
    color: 'FF14532D',
    rows: [
      ['raw_ecommerce', 'StockCode', 'dim_producto', 'id_producto_sk', 'SERIAL (INT)', 'Clave subrogada autogenerada por secuencia.'],
      ['raw_ecommerce', 'StockCode', 'dim_producto', 'codigo_producto_origen', 'VARCHAR(20)', "TRIM(UPPER(StockCode)). Preservar valor original limpio."],
      ['raw_ecommerce', 'Description', 'dim_producto', 'descripcion_producto', 'VARCHAR(255)', "TRIM(UPPER(REGEXP_REPLACE(Description, '\\s+', ' ', 'g'))). Si NULL → 'SIN DESCRIPCIÓN'."],
      ['raw_ecommerce', 'StockCode', 'dim_producto', 'es_codigo_especial', 'BOOLEAN', "TRUE si StockCode IN ('POST','DOT','M','D','BANK CHARGES','AMAZONFEE','CRUK'). FALSE en otro caso."],
    ]
  },
  {
    label: 'DIMENSIÓN: dim_cliente',
    color: 'FF1E3A5F',
    rows: [
      ['raw_ecommerce', 'CustomerID', 'dim_cliente', 'id_cliente_sk', 'INTEGER (PK)', "Clave subrogada. Si CustomerID IS NULL → usar el registro fantasma con id_cliente_sk = -1."],
      ['raw_ecommerce', 'CustomerID', 'dim_cliente', 'codigo_cliente_origen', 'VARCHAR(10)', "Convertir float a int a string: CAST(CustomerID::INTEGER AS VARCHAR). Si NULL → 'ANÓNIMO'."],
      ['raw_ecommerce', 'CustomerID', 'dim_cliente', 'es_cliente_anonimo', 'BOOLEAN', "TRUE si CustomerID IS NULL en origen. FALSE en otro caso."],
    ]
  },
  {
    label: 'DIMENSIÓN: dim_geografia',
    color: 'FF4C1D95',
    rows: [
      ['raw_ecommerce', 'Country', 'dim_geografia', 'id_geografia_sk', 'SERIAL (INT)', 'Clave subrogada autogenerada por secuencia.'],
      ['raw_ecommerce', 'Country', 'dim_geografia', 'pais', 'VARCHAR(100)', "TRIM(INITCAP(Country)). Normalizar capitalización del nombre del país."],
      ['raw_ecommerce', '(calculado)', 'dim_geografia', 'region', 'VARCHAR(100)', "Asignar vía lookup table de países→regiones. Default: 'Sin Clasificar'."],
    ]
  },
  {
    label: 'DIMENSIÓN: dim_factura',
    color: 'FF7C2D12',
    rows: [
      ['raw_ecommerce', 'InvoiceNo', 'dim_factura', 'id_factura_sk', 'SERIAL (INT)', 'Clave subrogada autogenerada por secuencia.'],
      ['raw_ecommerce', 'InvoiceNo', 'dim_factura', 'numero_factura_origen', 'VARCHAR(20)', "TRIM(InvoiceNo). Preservar prefijo 'C' si es cancelación."],
      ['raw_ecommerce', 'InvoiceNo', 'dim_factura', 'es_cancelacion', 'BOOLEAN', "TRUE si LEFT(TRIM(InvoiceNo), 1) = 'C'. FALSE en cualquier otro caso."],
    ]
  },
  {
    label: 'TABLA DE HECHOS: fact_ventas',
    color: 'FF92400E',
    rows: [
      ['raw_ecommerce', '(secuencia)', 'fact_ventas', 'id_venta_sk', 'BIGSERIAL (INT)', 'Clave subrogada autogenerada. No existe campo equivalente en el origen.'],
      ['raw_ecommerce', 'InvoiceDate', 'fact_ventas', 'id_fecha_sk', 'INTEGER FK', "Resolver SK: SELECT id_fecha_sk FROM dim_fecha WHERE fecha_completa = TO_TIMESTAMP(InvoiceDate, 'MM/DD/YYYY HH24:MI')."],
      ['raw_ecommerce', 'StockCode', 'fact_ventas', 'id_producto_sk', 'INTEGER FK', 'Resolver SK: SELECT id_producto_sk FROM dim_producto WHERE codigo_producto_origen = TRIM(UPPER(StockCode)).'],
      ['raw_ecommerce', 'CustomerID', 'fact_ventas', 'id_cliente_sk', 'INTEGER FK', "Resolver SK en dim_cliente. Si CustomerID IS NULL → id_cliente_sk = -1."],
      ['raw_ecommerce', 'Country', 'fact_ventas', 'id_geografia_sk', 'INTEGER FK', 'Resolver SK: SELECT id_geografia_sk FROM dim_geografia WHERE pais = TRIM(INITCAP(Country)).'],
      ['raw_ecommerce', 'InvoiceNo', 'fact_ventas', 'id_factura_sk', 'INTEGER FK', 'Resolver SK: SELECT id_factura_sk FROM dim_factura WHERE numero_factura_origen = TRIM(InvoiceNo).'],
      ['raw_ecommerce', 'Quantity', 'fact_ventas', 'cantidad', 'INTEGER', "CAST(Quantity AS INTEGER). Conservar valor negativo. Registrar en log si abs(Quantity) > umbral."],
      ['raw_ecommerce', 'UnitPrice', 'fact_ventas', 'precio_unitario', 'NUMERIC(10,2)', "ROUND(UnitPrice::NUMERIC, 2). Si UnitPrice < 0 → registrar en log. Si = 0 → permitir con advertencia."],
      ['raw_ecommerce', '(calculado)', 'fact_ventas', 'monto_total', 'NUMERIC(12,2)', "Calcular en ETL: Quantity * UnitPrice. No existe campo en origen."],
      ['raw_ecommerce', 'InvoiceNo', 'fact_ventas', 'es_devolucion', 'BOOLEAN', "Desnormalización para rendimiento: TRUE si LEFT(TRIM(InvoiceNo), 1) = 'C'."],
    ]
  },
];

const altRow = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F7FF' } };
const normalRow = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };
const pkStyle = { bold: true, color: { argb: 'FF92400E' } };
const fkStyle = { bold: true, color: { argb: 'FF1E3A8A' } };

let rowIndex = 3;
sections.forEach(section => {
  // Section header
  ws.mergeCells(`A${rowIndex}:F${rowIndex}`);
  const sh = ws.getCell(`A${rowIndex}`);
  sh.value = section.label;
  sh.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: section.color } };
  sh.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
  sh.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
  ws.getRow(rowIndex).height = 22;
  rowIndex++;

  section.rows.forEach((rowData, i) => {
    const row = ws.addRow(rowData);
    row.height = 40;
    row.eachCell((cell, colNum) => {
      cell.fill = i % 2 === 0 ? normalRow : altRow;
      cell.alignment = { vertical: 'middle', wrapText: true, horizontal: colNum === 6 ? 'left' : 'center' };
      cell.font = { size: 10 };
      cell.border = { bottom: { style: 'thin', color: { argb: 'FFDDDDDD' } } };
    });
    // Style PK/FK in campo_destino column
    const dest = rowData[3];
    const destCell = row.getCell(4);
    if (dest.includes('PK')) destCell.font = { ...pkStyle, size: 10 };
    else if (dest.includes('FK')) destCell.font = { ...fkStyle, size: 10 };

    rowIndex++;
  });

  // Spacer
  ws.addRow([]);
  rowIndex++;
});

workbook.xlsx.writeFile('design/matriz_mapeo.xlsx').then(() => {
  console.log('Archivo generado: design/matriz_mapeo.xlsx');
});
