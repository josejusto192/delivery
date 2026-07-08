'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { brl } from '@/lib/format';
import type { Ingredient } from '@/lib/types';
import InfoTip from '@/components/admin/InfoTip';
import GuideCard from '@/components/admin/GuideCard';

type Draft = {
  name: string;
  unit: 'un' | 'kg';
  cost_per_unit: string;
  stock_quantity: string;
  min_stock: string;
};

const emptyDraft: Draft = { name: '', unit: 'kg', cost_per_unit: '', stock_quantity: '', min_stock: '' };

function unitLabel(unit: 'un' | 'kg') {
  return unit === 'kg' ? 'kg' : 'un';
}

export default function EstoqueAdminPage() {
  const supabase = useMemo(() => createClient(), []);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [marginInput, setMarginInput] = useState('');
  const [savingMargin, setSavingMargin] = useState(false);
  const [marginSaved, setMarginSaved] = useState(false);
  const [error, setError] = useState('');
  const [showCalc, setShowCalc] = useState(false);
  const [calcTotal, setCalcTotal] = useState('');
  const [calcQty, setCalcQty] = useState('');
  const [launchExpense, setLaunchExpense] = useState(true);
  const [expenseLaunched, setExpenseLaunched] = useState('');
  const [buying, setBuying] = useState<Ingredient | null>(null);
  const [buyQty, setBuyQty] = useState('');
  const [buyTotal, setBuyTotal] = useState('');
  const [buyLaunch, setBuyLaunch] = useState(true);
  const [buySaving, setBuySaving] = useState(false);

  const load = async () => {
    const [{ data: ing }, { data: s }] = await Promise.all([
      supabase.from('ingredients').select('*').order('name'),
      supabase.from('store_settings').select('default_margin_percent').single(),
    ]);
    setIngredients(ing ?? []);
    if (s) setMarginInput(String(s.default_margin_percent));
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const lowStock = ingredients.filter((i) => i.active && i.min_stock > 0 && i.stock_quantity <= i.min_stock);

  // primeira compra (insumo novo): oferece lançar no financeiro.
  // Reposições usam o botão "Compra" na lista (custo médio ponderado).
  const purchaseQty = editingId ? 0 : Number(draft.stock_quantity) || 0;
  const purchaseAmount = purchaseQty * (Number(draft.cost_per_unit) || 0);

  // nova compra de insumo existente → soma estoque e recalcula custo médio ponderado
  const buyQtyN = Number(buyQty) || 0;
  const buyTotalN = Number(buyTotal) || 0;
  const buyNewStock = buying ? Number(buying.stock_quantity) + buyQtyN : 0;
  const buyNewAvg =
    buying && buyNewStock > 0 && buyQtyN > 0 && buyTotalN > 0
      ? (Number(buying.stock_quantity) * Number(buying.cost_per_unit) + buyTotalN) / buyNewStock
      : null;

  const startBuy = (i: Ingredient) => {
    setBuying(i);
    setBuyQty('');
    setBuyTotal('');
    setBuyLaunch(true);
    setExpenseLaunched('');
    setError('');
  };

  const cancelBuy = () => {
    setBuying(null);
    setBuyQty('');
    setBuyTotal('');
  };

  const confirmBuy = async () => {
    if (!buying || buyQtyN <= 0 || buyTotalN <= 0 || buyNewAvg == null) return;
    setBuySaving(true);
    const { error: e } = await supabase
      .from('ingredients')
      .update({
        stock_quantity: buyNewStock,
        cost_per_unit: Math.round(buyNewAvg * 10000) / 10000,
      })
      .eq('id', buying.id);
    if (e) {
      setBuySaving(false);
      setError('Erro ao registrar a compra. Tente novamente.');
      return;
    }
    if (buyLaunch) {
      const now = new Date();
      const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      await supabase.from('expenses').insert({
        name: `Compra de insumo — ${buying.name}`,
        category: 'Insumos',
        amount: Math.round(buyTotalN * 100) / 100,
        competence_month: `${month}-01`,
        due_date: now.toISOString().slice(0, 10),
        paid: true,
        paid_at: now.toISOString(),
      });
    }
    setExpenseLaunched(
      `Compra registrada: +${buyQtyN.toLocaleString('pt-BR')} ${unitLabel(buying.unit)} de ${buying.name}, novo custo médio ${brl(buyNewAvg)}/${unitLabel(buying.unit)}${buyLaunch ? `, ${brl(buyTotalN)} lançados no Financeiro` : ''}.`
    );
    setBuySaving(false);
    cancelBuy();
    await load();
  };

  const calcResult = useMemo(() => {
    const total = Number(calcTotal);
    const qty = Number(calcQty);
    if (!total || !qty || qty <= 0) return null;
    return total / qty;
  }, [calcTotal, calcQty]);

  const applyCalc = () => {
    if (calcResult == null) return;
    setDraft((d) => ({ ...d, cost_per_unit: calcResult.toFixed(4) }));
    setShowCalc(false);
    setCalcTotal('');
    setCalcQty('');
  };

  const startEdit = (i: Ingredient) => {
    setEditingId(i.id);
    setExpenseLaunched('');
    setDraft({
      name: i.name,
      unit: i.unit,
      cost_per_unit: String(i.cost_per_unit),
      stock_quantity: String(i.stock_quantity),
      min_stock: String(i.min_stock),
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setDraft(emptyDraft);
    setLaunchExpense(true);
    setError('');
  };

  const save = async () => {
    setError('');
    setExpenseLaunched('');
    if (!draft.name.trim()) return setError('Informe o nome do insumo.');
    if (!draft.cost_per_unit || Number(draft.cost_per_unit) <= 0)
      return setError(`Informe o valor pago por ${unitLabel(draft.unit)}.`);
    const name = draft.name.trim();
    const payload = {
      name,
      unit: draft.unit,
      cost_per_unit: Number(draft.cost_per_unit) || 0,
      stock_quantity: Number(draft.stock_quantity) || 0,
      min_stock: Number(draft.min_stock) || 0,
    };
    const { error: e } = editingId
      ? await supabase.from('ingredients').update(payload).eq('id', editingId)
      : await supabase.from('ingredients').insert(payload);
    if (e) {
      setError('Erro ao salvar. Tente novamente.');
      return;
    }

    // lança a compra como despesa do mês no Financeiro (categoria Insumos)
    if (launchExpense && purchaseAmount > 0) {
      const now = new Date();
      const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const { error: expErr } = await supabase.from('expenses').insert({
        name: `Compra de insumo — ${name}`,
        category: 'Insumos',
        amount: Math.round(purchaseAmount * 100) / 100,
        competence_month: `${month}-01`,
        due_date: now.toISOString().slice(0, 10),
        paid: true,
        paid_at: now.toISOString(),
      });
      if (!expErr) {
        setExpenseLaunched(
          `Compra de ${brl(purchaseAmount)} lançada no Financeiro (categoria Insumos).`
        );
      }
    }

    cancelEdit();
    await load();
  };

  const toggleActive = async (i: Ingredient) => {
    await supabase.from('ingredients').update({ active: !i.active }).eq('id', i.id);
    await load();
  };

  const remove = async (i: Ingredient) => {
    if (!confirm(`Excluir o insumo "${i.name}"? Ele será removido de qualquer ficha técnica que o utilize.`)) return;
    await supabase.from('ingredients').delete().eq('id', i.id);
    await load();
  };

  const saveMargin = async () => {
    setSavingMargin(true);
    await supabase
      .from('store_settings')
      .update({ default_margin_percent: Number(marginInput) || 0 })
      .eq('id', 1);
    setSavingMargin(false);
    setMarginSaved(true);
    setTimeout(() => setMarginSaved(false), 2500);
  };

  return (
    <div className="max-w-3xl space-y-4">
      <h1 className="text-xl font-bold">Estoque de insumos</h1>

      <GuideCard
        id="estoque"
        title="Como funciona o estoque"
        steps={[
          'Cadastre cada insumo que você compra (carne, pão, molhos...) com o valor pago por kg ou por unidade.',
          'Em Cardápio → Produtos, monte a ficha técnica de cada item: quanto de cada insumo ele usa. O custo e o preço sugerido são calculados na hora.',
          'Quando um pedido é confirmado, o estoque dos insumos baixa sozinho (e volta se o pedido for cancelado).',
          'Comprou mais? Use o botão "+ Compra" no insumo: soma ao estoque, recalcula o custo médio e lança a despesa no Financeiro automaticamente.',
        ]}
      />

      {lowStock.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm">
          <p className="font-semibold text-amber-800">
            ⚠️ {lowStock.length} {lowStock.length === 1 ? 'insumo está' : 'insumos estão'} com estoque baixo
          </p>
          <p className="text-amber-700 text-xs mt-0.5">
            {lowStock.map((i) => `${i.name} (${i.stock_quantity} ${unitLabel(i.unit)})`).join(' · ')}
          </p>
        </div>
      )}

      <div className="card p-4 space-y-3">
        <h3 className="font-semibold">{editingId ? 'Editar insumo' : 'Novo insumo'}</h3>
        <div className="grid sm:grid-cols-2 gap-3">
          <input
            className="input sm:col-span-2"
            placeholder="Nome do insumo — ex.: Carne bovina, Pão de hambúrguer"
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          />
          <label className="text-xs text-neutral-500">
            Comprado por
            <select
              className="input mt-1"
              value={draft.unit}
              onChange={(e) => setDraft({ ...draft, unit: e.target.value as 'un' | 'kg' })}
            >
              <option value="kg">Quilograma (kg)</option>
              <option value="un">Unidade</option>
            </select>
          </label>
          <div>
            <label className="text-xs text-neutral-500 block">
              Valor pago por {unitLabel(draft.unit)} (R$){' '}
              <InfoTip text="É o que VOCÊ paga ao fornecedor, não o preço de venda. É a base do cálculo de custo dos produtos do cardápio." />
              <input
                className="input mt-1"
                type="number"
                step="0.01"
                min="0"
                placeholder="0,00"
                value={draft.cost_per_unit}
                onChange={(e) => setDraft({ ...draft, cost_per_unit: e.target.value })}
              />
            </label>
            {!showCalc ? (
              <button type="button" className="text-xs text-brand font-semibold mt-1" onClick={() => setShowCalc(true)}>
                Não sabe? Calcular pela compra
              </button>
            ) : (
              <div className="mt-2 bg-neutral-50 rounded-lg p-2.5 space-y-1.5">
                <p className="text-xs text-neutral-500">Quanto você pagou e quanto veio?</p>
                <div className="flex items-center gap-1.5 text-xs">
                  <input
                    className="input !py-1.5 !text-xs"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="Total pago (R$)"
                    value={calcTotal}
                    onChange={(e) => setCalcTotal(e.target.value)}
                  />
                  <span className="text-neutral-400 shrink-0">por</span>
                  <input
                    className="input !py-1.5 !text-xs"
                    type="number"
                    step="0.001"
                    min="0"
                    placeholder={`Qtd. (${unitLabel(draft.unit)})`}
                    value={calcQty}
                    onChange={(e) => setCalcQty(e.target.value)}
                  />
                </div>
                {calcResult != null && (
                  <p className="text-xs">
                    = <strong>{brl(calcResult)}</strong> por {unitLabel(draft.unit)}{' '}
                    <button type="button" className="text-brand font-semibold ml-1" onClick={applyCalc}>
                      Usar este valor
                    </button>
                  </p>
                )}
              </div>
            )}
          </div>
          <label className="text-xs text-neutral-500">
            Quantidade em estoque ({unitLabel(draft.unit)})
            <input
              className="input mt-1"
              type="number"
              step="0.001"
              min="0"
              value={draft.stock_quantity}
              onChange={(e) => setDraft({ ...draft, stock_quantity: e.target.value })}
            />
          </label>
          <label className="text-xs text-neutral-500">
            Estoque mínimo ({unitLabel(draft.unit)}){' '}
            <InfoTip text="Quando o estoque chegar neste nível, o insumo aparece com alerta de 'baixo' no topo desta tela. Deixe 0 para não avisar." />
            <input
              className="input mt-1"
              type="number"
              step="0.001"
              min="0"
              value={draft.min_stock}
              onChange={(e) => setDraft({ ...draft, min_stock: e.target.value })}
            />
          </label>
        </div>
        {editingId && (
          <p className="text-xs text-neutral-400 bg-neutral-50 rounded-lg p-2.5">
            💡 Editar é para <strong>correções</strong> (não lança despesa). Comprou mais deste insumo? Use o
            botão <strong>+ Compra</strong> na lista — ele soma ao estoque, recalcula o custo médio e lança no
            Financeiro.
          </p>
        )}
        {purchaseAmount > 0 && (
          <label className="flex items-start gap-2 text-sm bg-neutral-50 rounded-lg p-3 cursor-pointer">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={launchExpense}
              onChange={(e) => setLaunchExpense(e.target.checked)}
            />
            <span>
              Lançar esta compra no <strong>Financeiro</strong>: {brl(purchaseAmount)} na categoria
              &quot;Insumos&quot; ({purchaseQty.toLocaleString('pt-BR')} {unitLabel(draft.unit)} ×{' '}
              {brl(Number(draft.cost_per_unit) || 0)})
            </span>
          </label>
        )}
        {error && <p className="text-sm text-red-500">{error}</p>}
        <div className="flex gap-2">
          {editingId && (
            <button className="border border-neutral-300 rounded-lg px-4 py-2 text-sm font-semibold bg-white" onClick={cancelEdit}>
              Cancelar
            </button>
          )}
          <button className="btn-brand !py-2" onClick={save}>
            {editingId ? 'Salvar alterações' : '+ Adicionar insumo'}
          </button>
        </div>
        {expenseLaunched && <p className="text-sm text-green-600">{expenseLaunched} ✓</p>}
      </div>

      {loading ? (
        <p className="text-neutral-400 py-8 text-center">Carregando...</p>
      ) : (
        <div className="card divide-y divide-neutral-100">
          {ingredients.map((i) => {
            const low = i.active && i.stock_quantity <= i.min_stock && i.min_stock > 0;
            const isBuying = buying?.id === i.id;
            return (
              <div key={i.id}>
                <div className="p-3 flex items-center gap-3 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <p className={`font-medium truncate ${!i.active ? 'text-neutral-400 line-through' : ''}`}>
                      {i.name}
                    </p>
                    <p className="text-sm text-neutral-500">
                      {brl(Number(i.cost_per_unit))} / {unitLabel(i.unit)} · Estoque: {Number(i.stock_quantity).toLocaleString('pt-BR')}{' '}
                      {unitLabel(i.unit)}
                      {low && <span className="text-amber-600 font-semibold ml-1">· baixo</span>}
                    </p>
                  </div>
                  <button
                    onClick={() => (isBuying ? cancelBuy() : startBuy(i))}
                    className="text-xs font-semibold rounded-full px-3 py-1 shrink-0 bg-brand/10 text-brand hover:bg-brand/20"
                  >
                    + Compra
                  </button>
                  <button
                    onClick={() => toggleActive(i)}
                    className={`text-xs font-semibold rounded-full px-3 py-1 shrink-0 ${
                      i.active ? 'bg-green-100 text-green-700' : 'bg-neutral-200 text-neutral-500'
                    }`}
                  >
                    {i.active ? 'Ativo' : 'Pausado'}
                  </button>
                  <button onClick={() => startEdit(i)} className="text-sm font-semibold text-brand px-2 shrink-0">
                    Editar
                  </button>
                  <button onClick={() => remove(i)} className="text-xs text-neutral-400 hover:text-red-500 shrink-0">
                    Excluir
                  </button>
                </div>

                {isBuying && (
                  <div className="mx-3 mb-3 bg-neutral-50 rounded-xl p-3 space-y-2">
                    <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">
                      Registrar compra de {i.name}
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      <label className="text-xs text-neutral-500">
                        Quantidade comprada ({unitLabel(i.unit)})
                        <input
                          className="input mt-1"
                          type="number"
                          step="0.001"
                          min="0"
                          placeholder="0"
                          value={buyQty}
                          onChange={(e) => setBuyQty(e.target.value)}
                        />
                      </label>
                      <label className="text-xs text-neutral-500">
                        Total pago (R$)
                        <input
                          className="input mt-1"
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="0,00"
                          value={buyTotal}
                          onChange={(e) => setBuyTotal(e.target.value)}
                        />
                      </label>
                    </div>
                    {buyNewAvg != null && (
                      <div className="text-sm bg-white rounded-lg p-2.5 border border-neutral-200">
                        <p>
                          Estoque: {Number(i.stock_quantity).toLocaleString('pt-BR')} →{' '}
                          <strong>{buyNewStock.toLocaleString('pt-BR')} {unitLabel(i.unit)}</strong>
                          {' '}· Custo médio: {brl(Number(i.cost_per_unit))} →{' '}
                          <strong>{brl(buyNewAvg)}/{unitLabel(i.unit)}</strong>
                        </p>
                        <p className="text-xs text-neutral-400 mt-0.5">
                          O custo médio pondera o estoque atual com esta compra — os preços sugeridos do cardápio
                          acompanham automaticamente.
                        </p>
                      </div>
                    )}
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <input type="checkbox" checked={buyLaunch} onChange={(e) => setBuyLaunch(e.target.checked)} />
                      Lançar {buyTotalN > 0 ? brl(buyTotalN) : 'a compra'} no Financeiro (categoria Insumos)
                    </label>
                    <div className="flex gap-2">
                      <button
                        className="border border-neutral-300 rounded-lg px-4 py-2 text-sm font-semibold bg-white"
                        onClick={cancelBuy}
                      >
                        Cancelar
                      </button>
                      <button
                        className="btn-brand !py-2"
                        onClick={confirmBuy}
                        disabled={buySaving || buyNewAvg == null}
                      >
                        {buySaving ? 'Registrando...' : 'Registrar compra'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          {ingredients.length === 0 && (
            <p className="p-4 text-sm text-neutral-500">
              Nenhum insumo cadastrado. Cadastre acima os ingredientes que você compra (carnes, pães, molhos...).
            </p>
          )}
        </div>
      )}

      <div className="card p-4 space-y-2">
        <h3 className="font-semibold">
          Margem de lucro padrão{' '}
          <InfoTip text="Margem de 30% significa que 30% do preço de venda é lucro bruto. Ex.: custo R$ 7,00 com margem 30% → preço sugerido R$ 10,00." />
        </h3>
        <p className="text-xs text-neutral-400">
          Usada para sugerir o preço de venda de cada produto do cardápio a partir do custo dos insumos.
          Pode ser sobrescrita individualmente em cada produto.
        </p>
        <div className="flex items-center gap-2">
          <div className="relative w-32">
            <input
              className="input !pr-8"
              type="number"
              step="0.1"
              min="0"
              max="95"
              value={marginInput}
              onChange={(e) => setMarginInput(e.target.value)}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-neutral-400">%</span>
          </div>
          <button className="btn-brand !py-2" onClick={saveMargin} disabled={savingMargin}>
            {savingMargin ? 'Salvando...' : marginSaved ? 'Salvo ✓' : 'Salvar margem'}
          </button>
        </div>
      </div>
    </div>
  );
}
