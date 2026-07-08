export type StoreSettings = {
  id: number;
  name: string;
  logo_url: string | null;
  banner_url: string | null;
  banner_urls: string[];
  banner_links: string[];
  delivery_time_min: number;
  delivery_time_max: number;
  phone: string | null;
  whatsapp: string | null;
  address: string | null;
  brand_color: string;
  is_open: boolean;
  opening_hours: Record<string, [string, string][]>;
  delivery_fee: number;
  min_order: number;
  delivery_areas: { name: string; fee: number }[];
  referral_enabled: boolean;
  referral_percent: number;
  referral_min_order: number;
  referral_title: string;
  referral_description: string;
  default_margin_percent: number;
};

export type Category = {
  id: string;
  name: string;
  sort_order: number;
  active: boolean;
};

export type Addon = {
  id: string;
  group_id: string;
  name: string;
  price: number;
  active: boolean;
  sort_order: number;
};

export type AddonGroup = {
  id: string;
  product_id: string;
  name: string;
  min_select: number;
  max_select: number;
  sort_order: number;
  addons: Addon[];
};

export type Product = {
  id: string;
  category_id: string | null;
  name: string;
  description: string;
  price: number;
  promo_price: number | null;
  image_url: string | null;
  featured: boolean;
  active: boolean;
  sort_order: number;
  addon_groups?: AddonGroup[];
  loyalty_points?: number | null;
  cost_price: number;
  margin_percent: number | null;
  product_ingredients?: ProductIngredient[];
};

export type Ingredient = {
  id: string;
  name: string;
  unit: 'un' | 'kg';
  cost_per_unit: number;
  stock_quantity: number;
  min_stock: number;
  active: boolean;
  created_at: string;
};

export type ProductIngredient = {
  id: string;
  product_id: string;
  ingredient_id: string;
  quantity: number;
  ingredient?: Ingredient;
};

export type Coupon = {
  id: string;
  code: string;
  type: 'percent' | 'fixed' | 'free_delivery';
  value: number;
  min_order: number;
  max_uses: number | null;
  used_count: number;
  active: boolean;
  expires_at: string | null;
};

export type Promotion = {
  id: string;
  name: string;
  description: string | null;
  banner_url: string | null;
  discount_type: 'percent' | 'fixed';
  discount_value: number;
  display_on: string[];
  starts_at: string | null;
  ends_at: string | null;
  active: boolean;
  created_at: string;
  promotion_products?: { product_id: string }[];
};

export type LoyaltySettings = {
  id: number;
  enabled: boolean;
  points_per_currency: number;
  min_order_to_earn: number;
};

export type LoyaltyReward = {
  id: string;
  name: string;
  description: string | null;
  points_cost: number;
  type: 'discount_percent' | 'discount_fixed' | 'free_product';
  value: number;
  product_id: string | null;
  active: boolean;
};

export type Address = {
  id: string;
  user_id: string;
  label: string;
  street: string;
  number: string;
  complement: string | null;
  neighborhood: string;
  city: string;
  reference: string | null;
};

export type OrderStatus =
  | 'open_tab'
  | 'new'
  | 'confirmed'
  | 'preparing'
  | 'ready'
  | 'out_for_delivery'
  | 'delivered'
  | 'canceled';

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  open_tab: 'Comanda aberta',
  new: 'Novo pedido',
  confirmed: 'Confirmado',
  preparing: 'Em produção',
  ready: 'Pronto',
  out_for_delivery: 'Saiu para entrega',
  delivered: 'Entregue',
  canceled: 'Cancelado',
};

export const ORDER_STATUS_FLOW: OrderStatus[] = [
  'new',
  'confirmed',
  'preparing',
  'ready',
  'out_for_delivery',
  'delivered',
];

export type OrderItem = {
  id: string;
  order_id: string;
  product_id: string | null;
  product_name: string;
  quantity: number;
  unit_price: number;
  addons: { name: string; price: number }[];
  notes: string | null;
  total: number;
};

export type Order = {
  id: string;
  code: number;
  user_id: string | null;
  customer_name: string;
  customer_whatsapp: string;
  fulfillment: 'delivery' | 'pickup' | 'dine_in';
  address: Record<string, string> | null;
  payment_method: 'pix' | 'card' | 'cash' | null;
  change_for: number | null;
  status: OrderStatus;
  channel: 'web' | 'counter' | 'phone' | 'whatsapp' | 'dine_in';
  table_number: number | null;
  closed_at: string | null;
  subtotal: number;
  delivery_fee: number;
  discount: number;
  total: number;
  coupon_code: string | null;
  notes: string | null;
  issue_type: string | null;
  issue_notes: string | null;
  created_at: string;
  updated_at: string;
  order_items?: OrderItem[];
};

export const ISSUE_TYPE_LABELS: Record<string, string> = {
  no_show: 'Cliente não atendeu / ausente',
  refused: 'Cliente recusou o pedido',
  returned: 'Pedido devolvido',
  wrong_address: 'Endereço incorreto / difícil acesso',
  other: 'Outro problema',
};

export const PAYMENT_LABELS = {
  pix: 'PIX',
  card: 'Cartão',
  cash: 'Dinheiro',
} as const;
