// PDF payload & Printable HTML generator conforming to PDFS.md

import { Remittance, MarginRemittance, Customer, Supplier } from '../types/domain';
import { db } from '../services/db';

export const pdfService = {
  generateRtoHtml(remittanceId: string): string {
    const state = db.getState();
    const rem = state.remittances[remittanceId];
    if (!rem) return '<h1>Remito no encontrado</h1>';

    const items = Object.values(state.remittanceItems).filter((i) => i.remittance_id === remittanceId);
    const discounts = Object.values(state.remittanceDiscountSteps)
      .filter((d) => d.remittance_id === remittanceId)
      .sort((a, b) => a.position - b.position);

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Remito ${rem.code}</title>
        <style>
          body { font-family: 'Inter', Arial, sans-serif; color: #393939; margin: 40px; font-size: 13px; line-height: 1.5; }
          .header { display: flex; justify-content: space-between; border-bottom: 2px solid #B99D22; padding-bottom: 15px; margin-bottom: 20px; }
          .logo { font-size: 24px; font-weight: bold; color: #B99D22; letter-spacing: 1px; }
          .doc-title { text-align: right; }
          .doc-title h1 { margin: 0; font-size: 20px; color: #000; }
          .doc-title p { margin: 2px 0 0; color: #666; }
          .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 25px; padding: 15px; background: #FBFBFB; border: 1px solid #D9D9D9; border-radius: 4px; }
          .info-block p { margin: 3px 0; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 25px; }
          th { background: #000; color: white; text-align: left; padding: 8px 10px; font-size: 12px; }
          th.num, td.num { text-align: right; }
          td { padding: 8px 10px; border-bottom: 1px solid #D9D9D9; }
          .totals { width: 320px; margin-left: auto; margin-top: 15px; }
          .totals-row { display: flex; justify-content: space-between; padding: 4px 0; }
          .totals-row.main { border-top: 1px solid #333; font-weight: bold; font-size: 14px; margin-top: 4px; padding-top: 6px; }
          .totals-row.final { border-top: 2px solid #B99D22; font-weight: bold; font-size: 16px; color: #B99D22; margin-top: 6px; padding-top: 8px; }
          .footer { margin-top: 50px; text-align: center; font-size: 11px; color: #888; border-top: 1px solid #eee; padding-top: 10px; }
          @media print {
            body { margin: 20px; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <div class="logo">STEFFEN</div>
            <p style="margin:2px 0; color:#555;">Cosmética Capilar Profesional</p>
          </div>
          <div class="doc-title">
            <h1>REMITO DE ENTREGA</h1>
            <p><strong>Nº:</strong> ${rem.code}</p>
            <p><strong>Fecha:</strong> ${new Date(rem.created_at).toLocaleDateString('es-AR')}</p>
          </div>
        </div>

        <div class="info-grid">
          <div class="info-block">
            <p><strong>Destinatario:</strong> ${rem.recipient_name_snapshot || 'Consumidor Final'}</p>
            <p><strong>Domicilio:</strong> ${rem.address_snapshot || 'Retiro en fábrica'}</p>
            <p><strong>Localidad/Prov.:</strong> ${rem.locality_snapshot || ''} ${rem.province_snapshot ? '- ' + rem.province_snapshot : ''}</p>
            <p><strong>Teléfono:</strong> ${rem.phone_snapshot || '-'}</p>
          </div>
          <div class="info-block">
            <p><strong>Transporte:</strong> ${rem.transport_name_snapshot || '-'}</p>
            <p><strong>Dirección Transporte:</strong> ${rem.transport_address_snapshot || '-'}</p>
            <p><strong>Cantidad de bultos:</strong> ${rem.package_count_snapshot || 1}</p>
            <p><strong>Peso total:</strong> ${rem.weight_kg_snapshot.toFixed(3)} kg</p>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 50px;" class="num">CANT.</th>
              <th>PRODUCTO</th>
              <th>PRESENTACIÓN</th>
              <th class="num" style="width: 100px;">P. UNIT</th>
              <th class="num" style="width: 110px;">SUBTOTAL</th>
            </tr>
          </thead>
          <tbody>
            ${items
              .map(
                (i) => `
              <tr>
                <td class="num font-bold"><strong>${i.quantity_sent}</strong></td>
                <td>${i.product_name_snapshot} (${i.product_code_snapshot})</td>
                <td>${i.presentation_snapshot}</td>
                <td class="num">$ ${i.unit_price_ars_snapshot.toLocaleString('es-AR')}</td>
                <td class="num font-bold">$ ${i.line_total_ars.toLocaleString('es-AR')}</td>
              </tr>
            `
              )
              .join('')}
          </tbody>
        </table>

        <div class="totals">
          <div class="totals-row">
            <span>Subtotal:</span>
            <span>$ ${rem.subtotal_ars.toLocaleString('es-AR')}</span>
          </div>
          ${discounts
            .map(
              (d) => `
            <div class="totals-row" style="color:#008102;">
              <span>Descuento ${d.percent}%:</span>
              <span>- $ ${Math.round(d.amount_ars_snapshot).toLocaleString('es-AR')}</span>
            </div>
          `
            )
            .join('')}
          <div class="totals-row main">
            <span>TOTAL PEDIDO:</span>
            <span>$ ${Math.round(rem.total_order_ars).toLocaleString('es-AR')}</span>
          </div>
          <div class="totals-row" style="color: #666;">
            <span>Saldo anterior:</span>
            <span>$ ${Math.round(rem.prior_balance_snapshot_ars).toLocaleString('es-AR')}</span>
          </div>
          <div class="totals-row final">
            <span>TOTAL A COBRAR:</span>
            <span>$ ${Math.round(rem.total_to_collect_ars).toLocaleString('es-AR')}</span>
          </div>
        </div>

        <div class="footer">
          <p>Documento oficial emitido por Steffen Cosmética Capilar — ${rem.code} — Página 1 de 1</p>
        </div>
      </body>
      </html>
    `;
  },

  generateRtmHtml(marginRemittanceId: string): string {
    const state = db.getState();
    const rtm = state.marginRemittances[marginRemittanceId];
    if (!rtm) return '<h1>RTM no encontrado</h1>';

    const rem = state.remittances[rtm.remittance_id];
    const items = Object.values(state.marginRemittanceItems).filter((i) => i.margin_remittance_id === marginRemittanceId);

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Remito Margen ${rtm.code}</title>
        <style>
          body { font-family: 'Inter', Arial, sans-serif; color: #393939; margin: 40px; font-size: 13px; line-height: 1.5; }
          .header { display: flex; justify-content: space-between; border-bottom: 2px solid #000; padding-bottom: 15px; margin-bottom: 20px; }
          .logo { font-size: 22px; font-weight: bold; color: #B99D22; }
          .internal-badge { display: inline-block; background: #000; color: #fff; padding: 3px 8px; font-weight: bold; font-size: 11px; border-radius: 3px; margin-top: 4px; }
          .doc-title { text-align: right; }
          .doc-title h1 { margin: 0; font-size: 20px; color: #000; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 25px; }
          th { background: #393939; color: white; text-align: left; padding: 8px 10px; font-size: 12px; }
          th.num, td.num { text-align: right; }
          td { padding: 8px 10px; border-bottom: 1px solid #D9D9D9; }
          .totals { width: 320px; margin-left: auto; margin-top: 15px; }
          .totals-row { display: flex; justify-content: space-between; padding: 5px 0; }
          .gain-box { background: #e8f5e9; border: 1px solid #008102; padding: 10px; border-radius: 4px; color: #008102; font-weight: bold; font-size: 16px; margin-top: 10px; display: flex; justify-content: space-between; }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <div class="logo">STEFFEN</div>
            <span class="internal-badge">DOCUMENTO DE USO INTERNO</span>
          </div>
          <div class="doc-title">
            <h1>REMITO MARGEN</h1>
            <p><strong>Nº RTM:</strong> ${rtm.code}</p>
            <p><strong>Remito Venta:</strong> ${rem?.code || '-'}</p>
            <p><strong>Fecha:</strong> ${new Date(rtm.created_at).toLocaleDateString('es-AR')}</p>
          </div>
        </div>

        <p><strong>Cliente / Destino:</strong> ${rem?.recipient_name_snapshot || 'Consumidor Final'}</p>

        <table>
          <thead>
            <tr>
              <th class="num" style="width: 50px;">CANT</th>
              <th>PRODUCTO</th>
              <th class="num">COSTO UNIT. TEÓRICO</th>
              <th class="num">COSTO TOTAL</th>
            </tr>
          </thead>
          <tbody>
            ${items
              .map((i) => {
                const stockItem = state.stockItems[i.product_id];
                return `
                <tr>
                  <td class="num"><strong>${i.quantity_sent}</strong></td>
                  <td>${stockItem?.name || i.product_id}</td>
                  <td class="num">$ ${i.unit_cost_theoretical_snapshot_ars.toFixed(2)}</td>
                  <td class="num font-bold">$ ${Math.round(i.total_cost_snapshot_ars).toLocaleString('es-AR')}</td>
                </tr>
              `;
              })
              .join('')}
          </tbody>
        </table>

        <div class="totals">
          <div class="totals-row">
            <span>Total Venta Pedido:</span>
            <span>$ ${Math.round(rem?.total_order_ars || 0).toLocaleString('es-AR')}</span>
          </div>
          <div class="totals-row">
            <span>Costo Productos:</span>
            <span>- $ ${Math.round(rtm.products_cost_total_ars).toLocaleString('es-AR')}</span>
          </div>
          <div class="totals-row">
            <span>Transporte:</span>
            <span>- $ ${Math.round(rtm.transport_cost_ars).toLocaleString('es-AR')}</span>
          </div>
          <div class="gain-box">
            <span>GANANCIA NETA:</span>
            <span>$ ${Math.round(rtm.gain_ars).toLocaleString('es-AR')}</span>
          </div>
        </div>
      </body>
      </html>
    `;
  },
};
