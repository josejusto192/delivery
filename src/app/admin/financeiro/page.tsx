'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { brl } from '@/lib/format';
import type { Expense, ExpenseTemplate } from '@/lib/types';

type TemplateDraft = { name: string; category: string; amount: string; day_of_month: string };
type ExpenseDraft = { name: string; category: string; amount: string; due_date: string };

const emptyTemplateDraft: TemplateDraft = { name: '', category: '', amount: '', day_of_month: '5' };
const emptyExpenseDraft: ExpenseDraft = { name: '', category: '', amount: '', due_date: '' };

const CATEGORY_SUGGESTIONS = [
  'Insumos',
  'Aluguel',
  'Energia',
  'Água',
  'Internet',
  'Gás',
  'Funcionários',
  'Embalagens',
  'Marketing',
  'Impostos',
  'Manutenção',
  'Outros',
];

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(month: string) {
  const [y, m] = month.split('-').map(Number);
  const label = new Date(y, m - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export default function FinanceiroAdminPage() {
  const supabase = useMemo(() => createClient(), []);
  const [templates, setTemplates] = useState<ExpenseTemplate[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [revenue, setRevenue] = useState<number | null>(null);
  const [month, setMonth] = useState(currentMonth());
  const [loading, setLoading] = useState(true);
  const [templateDraft, setTemplateDraft] = useState<TemplateDraft>(emptyTemplateDraft);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [expenseDraft, setExpenseDraft] = useState<ExpenseDraft>(emptyExpenseDraft);
  const [error, setError] = useState('');
  const [generating, setGenerating] = useState(false);

  const loadTemplates = async () => {
    const { data } = await supabase.from('expense_templates').select('*').order('name');
    setTemplates(data ?? []);
  };

  const loadExpenses = async (m: string) => {
    const [y, mo] = m.split('-').map(Number);
    const monthStart = new Date(y, mo - 1, 1);
    const monthEnd = new Date(y, mo, 1);
    const [{ data }, { data: orders }] = await Promise.all([
      supabase
        .from('expenses')
        .select('*')
        .eq('competence_month', `${m}-01`)
        .order('due_date', { ascending: true, nullsFirst: false }),
      supabase
        .from('orders')
        .select('total, status')
        .gte('created_at', monthStart.toISOString())
        .lt('created_at', monthEnd.toISOString())
        .neq('status', 'canceled')
        .limit(10000),
    ]);
    setExpenses(data ?? []);
    setRevenue((orders ?? []).reduce((s, o) => s + Number(o.total), 0));
    setLoading(false);
  };

  useEffect(() => {
    loadTemplates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadExpenses(month);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month]);

  const startEditTemplate = (t: ExpenseTemplate) => {
    setEditingTemplateId(t.id);
    setTemplateDraft({
      name: t.name,
      category: t.category,
      amount: String(t.amount),
      day_of_month: String(t.day_of_month),
    });
  };

  const cancelTemplateEdit = () => {
    setEditingTemplateId(null);
    setTemplateDraft(emptyTemplateDraft);
    setError('');
  };

  const saveTemplate = async () => {
    setError('');
    if (!templateDraft.name.trim()) return setError('Informe o nome do custo fixo.');
    const payload = {
      name: templateDraft.name.trim(),
      category: templateDraft.category.trim() || 'Outros',
      amount: Number(templateDraft.amount) || 0,
      day_of_month: Math.min(28, Math.max(1, Number(templateDraft.day_of_month) || 5)),
    };
    const { error: e } = editingTemplateId
      ? await supabase.from('expense_templates').update(payload).eq('id', editingTemplateId)
      : await supabase.from('expense_templates').insert(payload);
    if (e) return setError('Erro ao salvar o custo fixo.');
    cancelTemplateEdit();
    await loadTemplates();
  };

  const toggleTemplateActive = async (t: ExpenseTemplate) => {
    await supabase.from('expense_templates').update({ active: !t.active }).eq('id', t.id);
    await loadTemplates();
  };

  const removeTemplate = async (t: ExpenseTemplate) => {
    if (!confirm(`Excluir o custo fixo "${t.name}"? Lançamentos já gerados não serão apagados.`)) return;
    await supabase.from('expense_templates').delete().eq('id', t.id);
    await loadTemplates();
  };

  const generateMonthly = async () => {
    setGenerating(true);
    setError('');
    try {
      const already = new Set(expenses.filter((e) => e.template_id).map((e) => e.template_id));
      const toCreate = templates.filter((t) => t.active && !already.has(t.id));
      if (toCreate.length) {
        const { error: e } = await supabase.from('expenses').insert(
          toCreate.map((t) => ({
            template_id: t.id,
            name: t.name,
            category: t.category,
            amount: t.amount,
            competence_month: `${month}-01`,
            due_date: `${month}-${String(t.day_of_month).padStart(2, '0')}`,
            paid: false,
          }))
        );
        if (e) throw e;
      }
      await loadExpenses(month);
    } catch {
      setError('Erro ao gerar as contas fixas do mês.');
    } finally {
      setGenerating(false);
    }
  };

  const addExpense = async () => {
    setError('');
    if (!expenseDraft.name.trim() || !expenseDraft.amount) return setError('Informe nome e valor da conta.');
    const { error: e } = await supabase.from('expenses').insert({
      name: expenseDraft.name.trim(),
      category: expenseDraft.category.trim() || 'Outros',
      amount: Number(expenseDraft.amount) || 0,
      competence_month: `${month}-01`,
      due_date: expenseDraft.due_date || null,
      paid: false,
    });
    if (e) return setError('Erro ao lançar a conta.');
    setExpenseDraft(emptyExpenseDraft);
    await loadExpenses(month);
  };

  const togglePaid = async (exp: Expense) => {
    await supabase
      .from('expenses')
      .update({ paid: !exp.paid, paid_at: !exp.paid ? new Date().toISOString() : null })
      .eq('id', exp.id);
    await loadExpenses(month);
  };

  const removeExpense = async (exp: Expense) => {
    if (!confirm(`Excluir o lançamento "${exp.name}"?`)) return;
    await supabase.from('expenses').delete().eq('id', exp.id);
    await loadExpenses(month);
  };

  const totalMonth = expenses.reduce((s, e) => s + Number(e.amount), 0);
  const totalPaid = expenses.filter((e) => e.paid).reduce((s, e) => s + Number(e.amount), 0);
  const totalPending = totalMonth - totalPaid;
  const result = (revenue ?? 0) - totalMonth;

  if (loading) {
    return (
      <div className="max-w-3xl space-y-4">
        <h1 className="text-xl font-bold">Financeiro</h1>
        <p className="text-neutral-400 py-8 text-center">Carregando...</p>
      </div>
    );
  }

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="max-w-3xl space-y-4">
      <datalist id="categorias-sugeridas">
        {CATEGORY_SUGGESTIONS.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>

      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-xl font-bold mr-auto">Financeiro</h1>
        <input
          type="month"
          className="input !w-auto !py-1.5"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
        />
      </div>

      {/* 1. resumo do mês */}
      <div className="card p-4">
        <h3 className="font-semibold mb-3">Resultado — {monthLabel(month)}</h3>
        <div className="grid grid-cols-3 gap-1.5 sm:gap-2 text-center">
          <div className="bg-neutral-50 rounded-lg py-3 px-1.5 min-w-0">
            <p className="text-xs text-neutral-500">Faturamento</p>
            <p className="font-bold text-[13px] sm:text-lg mt-0.5">{brl(revenue ?? 0)}</p>
          </div>
          <div className="bg-neutral-50 rounded-lg py-3 px-1.5 min-w-0">
            <p className="text-xs text-neutral-500">Despesas</p>
            <p className="font-bold text-[13px] sm:text-lg mt-0.5">{brl(totalMonth)}</p>
          </div>
          <div className={`rounded-lg py-3 px-1.5 min-w-0 ${result >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
            <p className={`text-xs ${result >= 0 ? 'text-green-700' : 'text-red-600'}`}>
              {result >= 0 ? 'Lucro' : 'Prejuízo'}
            </p>
            <p className={`font-bold text-[13px] sm:text-lg mt-0.5 ${result >= 0 ? 'text-green-700' : 'text-red-600'}`}>
              {brl(result)}
            </p>
          </div>
        </div>
        <p className="text-xs text-neutral-400 mt-2">
          Faturamento = pedidos não cancelados do mês. Despesas = contas pagas e pendentes deste mês
          (incluindo compras de insumos lançadas pelo Estoque).
        </p>
      </div>

      {/* 2. contas do mês — uso diário */}
      <div className="card p-4 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h3 className="font-semibold">Contas de {monthLabel(month)}</h3>
          <div className="flex gap-3 text-sm">
            <span className="text-green-700">
              Pago <strong>{brl(totalPaid)}</strong>
            </span>
            <span className="text-amber-700">
              Pendente <strong>{brl(totalPending)}</strong>
            </span>
          </div>
        </div>

        <div className="bg-neutral-50 rounded-xl p-3 space-y-2">
          <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">Lançar conta</p>
          <div className="grid grid-cols-2 sm:grid-cols-[1fr_10rem] gap-2">
            <input
              className="input col-span-2 sm:col-span-1"
              placeholder="Nome — ex.: Conta de luz"
              value={expenseDraft.name}
              onChange={(e) => setExpenseDraft({ ...expenseDraft, name: e.target.value })}
            />
            <input
              className="input col-span-2 sm:col-span-1"
              placeholder="Categoria"
              list="categorias-sugeridas"
              value={expenseDraft.category}
              onChange={(e) => setExpenseDraft({ ...expenseDraft, category: e.target.value })}
            />
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-neutral-400">R$</span>
              <input
                className="input !pl-9"
                type="number"
                step="0.01"
                min="0"
                placeholder="0,00"
                value={expenseDraft.amount}
                onChange={(e) => setExpenseDraft({ ...expenseDraft, amount: e.target.value })}
              />
            </div>
            <input
              className="input"
              type="date"
              title="Data de vencimento"
              value={expenseDraft.due_date}
              onChange={(e) => setExpenseDraft({ ...expenseDraft, due_date: e.target.value })}
            />
          </div>
          <button className="btn-brand !py-2 w-full sm:w-auto" onClick={addExpense}>
            + Lançar conta
          </button>
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}

        <div className="divide-y divide-neutral-100">
          {expenses.map((exp) => {
            const overdue = !exp.paid && exp.due_date != null && exp.due_date < today;
            return (
              <div key={exp.id} className="py-2.5 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className={`font-medium truncate ${exp.paid ? 'text-neutral-400' : ''}`}>{exp.name}</p>
                  <p className="text-sm text-neutral-500">
                    {brl(Number(exp.amount))} · {exp.category}
                    {exp.due_date && (
                      <span className={overdue ? 'text-red-500 font-semibold' : ''}>
                        {' '}· {overdue ? 'venceu' : 'vence'}{' '}
                        {new Date(`${exp.due_date}T00:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                      </span>
                    )}
                  </p>
                </div>
                <button
                  onClick={() => togglePaid(exp)}
                  title="Clique para alternar entre pago e pendente"
                  className={`text-xs font-semibold rounded-full px-3 py-1 shrink-0 ${
                    exp.paid
                      ? 'bg-green-100 text-green-700'
                      : overdue
                        ? 'bg-red-100 text-red-600'
                        : 'bg-amber-100 text-amber-700'
                  }`}
                >
                  {exp.paid ? 'Pago ✓' : overdue ? 'Vencida' : 'Pendente'}
                </button>
                <button onClick={() => removeExpense(exp)} className="text-xs text-neutral-400 hover:text-red-500 shrink-0">
                  Excluir
                </button>
              </div>
            );
          })}
          {expenses.length === 0 && (
            <p className="py-3 text-sm text-neutral-500">
              Nenhuma conta lançada neste mês. Lance acima ou gere as contas fixas abaixo.
            </p>
          )}
        </div>
      </div>

      {/* 3. custos fixos — configuração */}
      <div className="card p-4 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h3 className="font-semibold">Custos fixos (todo mês)</h3>
            <p className="text-xs text-neutral-400 mt-0.5">
              Aluguel, internet, softwares... Cadastre uma vez e gere as contas do mês com um clique.
            </p>
          </div>
          {templates.some((t) => t.active) && (
            <button className="btn-brand !py-1.5 !px-3 text-sm" onClick={generateMonthly} disabled={generating}>
              {generating ? 'Gerando...' : `Gerar contas de ${monthLabel(month).split(' ')[0]}`}
            </button>
          )}
        </div>

        <div className="divide-y divide-neutral-100">
          {templates.map((t) => (
            <div key={t.id} className="py-2.5 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className={`font-medium truncate ${!t.active ? 'text-neutral-400 line-through' : ''}`}>
                  {t.name}
                </p>
                <p className="text-sm text-neutral-500">
                  {brl(Number(t.amount))} · {t.category} · vence dia {t.day_of_month}
                </p>
              </div>
              <button
                onClick={() => toggleTemplateActive(t)}
                className={`text-xs font-semibold rounded-full px-3 py-1 shrink-0 ${
                  t.active ? 'bg-green-100 text-green-700' : 'bg-neutral-200 text-neutral-500'
                }`}
              >
                {t.active ? 'Ativo' : 'Pausado'}
              </button>
              <button onClick={() => startEditTemplate(t)} className="text-sm font-semibold text-brand px-2 shrink-0">
                Editar
              </button>
              <button onClick={() => removeTemplate(t)} className="text-xs text-neutral-400 hover:text-red-500 shrink-0">
                Excluir
              </button>
            </div>
          ))}
          {templates.length === 0 && <p className="py-3 text-sm text-neutral-500">Nenhum custo fixo cadastrado.</p>}
        </div>

        <div className="bg-neutral-50 rounded-xl p-3 space-y-2">
          <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">
            {editingTemplateId ? 'Editar custo fixo' : 'Novo custo fixo'}
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-[1fr_10rem] gap-2">
            <input
              className="input col-span-2 sm:col-span-1"
              placeholder="Nome — ex.: Aluguel"
              value={templateDraft.name}
              onChange={(e) => setTemplateDraft({ ...templateDraft, name: e.target.value })}
            />
            <input
              className="input col-span-2 sm:col-span-1"
              placeholder="Categoria"
              list="categorias-sugeridas"
              value={templateDraft.category}
              onChange={(e) => setTemplateDraft({ ...templateDraft, category: e.target.value })}
            />
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-neutral-400">R$</span>
              <input
                className="input !pl-9"
                type="number"
                step="0.01"
                min="0"
                placeholder="0,00 por mês"
                value={templateDraft.amount}
                onChange={(e) => setTemplateDraft({ ...templateDraft, amount: e.target.value })}
              />
            </div>
            <label className="text-xs text-neutral-500 flex items-center gap-2">
              Vence dia
              <input
                className="input !w-20"
                type="number"
                min="1"
                max="28"
                value={templateDraft.day_of_month}
                onChange={(e) => setTemplateDraft({ ...templateDraft, day_of_month: e.target.value })}
              />
            </label>
          </div>
          <div className="flex gap-2">
            {editingTemplateId && (
              <button
                className="border border-neutral-300 rounded-lg px-4 py-2 text-sm font-semibold bg-white"
                onClick={cancelTemplateEdit}
              >
                Cancelar
              </button>
            )}
            <button className="btn-brand !py-2" onClick={saveTemplate}>
              {editingTemplateId ? 'Salvar alterações' : '+ Adicionar custo fixo'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
