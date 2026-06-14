export function serializeOrder(order: Record<string, unknown>) {
  return {
    id: order.id,
    code: order.code,
    status: order.status,
    customer_name: order.customer_name,
    customer_whatsapp: order.customer_whatsapp,
    fulfillment: order.fulfillment,
    address: order.address,
    payment_method: order.payment_method,
    change_for: order.change_for,
    channel: order.channel,
    subtotal: order.subtotal,
    delivery_fee: order.delivery_fee,
    discount: order.discount,
    total: order.total,
    coupon_code: order.coupon_code,
    notes: order.notes,
    created_at: order.created_at,
    updated_at: order.updated_at,
    items: (order.order_items as unknown[]) ?? [],
    tracking_url: `${process.env.NEXT_PUBLIC_SITE_URL ?? ''}/pedido/${order.id}`,
  };
}
