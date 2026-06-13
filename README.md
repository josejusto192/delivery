# Plataforma de Delivery — MVP de Pedidos

Canal próprio de vendas para restaurantes e deliveries: cardápio digital, carrinho, checkout, acompanhamento de pedido em tempo real e painel de gestão. Stack: **Next.js 14 + Supabase**, pronto para deploy no **Coolify** via Docker.

## Funcionalidades (Fase 1)

**Loja (cliente final)**
- Cardápio digital com categorias, busca, destaques e adicionais por produto
- Carrinho com observações por item e cupom de desconto (percentual, valor fixo, frete grátis)
- Checkout: entrega ou retirada, endereço, áreas de entrega com taxa por região, PIX / cartão / dinheiro (com troco)
- Pedido sem login (convidado) ou com conta
- Página de acompanhamento do pedido com atualização automática
- Área do cliente: cadastro, login, recuperação de senha, histórico de pedidos, endereços salvos

**Painel da loja (`/admin`)**
- Pedidos em tempo real (Supabase Realtime) com alerta sonoro para novos pedidos
- Fluxo de status: Novo → Confirmado → Em produção → Pronto → Saiu para entrega → Entregue (+ cancelamento)
- Busca e filtros por status; atalho de WhatsApp do cliente
- CRUD de produtos (com upload de imagem) e grupos de adicionais
- CRUD de categorias com ordenação
- Configurações: nome, logo, cor da marca, abrir/fechar loja, taxa de entrega, pedido mínimo, áreas de entrega

## Como rodar

### 1. Supabase
1. Crie um projeto em [supabase.com](https://supabase.com) (ou use Supabase self-hosted no Coolify).
2. No **SQL Editor**, execute `supabase/migrations/0001_initial.sql`.
3. (Opcional) Execute `0002_seed_demo.sql` para dados de demonstração.
4. Em **Authentication > Providers**, confirme que Email está habilitado. Para testes, desative "Confirm email".

### 2. Local
```bash
cp .env.example .env.local   # preencha com as chaves do Supabase
npm install
npm run dev
```

### 3. Criar o usuário admin
1. Cadastre-se normalmente pelo site (`/conta/entrar` → Cadastre-se).
2. No SQL Editor do Supabase:
```sql
update public.profiles set role = 'admin'
where id = (select id from auth.users where email = 'seu@email.com');
```
3. Acesse `/admin`.

### 4. Deploy no Coolify
1. Suba o repositório para o GitHub/GitLab.
2. No Coolify: **New Resource → Application →** selecione o repositório.
3. Build Pack: **Dockerfile** (já incluso no projeto).
4. Adicione as variáveis de ambiente (marque como *Build Variable* também):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
5. Configure o domínio próprio da loja e faça o deploy.

> Para cada novo cliente: novo projeto Supabase + nova aplicação no Coolify com as variáveis daquele cliente. O núcleo é o mesmo repositório.

## Estrutura

```
src/
  app/                  # rotas (loja, conta, admin)
  components/           # componentes da loja e do admin
  lib/                  # supabase clients, carrinho, tipos, formatação
  middleware.ts         # proteção de rotas (/admin, /conta/*)
supabase/migrations/    # schema do banco + RLS + seed
Dockerfile              # build standalone para Coolify
```

## Próximas fases (roadmap do escopo)
- Módulo PDV (venda balcão/telefone/WhatsApp, caixa)
- CRM com segmentações (novos, recorrentes, VIP, inativos)
- Integração WhatsApp (notificações de status, campanhas)
- Cashback e programa de pontos
- Dashboard financeiro e relatórios
- Integração Asaas (pagamento online)
- Painel Super Admin multi-lojas
