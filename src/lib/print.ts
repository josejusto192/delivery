import { brl, formatDateTime } from '@/lib/format';
import { PAYMENT_LABELS, type Order } from '@/lib/types';

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

export function printOrder(order: Order, customerNote?: string) {
  const addr = order.address;
  const win = window.open('', '_blank', 'width=380,height=600');
  if (!win) return;
  const itemsHtml = (order.order_items ?? [])
    .map(
      (item) => `
        <div class="item">
          <div class="item-line"><span>${item.quantity}x ${escapeHtml(item.product_name)}</span><span>${brl(Number(item.total))}</span></div>
          ${item.addons?.length ? `<div class="addons">+ ${item.addons.map((a) => escapeHtml(a.name)).join(', ')}</div>` : ''}
          ${item.notes ? `<div class="addons">Obs: ${escapeHtml(item.notes)}</div>` : ''}
        </div>`
    )
    .join('');

  win.document.write(`
    <html>
      <head>
        <title>Pedido #${order.code}</title>
        <style>
          * { box-sizing: border-box; }
          body { font-family: monospace; font-size: 13px; width: 280px; margin: 0 auto; padding: 12px; color: #000; }
          h1 { font-size: 18px; text-align: center; margin: 0 0 4px; }
          .center { text-align: center; }
          hr { border: none; border-top: 1px dashed #000; margin: 8px 0; }
          .item-line { display: flex; justify-content: space-between; gap: 8px; font-weight: bold; }
          .addons { font-size: 12px; padding-left: 10px; }
          .total-line { display: flex; justify-content: space-between; font-weight: bold; font-size: 15px; }
          .row { display: flex; justify-content: space-between; }
        </style>
      </head>
      <body>
        <h1>Pedido #${order.code}</h1>
        <p class="center">${formatDateTime(order.created_at)}</p>
        <hr />
        <p><strong>${escapeHtml(order.customer_name)}</strong><br/>${escapeHtml(order.customer_whatsapp)}</p>
        <p>${order.fulfillment === 'delivery' ? 'ENTREGA' : 'RETIRADA'} · ${PAYMENT_LABELS[order.payment_method]}${
          order.payment_method === 'cash' && order.change_for ? ` · troco p/ ${brl(Number(order.change_for))}` : ''
        }</p>
        ${
          addr
            ? `<p>${escapeHtml(addr.street)}, ${escapeHtml(addr.number)}${addr.complement ? ` - ${escapeHtml(addr.complement)}` : ''}<br/>${escapeHtml(addr.neighborhood)}${addr.area ? ` (${escapeHtml(addr.area)})` : ''}${addr.reference ? `<br/>Ref: ${escapeHtml(addr.reference)}` : ''}</p>`
            : ''
        }
        <hr />
        ${itemsHtml}
        <hr />
        <div class="row"><span>Subtotal</span><span>${brl(Number(order.subtotal))}</span></div>
        <div class="row"><span>Entrega</span><span>${Number(order.delivery_fee) === 0 ? 'Grátis' : brl(Number(order.delivery_fee))}</span></div>
        ${Number(order.discount) > 0 ? `<div class="row"><span>Desconto${order.coupon_code ? ` (${escapeHtml(order.coupon_code)})` : ''}</span><span>- ${brl(Number(order.discount))}</span></div>` : ''}
        <hr />
        <div class="total-line"><span>TOTAL</span><span>${brl(Number(order.total))}</span></div>
        ${order.notes ? `<hr /><p>Obs.: ${escapeHtml(order.notes)}</p>` : ''}
        ${customerNote?.trim() ? `<hr /><p><strong>Obs. sobre o cliente:</strong><br/>${escapeHtml(customerNote.trim())}</p>` : ''}
      </body>
    </html>
  `);
  win.document.close();
  win.focus();
  win.print();
}
