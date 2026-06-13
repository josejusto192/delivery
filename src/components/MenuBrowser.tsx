'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import type { Category, Product, StoreSettings } from '@/lib/types';
import { brl } from '@/lib/format';

export default function MenuBrowser({
  categories,
  products,
  settings,
}: {
  categories: Category[];
  products: Product[];
  settings: StoreSettings | null;
}) {
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const featured = products.filter((p) => p.featured);

  const visible = useMemo(() => {
    let list = products;
    if (activeCategory) list = list.filter((p) => p.category_id === activeCategory);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((p) => {
        const catName = categories.find((c) => c.id === p.category_id)?.name ?? '';
        return (
          p.name.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q) ||
          catName.toLowerCase().includes(q)
        );
      });
    }
    return list;
  }, [products, categories, activeCategory, search]);

  const grouped = useMemo(() => {
    const map = new Map<string, Product[]>();
    for (const cat of categories) {
      const items = visible.filter((p) => p.category_id === cat.id);
      if (items.length) map.set(cat.id, items);
    }
    return map;
  }, [categories, visible]);

  const minAreaFee = (settings?.delivery_areas ?? []).length
    ? Math.min(...(settings?.delivery_areas ?? []).map((a) => Number(a.fee)))
    : null;
  const feeLabel =
    minAreaFee !== null
      ? minAreaFee === 0
        ? 'entrega grátis'
        : `a partir de ${brl(minAreaFee)}`
      : Number(settings?.delivery_fee ?? 0) === 0
        ? 'entrega grátis'
        : brl(Number(settings?.delivery_fee ?? 0));

  return (
    <div className="pb-6">
      {settings && (
        <section className="-mx-4 mb-5 md:mx-0 md:rounded-2xl md:overflow-hidden">
          <BannerSlider
            urls={settings.banner_urls?.length ? settings.banner_urls : settings.banner_url ? [settings.banner_url] : []}
            links={settings.banner_links ?? []}
          />
          <p className="mx-4 mt-3 text-xs text-neutral-500 md:mx-0">
            🛵 {feeLabel} · hoje, {settings.delivery_time_min}–{settings.delivery_time_max} min
            {Number(settings.min_order) > 0 && <> · mínimo {brl(Number(settings.min_order))}</>}
          </p>
        </section>
      )}

      <div className="space-y-6">
        <input
          className="input !rounded-full md:max-w-md"
          placeholder="busque por item ou categoria"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <nav className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 md:flex-wrap md:overflow-visible md:mx-0 md:px-0">
          <button
            onClick={() => setActiveCategory(null)}
            className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium border transition-colors ${
              !activeCategory ? 'bg-brand text-white border-brand' : 'bg-white border-neutral-300 hover:border-brand'
            }`}
          >
            Tudo
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              onClick={() => setActiveCategory(c.id)}
              className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium border transition-colors ${
                activeCategory === c.id
                  ? 'bg-brand text-white border-brand'
                  : 'bg-white border-neutral-300 hover:border-brand'
              }`}
            >
              {c.name}
            </button>
          ))}
        </nav>

        {!activeCategory && !search && featured.length > 0 && (
          <section>
            <h2 className="text-lg font-bold mb-3">⭐ Destaques</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {featured.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          </section>
        )}

        {[...grouped.entries()].map(([catId, items]) => (
          <section key={catId}>
            <h2 className="text-lg font-bold mb-3">
              {categories.find((c) => c.id === catId)?.name}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {items.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          </section>
        ))}

        {visible.length === 0 && (
          <p className="text-center text-neutral-500 py-12">Nenhum produto encontrado.</p>
        )}
      </div>

    </div>
  );
}

function ProductCard({ product }: { product: Product }) {
  const hasPromo =
    product.promo_price != null && Number(product.promo_price) < Number(product.price);
  const offPercent = hasPromo
    ? Math.round((1 - Number(product.promo_price) / Number(product.price)) * 100)
    : 0;

  return (
    <Link href={`/produto/${product.id}`} className="card flex gap-3 p-3 text-left hover:border-brand transition-colors">
      <div className="flex-1 min-w-0">
        <p className="font-semibold">{product.name}</p>
        <p className="text-sm text-neutral-500 line-clamp-2 mt-0.5">{product.description}</p>
        {hasPromo ? (
          <div className="flex items-center gap-1.5 mt-2 flex-wrap">
            <span className="bg-green-600 text-white text-[11px] font-bold rounded px-1.5 py-0.5">
              -{offPercent}%
            </span>
            <span className="text-neutral-400 text-xs line-through">{brl(Number(product.price))}</span>
            <span className="text-green-600 font-bold">{brl(Number(product.promo_price))}</span>
          </div>
        ) : (
          <p className="text-brand font-bold mt-2">{brl(Number(product.price))}</p>
        )}
      </div>
      {product.image_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={product.image_url}
          alt={product.name}
          className="h-24 w-24 rounded-lg object-cover shrink-0"
        />
      )}
    </Link>
  );
}

function BannerSlider({ urls, links }: { urls: string[]; links: string[] }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (urls.length < 2) return;
    const interval = setInterval(() => setIndex((i) => (i + 1) % urls.length), 5000);
    return () => clearInterval(interval);
  }, [urls.length]);

  if (!urls.length) return null;

  return (
    <div className="relative w-full h-36 sm:h-48 md:h-64 lg:h-80 overflow-hidden">
      {urls.map((url, i) => {
        const link = links[i]?.trim();
        // eslint-disable-next-line @next/next/no-img-element
        const img = (
          <img
            src={url}
            alt=""
            className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ${
              i === index ? 'opacity-100' : 'opacity-0'
            } ${link ? 'cursor-pointer' : ''}`}
          />
        );
        if (!link) return <div key={url}>{img}</div>;
        const external = /^https?:\/\//i.test(link);
        return external ? (
          <a key={url} href={link} target="_blank" rel="noreferrer" aria-label="Banner">
            {img}
          </a>
        ) : (
          <Link key={url} href={link} aria-label="Banner">
            {img}
          </Link>
        );
      })}
      {urls.length > 1 && (
        <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1.5">
          {urls.map((_, i) => (
            <button
              key={i}
              onClick={() => setIndex(i)}
              aria-label={`Banner ${i + 1}`}
              className={`h-1.5 rounded-full transition-all ${
                i === index ? 'w-5 bg-white' : 'w-1.5 bg-white/50'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
