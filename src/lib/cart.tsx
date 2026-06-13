'use client';

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

export type CartAddon = { name: string; price: number };

export type CartItem = {
  key: string;
  productId: string;
  name: string;
  unitPrice: number;
  quantity: number;
  addons: CartAddon[];
  notes: string;
};

type CartContextValue = {
  items: CartItem[];
  addItem: (item: Omit<CartItem, 'key'>) => void;
  updateQuantity: (key: string, quantity: number) => void;
  removeItem: (key: string) => void;
  clear: () => void;
  subtotal: number;
  count: number;
};

const CartContext = createContext<CartContextValue | null>(null);
const STORAGE_KEY = 'delivery-cart-v1';

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setItems(JSON.parse(raw));
    } catch {}
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (loaded) localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items, loaded]);

  const addItem: CartContextValue['addItem'] = (item) => {
    setItems((prev) => [
      ...prev,
      { ...item, key: `${item.productId}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}` },
    ]);
  };

  const updateQuantity = (key: string, quantity: number) => {
    setItems((prev) =>
      quantity <= 0
        ? prev.filter((i) => i.key !== key)
        : prev.map((i) => (i.key === key ? { ...i, quantity } : i))
    );
  };

  const removeItem = (key: string) => setItems((prev) => prev.filter((i) => i.key !== key));
  const clear = () => setItems([]);

  const subtotal = useMemo(
    () =>
      items.reduce((sum, i) => {
        const addonsTotal = i.addons.reduce((a, ad) => a + Number(ad.price), 0);
        return sum + (Number(i.unitPrice) + addonsTotal) * i.quantity;
      }, 0),
    [items]
  );

  const count = useMemo(() => items.reduce((s, i) => s + i.quantity, 0), [items]);

  return (
    <CartContext.Provider value={{ items, addItem, updateQuantity, removeItem, clear, subtotal, count }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart deve ser usado dentro de CartProvider');
  return ctx;
}
