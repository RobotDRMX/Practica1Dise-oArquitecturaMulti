const { createCanvas } = require('canvas');
const fs = require('fs');

const W = 1400, H = 960;
const canvas = createCanvas(W, H);
const ctx = canvas.getContext('2d');

// Background
ctx.fillStyle = '#0F1923';
ctx.fillRect(0, 0, W, H);

// Title
ctx.fillStyle = '#E2E8F0';
ctx.font = 'bold 22px sans-serif';
ctx.textAlign = 'center';
ctx.fillText('Esquema en Estrella — dw_analytics', W / 2, 38);
ctx.font = '14px sans-serif';
ctx.fillStyle = '#94A3B8';
ctx.fillText('Práctica 1: Diseño de Arquitectura Multidimensional | Extracción de Conocimiento en Bases de Datos', W / 2, 62);

// ---- Table drawing helper ----
function drawTable(x, y, title, fields, headerColor, isFact) {
  const colW = 320, rowH = 24, padding = 10;
  const totalH = rowH + fields.length * rowH + padding;
  const totalW = colW;

  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.fillRect(x + 4, y + 4, totalW, totalH);

  // Border
  ctx.strokeStyle = isFact ? '#F59E0B' : '#3B82F6';
  ctx.lineWidth = isFact ? 2.5 : 1.5;
  ctx.strokeRect(x, y, totalW, totalH);

  // Header
  ctx.fillStyle = headerColor;
  ctx.fillRect(x, y, totalW, rowH);
  ctx.fillStyle = '#FFFFFF';
  ctx.font = `bold 13px sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText(title, x + totalW / 2, y + rowH - 7);

  // Rows
  fields.forEach((field, i) => {
    const ry = y + rowH + i * rowH;
    ctx.fillStyle = i % 2 === 0 ? '#1E2D3D' : '#162230';
    ctx.fillRect(x, ry, totalW, rowH);

    ctx.fillStyle = field.pk ? '#F59E0B' : (field.fk ? '#60A5FA' : '#CBD5E1');
    ctx.font = `${field.pk || field.fk ? 'bold ' : ''}12px sans-serif`;
    ctx.textAlign = 'left';
    ctx.fillText(field.label, x + 10, ry + rowH - 7);

    ctx.fillStyle = '#64748B';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(field.type, x + totalW - 8, ry + rowH - 7);
  });

  return { cx: x + totalW / 2, cy: y + totalH / 2, x, y, w: totalW, h: totalH };
}

// ---- Arrow helper ----
function drawArrow(x1, y1, x2, y2) {
  ctx.strokeStyle = '#475569';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([5, 3]);
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.setLineDash([]);

  // arrowhead
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const al = 10;
  ctx.fillStyle = '#475569';
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - al * Math.cos(angle - 0.4), y2 - al * Math.sin(angle - 0.4));
  ctx.lineTo(x2 - al * Math.cos(angle + 0.4), y2 - al * Math.sin(angle + 0.4));
  ctx.closePath();
  ctx.fill();
}

// ---- Table definitions ----
// FACT — center
const factX = (W - 320) / 2, factY = (H - 280) / 2 - 10;
const fact = drawTable(factX, factY, '⬛  fact_ventas', [
  { label: 'id_venta_sk', type: 'BIGSERIAL PK', pk: true },
  { label: '▸ id_fecha_sk', type: 'INTEGER FK', fk: true },
  { label: '▸ id_producto_sk', type: 'INTEGER FK', fk: true },
  { label: '▸ id_cliente_sk', type: 'INTEGER FK', fk: true },
  { label: '▸ id_geografia_sk', type: 'INTEGER FK', fk: true },
  { label: '▸ id_factura_sk', type: 'INTEGER FK', fk: true },
  { label: 'cantidad', type: 'INTEGER' },
  { label: 'precio_unitario', type: 'NUMERIC(10,2)' },
  { label: 'monto_total', type: 'NUMERIC(12,2)' },
  { label: 'es_devolucion', type: 'BOOLEAN' },
], '#92400E', true);

// DIM_FECHA — top center
const dimFechaX = (W - 320) / 2, dimFechaY = 80;
const dimFecha = drawTable(dimFechaX, dimFechaY, '🕐  dim_fecha', [
  { label: 'id_fecha_sk', type: 'SERIAL PK', pk: true },
  { label: 'fecha_completa', type: 'TIMESTAMP' },
  { label: 'anio', type: 'SMALLINT' },
  { label: 'trimestre', type: 'SMALLINT' },
  { label: 'mes / nombre_mes', type: 'SMALLINT / VARCHAR(20)' },
  { label: 'dia / nombre_dia_semana', type: 'SMALLINT / VARCHAR(20)' },
  { label: 'hora / minuto', type: 'SMALLINT' },
  { label: 'es_fin_de_semana', type: 'BOOLEAN' },
], '#1D4ED8', false);

// DIM_PRODUCTO — left
const dimProductoX = 30, dimProductoY = 300;
const dimProducto = drawTable(dimProductoX, dimProductoY, '📦  dim_producto', [
  { label: 'id_producto_sk', type: 'SERIAL PK', pk: true },
  { label: 'codigo_producto_origen', type: 'VARCHAR(20)' },
  { label: 'descripcion_producto', type: 'VARCHAR(255)' },
  { label: 'es_codigo_especial', type: 'BOOLEAN' },
], '#166534', false);

// DIM_CLIENTE — left lower
const dimClienteX = 30, dimClienteY = 590;
const dimCliente = drawTable(dimClienteX, dimClienteY, '👤  dim_cliente', [
  { label: 'id_cliente_sk', type: 'INTEGER PK', pk: true },
  { label: 'codigo_cliente_origen', type: 'VARCHAR(10)' },
  { label: 'es_cliente_anonimo', type: 'BOOLEAN' },
], '#1E3A5F', false);

// DIM_GEOGRAFIA — right
const dimGeografiaX = W - 350, dimGeografiaY = 300;
const dimGeografia = drawTable(dimGeografiaX, dimGeografiaY, '🌍  dim_geografia', [
  { label: 'id_geografia_sk', type: 'SERIAL PK', pk: true },
  { label: 'pais', type: 'VARCHAR(100)' },
  { label: 'region', type: 'VARCHAR(100)' },
], '#4C1D95', false);

// DIM_FACTURA — right lower
const dimFacturaX = W - 350, dimFacturaY = 590;
const dimFactura = drawTable(dimFacturaX, dimFacturaY, '🧾  dim_factura', [
  { label: 'id_factura_sk', type: 'SERIAL PK', pk: true },
  { label: 'numero_factura_origen', type: 'VARCHAR(20)' },
  { label: 'es_cancelacion', type: 'BOOLEAN' },
], '#7C2D12', false);

// ---- Arrows from fact to dims ----
// To dim_fecha (top center)
drawArrow(fact.x + fact.w / 2, fact.y, dimFecha.x + dimFecha.w / 2, dimFecha.y + dimFecha.h);

// To dim_producto (left)
drawArrow(fact.x, fact.y + fact.h * 0.3, dimProducto.x + dimProducto.w, dimProducto.y + dimProducto.h / 2);

// To dim_cliente (left lower)
drawArrow(fact.x, fact.y + fact.h * 0.55, dimCliente.x + dimCliente.w, dimCliente.y + dimCliente.h / 2);

// To dim_geografia (right)
drawArrow(fact.x + fact.w, fact.y + fact.h * 0.3, dimGeografia.x, dimGeografia.y + dimGeografia.h / 2);

// To dim_factura (right lower)
drawArrow(fact.x + fact.w, fact.y + fact.h * 0.55, dimFactura.x, dimFactura.y + dimFactura.h / 2);

// ---- Legend ----
const lx = 30, ly = H - 90;
ctx.fillStyle = '#1E2D3D';
ctx.fillRect(lx, ly, 380, 68);
ctx.strokeStyle = '#334155';
ctx.lineWidth = 1;
ctx.strokeRect(lx, ly, 380, 68);

ctx.font = 'bold 12px sans-serif';
ctx.fillStyle = '#94A3B8';
ctx.textAlign = 'left';
ctx.fillText('Leyenda:', lx + 10, ly + 20);

ctx.fillStyle = '#F59E0B';
ctx.fillRect(lx + 10, ly + 30, 14, 14);
ctx.fillStyle = '#CBD5E1';
ctx.font = '11px sans-serif';
ctx.fillText('Tabla de Hechos (fact_ventas)', lx + 30, ly + 43);

ctx.fillStyle = '#3B82F6';
ctx.fillRect(lx + 190, ly + 30, 14, 14);
ctx.fillText('Dimensiones (dim_*)', lx + 210, ly + 43);

ctx.fillStyle = '#F59E0B';
ctx.font = 'bold 11px sans-serif';
ctx.fillText('PK', lx + 10, ly + 62);
ctx.fillStyle = '#60A5FA';
ctx.fillText('FK', lx + 40, ly + 62);
ctx.fillStyle = '#475569';
ctx.setLineDash([5, 3]);
ctx.beginPath(); ctx.moveTo(lx + 70, ly + 57); ctx.lineTo(lx + 110, ly + 57); ctx.stroke();
ctx.setLineDash([]);
ctx.fillStyle = '#CBD5E1';
ctx.font = '11px sans-serif';
ctx.fillText('Relación FK → PK', lx + 115, ly + 62);

// Grain note
ctx.fillStyle = '#0F172A';
ctx.fillRect(W - 410, H - 90, 380, 68);
ctx.strokeStyle = '#334155';
ctx.lineWidth = 1;
ctx.strokeRect(W - 410, H - 90, 380, 68);
ctx.fillStyle = '#94A3B8';
ctx.font = 'bold 12px sans-serif';
ctx.textAlign = 'left';
ctx.fillText('Grano del Análisis:', W - 400, H - 70);
ctx.fillStyle = '#CBD5E1';
ctx.font = '11px sans-serif';
ctx.fillText('Una línea de artículo por factura', W - 400, H - 52);
ctx.fillText('(InvoiceNo + StockCode + InvoiceDate)', W - 400, H - 36);

// Save
const out = fs.createWriteStream('design/diagrama_estrella.png');
const stream = canvas.createPNGStream();
stream.pipe(out);
out.on('finish', () => console.log('Diagrama generado: design/diagrama_estrella.png'));
