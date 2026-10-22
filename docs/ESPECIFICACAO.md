# Especificação do produto — Cotaí (plataforma de cotação B2B)

> Documento-fonte do projeto. O Claude Code deve seguir esta especificação junto com o `CLAUDE.md` da raiz e o `docs/MARCA.md`.

---

## 1. CONTEXTO DO PROJETO

Crie uma aplicação web completa chamada **Cotaí**: uma plataforma de **cotação de produtos para clientes B2B**.

**Sobre o nome:** escreve-se sempre **Cotaí**, com acento no "í", em textos, logo e título da página. O nome vem de "cota aí", o jeito informal de pedir uma cotação no WhatsApp. Em URLs, slugs, nomes de arquivo, e-mails e identificadores de código, use `cotai`, sem acento. O logotipo **já existe** e está em `brand/svg/`: use os arquivos SVG (nunca recrie o logo em texto). Regras de uso em `docs/MARCA.md`.

O dono do negócio vende para empresas (B2B). Os clientes dele precisam de produtos e querem saber se ele consegue encontrar esses produtos por um preço específico. Hoje esse processo é desorganizado e acontece pelo WhatsApp. A plataforma precisa organizar tudo.

**Como funciona:**
1. O cliente B2B entra na landing page e faz um **pedido de cotação**: envia **foto(s) do produto**, uma descrição, a quantidade e o **preço-alvo** (quanto quer pagar por unidade).
2. Cada pedido pode cobrar uma **taxa de cotação**. **Não existe valor fixo no código:** o valor, a forma de cobrança e até se haverá cobrança são definidos pelo administrador no **Painel de Administração** (seção 10.9). Nenhum valor monetário pode estar escrito "na mão" em textos, botões ou componentes; tudo vem da tabela `settings`.
3. O pedido vira automaticamente uma **tarefa de cotação** no painel interno.
4. Um **cotador** (membro da equipe) pega a tarefa, pesquisa fornecedores e preenche a cotação: preço encontrado, fornecedor, prazo, condições e observações.
5. O cliente **recebe a cotação por e-mail e por WhatsApp**, com um link para uma página pública da cotação.
6. Na página da cotação, o cliente pode **aprovar ou recusar**. Uma cotação aprovada vira uma **tarefa de compra**.

O sistema precisa ser **simples, rápido e organizado**. Não queremos um ERP complexo.

---

## 2. STACK E REQUISITOS TÉCNICOS

> Detalhes de ambiente, comandos e estrutura de pastas estão no `CLAUDE.md`.

- React + Vite + TypeScript + Tailwind CSS + shadcn/ui
- **Supabase** para autenticação, banco Postgres, Storage (fotos) e Edge Functions
- React Router para as rotas
- React Hook Form + Zod para formulários e validação
- TanStack Query para busca e cache de dados
- date-fns com locale pt-BR
- lucide-react para ícones
- Toda a interface em **português do Brasil**
- Valores em **R$**, formatados com `Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })`
- Datas no formato dd/MM/yyyy HH:mm, fuso America/Sao_Paulo
- **Totalmente responsivo**: a landing e o formulário precisam funcionar perfeitamente no celular, já que a maioria dos clientes vai acessar pelo WhatsApp

---

## 3. DESIGN — ESTILO APPLE, SEM "CARA DE IA"

**Regra principal:** o design deve parecer feito por um designer de produto, inspirado nas **Human Interface Guidelines da Apple** (apple.com, iCloud.com, apps nativos do macOS/iOS). **NÃO** deve parecer um template genérico gerado por IA.

### ❌ PROIBIDO (padrões típicos de "site feito por IA")
- Gradientes roxo/azul/rosa, fundos com "blobs" ou "glow" coloridos
- Emojis decorativos em títulos, badges com ✨ 🚀 ⚡
- Texto com gradiente (`bg-clip-text`)
- Grade de 3 ou 4 cards idênticos com ícone em círculo colorido + título + texto (o clássico "features grid")
- Sombras pesadas, glassmorphism exagerado e bordas neon
- Ilustrações 3D genéricas e imagens de banco de imagem de "pessoas sorrindo no escritório"
- Títulos clichês ("Revolucione", "Potencialize", "Transforme seu negócio", "O futuro de...")
- Seção de "depoimentos" falsos ou números inventados ("+10.000 clientes")
- Animações em tudo e elementos flutuando sem motivo

### ✅ PRINCÍPIOS (Apple HIG)
- **Clareza:** o conteúdo é o protagonista; a interface some. Cada tela tem um único objetivo óbvio
- **Deferência:** pouquíssima decoração, sem bordas e sombras desnecessárias. Use o espaço em branco e a tipografia para criar hierarquia, não caixas e cores
- **Profundidade sutil:** camadas discretas (sheets, popovers, modais com blur leve de fundo), transições suaves e curtas que explicam de onde as coisas vêm e para onde vão

### Tipografia
- **PROIBIDO usar qualquer fonte serifada** (Playfair Display, Merriweather, Lora, DM Serif, Fraunces, Instrument Serif, Georgia, Times etc.), em **nenhum** lugar: nem em títulos, nem em citações, nem em números, nem em destaques "elegantes" em itálico. **Também é proibido misturar sans-serif com serifa.** Todo o sistema usa **apenas uma família sans-serif**
- Nada de fontes "display" decorativas nem monoespaçadas como enfeite (monoespaçada só para códigos como `COT-000123`, se necessário)
- Fonte: pilha do sistema Apple, com fallback para Inter:
  `font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "Inter", "Helvetica Neue", sans-serif;`
- Títulos grandes, pesados e com letter-spacing negativo (estilo apple.com): hero com 56–72px no desktop e 36–40px no mobile, `font-weight: 600`, `letter-spacing: -0.02em` a `-0.03em`, `line-height: 1.05`
- Corpo de texto com 17px (o tamanho padrão da Apple), line-height 1.5, cor secundária para textos de apoio
- Escala tipográfica inspirada nos estilos dinâmicos do iOS: Large Title 34 / Title 28 / Title 2 22 / Headline 17 semibold / Body 17 / Callout 16 / Subheadline 15 / Footnote 13 / Caption 12
- Use números tabulares (`font-variant-numeric: tabular-nums`) em valores, preços e tabelas

### Cores (estilo sistema Apple)
- Fundo: `#FFFFFF` e `#F5F5F7` (o cinza clássico da apple.com) alternando entre as seções
- Texto primário `#1D1D1F`, secundário `#6E6E73`, terciário `#86868B`
- Separadores: `rgba(0,0,0,0.08)`, com 1px
- **Uma única cor de destaque:** verde Cotaí `#00A878` (botão primário, ícones ativos, anel de foco, acento do logo). Para links e textos verdes pequenos, use `#00875F` (contraste AA). Nada de segunda cor de marca competindo
- Cores semânticas apenas para os status, em tons do sistema iOS e com fundo bem suave (badge = texto colorido sobre o fundo da mesma cor com ~12% de opacidade): verde `#34C759` (status aprovado; não confundir com a cor da marca), laranja `#FF9500`, vermelho `#FF3B30`, amarelo `#FFCC00`, índigo `#5856D6`, cinza `#8E8E93`
- **Modo escuro** de verdade (não só inverter): fundo `#000000` / `#1C1C1E` / `#2C2C2E`, texto `#F5F5F7`, verde `#2BC48F`. Respeitar `prefers-color-scheme` e oferecer uma alternância no painel

### Componentes
- **Botão primário:** pill (`rounded-full`), verde `#00A878`, texto branco 19px bold (exigência de contraste com o verde; ver `docs/MARCA.md`), padding generoso, sem sombra; hover `#008F66`
- **Botão secundário:** apenas texto verde (`#00875F`) com seta "›" (o padrão "Saiba mais ›" da Apple) ou pill com fundo `#F5F5F7`
- **Inputs:** altura de 44px no mínimo (alvo de toque da HIG), `rounded-xl`, fundo `#F5F5F7` sem borda; no foco, anel verde de 3–4px com opacidade suave. Labels acima, pequenas e em cinza
- **Cards:** `rounded-2xl` (18–22px), fundo branco sobre `#F5F5F7` **ou** separados só por espaço, sem bordas visíveis. Sombra, quando houver, quase imperceptível (`0 1px 2px rgba(0,0,0,0.04)`)
- **Listas no painel:** no estilo "inset grouped" do iOS: grupos arredondados, linhas separadas por hairlines, chevron "›" à direita
- **Controles segmentados** (segmented control estilo iOS) para alternar visões (Kanban/Lista, filtros de status), em vez de abas com sublinhado
- **Modais:** no desktop, sheets centralizadas; no mobile, **bottom sheets** que sobem de baixo, com alça de arraste e fundo com blur (`backdrop-blur`) e escurecimento leve
- **Sidebar do painel:** estilo da barra lateral do macOS (Finder/Mail): fundo translúcido levemente acinzentado, ícones SF-like finos (lucide com `strokeWidth={1.75}`), item ativo com fundo cinza arredondado, não um bloco colorido
- **Toolbar/header:** translúcida com `backdrop-blur-xl` e fundo `rgba(255,255,255,0.72)`, fixa no topo, com hairline embaixo
- **Ícones:** lucide-react, finos, monocromáticos, na cor do texto. Nunca dentro de círculos coloridos
- **Estados vazios:** um ícone grande e fino em cinza, um título curto e uma frase. Sem ilustração cartunesca

### Logotipo e ícones
- Logo principal: `brand/svg/cotai-wordmark-cor.svg` (fundo claro) e `cotai-wordmark-reverso.svg` (fundo escuro). Transformar em componente React `<Logo variant="cor|reverso|preto|branco" />` com o SVG inline
- Símbolo "ć": `brand/svg/cotai-simbolo-*.svg`, usado em espaços pequenos (sidebar recolhida, avatar, loading)
- Favicon, ícones PWA e `site.webmanifest` já estão em `public/`; inserir o conteúdo de `brand/head-snippet.html` no `<head>` do `index.html`
- **Nunca** colocar o símbolo ao lado do nome (fica "ć cotaí", com o "c" repetido): ou um, ou outro
- O logo enviado pelo admin no Painel de Administração substitui o padrão nas páginas públicas e nos e-mails; sem upload, usar o logo do Cotaí

### Movimento
- Transições de 200–350ms com easing tipo spring (`cubic-bezier(0.25, 0.1, 0.25, 1)`); use Framer Motion só onde ajuda a entender (abrir sheet, mover card no kanban, trocar de etapa no formulário)
- Na landing, apenas um fade + leve subida ao rolar nas seções, uma vez e de forma discreta
- Respeitar `prefers-reduced-motion`

### Landing page — direção visual
- Estrutura no estilo de página de produto da apple.com: seções em largura total, alternando fundo branco e `#F5F5F7`, conteúdo centralizado com largura máxima de ~980px, muito respiro vertical (120–160px entre seções no desktop)
- Hero: título enorme, uma linha de subtítulo em cinza, dois CTAs lado a lado ("Solicitar cotação" em pill verde + "Como funciona ›" como link). Abaixo, uma **imagem real do produto**: um mockup limpo do celular mostrando a tela da cotação pronta (renderize a própria interface do app dentro de um frame de iPhone feito com CSS), não ilustração
- "Como funciona": passos numerados grandes (1, 2, 3, 4 em tipografia fina e enorme), em layout editorial alternado (texto de um lado, mini-captura da interface do outro), **não** uma grade de cards com ícones
- Textos curtos, diretos e humanos, em português natural. Exemplo de título: "Mande a foto. A gente acha o preço." Subtítulo: "Você diz quanto quer pagar, nossa equipe pesquisa os fornecedores e te responde no WhatsApp."
- O FAQ em lista simples com hairlines e "+" que gira para "×" ao abrir

### Painel interno — direção visual
- Sensação de app nativo do macOS: denso, mas calmo; muito cinza neutro e o verde só onde há ação
- Kanban com colunas de fundo `#F5F5F7` e cards brancos `rounded-xl`, sem bordas; o card que está sendo arrastado ganha uma sombra suave e escala 1.02
- Tabelas com linhas altas (52px), hairlines, cabeçalho em cinza 13px uppercase com tracking leve, e hover com fundo cinza bem leve
- Números e valores em tabular-nums, alinhados à direita

---

## 4. ESTRUTURA DE ROTAS

### Públicas
| Rota | Página |
|---|---|
| `/` | Landing page |
| `/cotar` | Formulário de pedido de cotação |
| `/pedido/:codigo` | Acompanhamento do pedido (status), acessado por link único |
| `/cotacao/:token` | Página da cotação pronta, com botões Aprovar / Recusar |
| `/login` | Login da equipe |

### Painel interno (protegido, requer login)
| Rota | Página |
|---|---|
| `/painel` | Dashboard com resumo |
| `/painel/tarefas` | Kanban de tarefas de cotação |
| `/painel/tarefas/:id` | Detalhe do pedido e preenchimento da cotação |
| `/painel/compras` | Kanban de tarefas de compra (cotações aprovadas) |
| `/painel/clientes` | Lista de clientes e histórico |
| `/painel/clientes/:id` | Detalhe do cliente |
### Painel de Administração (somente admin) — `/painel/admin/*`
| Rota | Página |
|---|---|
| `/painel/admin` | Visão geral da administração (atalhos e status das integrações) |
| `/painel/admin/empresa` | Dados da empresa e marca |
| `/painel/admin/cobranca` | Taxa de cotação, modelo de cobrança, Pix e cupons |
| `/painel/admin/cotacao` | Regras de cotação (SLA, validade, limites, campos do formulário) |
| `/painel/admin/landing` | Textos da landing page e perguntas frequentes |
| `/painel/admin/mensagens` | Templates de e-mail e WhatsApp |
| `/painel/admin/integracoes` | E-mail, WhatsApp e gateway de pagamento |
| `/painel/admin/equipe` | Usuários e permissões |
| `/painel/admin/categorias` | Categorias de produto e unidades de medida |
| `/painel/admin/fornecedores` | Cadastro de fornecedores |
| `/painel/admin/logs` | Log de auditoria e de notificações |

---

## 5. LANDING PAGE (`/`)

Seções, nesta ordem:

1. **Header** fixo: logo "Cotaí", links âncora (Como funciona, Vantagens, Perguntas frequentes), botão "Fazer cotação" e um link discreto "Área da equipe" para `/login`.
2. **Hero:** título forte, por exemplo "Encontramos o produto que sua empresa precisa, pelo preço que você quer pagar". Subtítulo explicando que basta enviar a foto e o preço-alvo. Botão principal "Solicitar cotação". Se a cobrança estiver ativa e a configuração "Mostrar valor na landing" estiver ligada, o botão exibe o valor atual da taxa vindo de `settings` (ex.: "Solicitar cotação — R$ {{taxa}}"); caso contrário, mostra só o texto.
3. **Como funciona**, em 4 passos com ícones:
   1. Envie a foto e o preço-alvo
   2. Pague a taxa de cotação
   3. Nossa equipe pesquisa fornecedores
   4. Receba a cotação no WhatsApp e no e-mail
4. **Vantagens:** economia de tempo, rede de fornecedores, resposta rápida, tudo registrado e organizado.
5. **Perguntas frequentes** (accordion): "O que está incluso na taxa de cotação?", "Em quanto tempo recebo a cotação?", "E se não encontrarem pelo meu preço?", "Posso cotar vários produtos?", "Como recebo a cotação?".
6. **CTA final**, com o botão "Solicitar cotação".
7. **Footer** com contato (WhatsApp e e-mail, configuráveis) e direitos reservados.

**Todos os textos da landing** (título, subtítulo, passos, vantagens, perguntas frequentes, prazo, contato) vêm da tabela `settings` / `faq_items` e são editáveis no Painel de Administração. Use os textos acima apenas como valores iniciais do seed. Os passos que falam de pagamento só aparecem se a cobrança estiver ativa.

---

## 6. STATUS E FLUXO

### Status do pedido de cotação (`quote_requests.status`)
| Status | Rótulo | Cor |
|---|---|---|
| `aguardando_pagamento` | Aguardando pagamento | cinza |
| `novo` | Novo | azul |
| `em_cotacao` | Em cotação | amarelo |
| `cotado` | Cotado (pronto para enviar) | roxo |
| `enviado` | Enviado ao cliente | índigo |
| `aprovado` | Aprovado | verde |
| `recusado` | Recusado | vermelho |
| `nao_encontrado` | Não encontrado | laranja |
| `cancelado` | Cancelado | cinza-escuro |

**Fluxo:**
`aguardando_pagamento → novo → em_cotacao → cotado → enviado → aprovado | recusado`
Também é possível ir de `em_cotacao` para `nao_encontrado`, que envia uma mensagem ao cliente explicando que não foi encontrado pelo preço.

Se a cobrança estiver desativada nas configurações, o pedido nasce direto como `novo`.

### Status da tarefa de compra (`purchase_tasks.status`)
`a_comprar → comprado → em_transito → entregue` (mais `cancelado`)

Toda mudança de status deve ser registrada na tabela `status_history`.

---

## 7. FORMULÁRIO DE COTAÇÃO (`/cotar`)

Formulário em **etapas** (stepper), pensado para o celular:

**Etapa 1 — Seus dados**
- Nome completo (obrigatório)
- Empresa (obrigatório)
- CNPJ (opcional, com máscara 00.000.000/0000-00)
- WhatsApp (obrigatório, máscara (00) 00000-0000, salvar no formato E.164 +55...)
- E-mail (obrigatório, validado)
- Se o e-mail ou o WhatsApp já existirem, reaproveitar o cliente existente na tabela `customers`

**Etapa 2 — Produto(s)**
- Permitir **adicionar vários produtos** no mesmo pedido (botão "+ Adicionar outro produto"). Para cada produto:
  - Foto(s): upload de 1 a 5 imagens, com arrastar e soltar e câmera no celular (`accept="image/*" capture`), preview em miniatura, compressão no cliente antes do upload (máximo de 1600px, ~80% de qualidade) e limite de 10 MB por arquivo
  - Nome ou descrição do produto (obrigatório)
  - Link de referência (opcional)
  - Quantidade (obrigatório, inteiro ≥ 1)
  - Unidade (un, cx, kg, m, par, pct)
  - **Preço-alvo por unidade em R$** (obrigatório, máscara de moeda)
  - Observações (cor, tamanho, marca, especificações)
- Mostrar o total-alvo calculado (quantidade × preço-alvo)

**Etapa 3 — Resumo e pagamento**
- Resumo de tudo o que foi preenchido
- Taxa de cotação calculada conforme o **modelo de cobrança** escolhido no Painel de Administração (ver 10.9): gratuita, valor fixo por pedido, valor por produto, ou faixas por quantidade de produtos. Se for gratuita, a etapa vira apenas "Resumo" e o botão vira "Enviar pedido"
- Se houver **cupom de desconto** ativo, mostrar o campo "Tenho um cupom"
- Checkbox obrigatório "Li e concordo com os termos", com um modal de termos
- Botão "Confirmar e pagar"
- Pagamento via **Pix**: exibir o QR Code e o código copia-e-cola gerados por uma Edge Function (ver seção 12). Enquanto a integração não estiver configurada, exibir a **chave Pix fixa** da tabela de configurações e a mensagem "Assim que confirmarmos o pagamento, sua cotação entra na fila", e a equipe confirma o pagamento manualmente no painel

**Após enviar:**
- Gerar um código legível para o pedido: `COT-000123` (sequencial)
- Tela de sucesso com o código, o link `/pedido/:codigo` e o botão "Falar no WhatsApp"
- Disparar e-mail e WhatsApp de confirmação para o cliente
- Disparar notificação para a equipe (e-mail do admin)

---

## 8. PÁGINA DE ACOMPANHAMENTO (`/pedido/:codigo`)

- Acesso pelo código do pedido junto com um token aleatório na URL (`/pedido/COT-000123?t=xxxx`), para que ninguém consiga ver pedidos alheios
- Exibe uma timeline do status, os produtos enviados (com fotos) e o prazo estimado
- Quando a cotação estiver pronta, exibe o botão "Ver cotação"

---

## 9. PÁGINA DA COTAÇÃO (`/cotacao/:token`)

- Layout bonito, tipo proposta comercial, que funcione bem para imprimir ou salvar em PDF (botão "Baixar PDF" usando `window.print` com CSS de impressão)
- Cabeçalho com logo, código do pedido, data e validade da cotação
- Para cada produto:
  - Foto enviada pelo cliente
  - Preço-alvo × **preço encontrado**, com um destaque visual: verde se ficou abaixo ou igual ao alvo, laranja se ficou acima, mostrando a diferença em R$ e em %
  - Quantidade, subtotal, prazo de entrega, condições de pagamento e observações
  - Pode haver **mais de uma opção por produto** (opção A, B, C), e o cliente escolhe uma
- Total geral
- Botões **"Aprovar cotação"** e **"Recusar"**. Recusar abre um campo para o motivo
- Ao aprovar: muda o status para `aprovado`, cria automaticamente a(s) `purchase_tasks`, notifica a equipe e exibe a mensagem "Recebemos sua aprovação, entraremos em contato"
- Após a data de validade, os botões ficam desabilitados com o aviso "Cotação expirada — solicite atualização"

---

## 10. PAINEL INTERNO

### 10.1 Login (`/login`)
- E-mail e senha (Supabase Auth). Sem cadastro público: os usuários são criados pelo admin
- Recuperação de senha

### 10.2 Layout do painel
- Sidebar com: Dashboard, Tarefas de cotação, Compras, Clientes e, separada por um divisor, a seção **Administração** (visível só para admin), que abre o painel da seção 10.9
- Topbar com busca global (por código, cliente ou produto), um sininho de notificações (novos pedidos) e o avatar com menu
- No mobile, a sidebar vira um drawer

### 10.3 Dashboard (`/painel`)
- Cards: Novos hoje, Em cotação, Aguardando pagamento, Enviados aguardando resposta, Aprovados no mês, Taxa de aprovação (%) e **Receita de taxas no mês** (R$)
- Gráfico de barras com pedidos por dia nos últimos 30 dias (Recharts)
- Lista "Atrasados": pedidos em `novo` ou `em_cotacao` há mais tempo que o SLA configurado (padrão de 24h), destacados em vermelho
- Lista "Minhas tarefas" do usuário logado

### 10.4 Kanban de cotação (`/painel/tarefas`)
- Colunas por status: Aguardando pagamento · Novo · Em cotação · Cotado · Enviado · Aprovado · Recusado/Não encontrado
- **Arrastar e soltar** entre colunas (@dnd-kit), validando as transições permitidas
- Cada card mostra: miniatura da primeira foto, código, nome do cliente e da empresa, nº de produtos, preço-alvo total, responsável (avatar), tempo desde a criação (fica vermelho se estourar o SLA) e uma tag de prioridade
- Filtros: responsável, prioridade, período, "somente meus" e busca
- Alternância entre a visão **Kanban** e a visão **Lista** (tabela ordenável)
- Atualização em tempo real via Supabase Realtime, para que um pedido novo apareça sem recarregar a página

### 10.5 Detalhe da tarefa (`/painel/tarefas/:id`)
Layout em duas colunas.

**Coluna esquerda — o pedido:**
- Dados do cliente, com botões "Abrir WhatsApp" (link wa.me) e "Copiar e-mail"
- Galeria de fotos de cada produto com lightbox e zoom, mais o botão de baixar
- Descrição, quantidade, preço-alvo e observações
- Status do pagamento, com o botão "Confirmar pagamento manualmente" (registra quem confirmou e quando)

**Coluna direita — a cotação:**
- Seletor de **responsável** e de **prioridade** (baixa, normal, alta, urgente)
- Botão "Assumir tarefa", que define o usuário atual como responsável e muda o status para `em_cotacao`
- Para cada produto, um formulário de **opções de cotação** (pode adicionar várias):
  - Fornecedor (texto com autocomplete a partir dos fornecedores já usados)
  - Contato do fornecedor (opcional, **interno**, nunca aparece para o cliente)
  - **Preço de custo** (interno) e **preço de venda ao cliente**. Mostrar a margem calculada em R$ e % (somente interno)
  - Prazo de entrega (dias)
  - Condição de pagamento
  - Frete (incluso / à parte, com valor)
  - Observações para o cliente
  - Notas internas
  - Marcar como "não encontrado" para esse produto
- Validade da cotação (padrão de 7 dias, configurável)
- Mensagem geral para o cliente
- Botões:
  - "Salvar rascunho"
  - "Marcar como cotado"
  - **"Enviar ao cliente"**: abre um modal com o preview do e-mail e da mensagem de WhatsApp, com checkboxes [x] E-mail e [x] WhatsApp, e o botão Confirmar. Ao confirmar, chama a Edge Function de envio e muda o status para `enviado`
  - "Não encontrado": abre um modal com a mensagem para o cliente e envia

**Abaixo, nas abas:**
- **Comentários internos** da equipe, com @menção a usuários
- **Histórico**: timeline de todas as mudanças de status e envios (`status_history` + `notifications_log`)

### 10.6 Kanban de compras (`/painel/compras`)
- Colunas: A comprar · Comprado · Em trânsito · Entregue
- Card com produto, fornecedor escolhido, quantidade, valor, cliente e responsável
- Detalhe com campos: data da compra, nº do pedido no fornecedor, código de rastreio, previsão de entrega e anexos (nota fiscal / comprovante)
- Opcional: ao mudar para "Em trânsito" ou "Entregue", oferecer avisar o cliente por WhatsApp

### 10.7 Clientes (`/painel/clientes`)
- Tabela com nome, empresa, WhatsApp, e-mail, nº de pedidos, nº de aprovados, total aprovado (R$) e último pedido
- Detalhe com os dados editáveis, o histórico completo de pedidos e notas internas

### 10.8 Permissões
Papéis padrão: `admin` (acesso total, inclusive Administração), `cotador` (tarefas de cotação e compras, sem Administração e sem ver receita), `comprador` (somente compras). As permissões de cada papel são editáveis em **Administração → Equipe** (ver 10.9.8).

### 10.9 PAINEL DE ADMINISTRAÇÃO (`/painel/admin`) — somente admin

Área separada dentro do painel, com navegação própria no estilo **Ajustes do macOS / iOS**: lista de seções à esquerda (ícone fino + nome) e o conteúdo à direita em **grupos "inset grouped"** (cada grupo com título pequeno em cinza, linhas separadas por hairline, controles alinhados à direita). No mobile, a lista de seções vira a primeira tela e cada seção abre em uma nova tela com botão "‹ Administração".

**Regras gerais do painel de administração:**
- Toda alteração é salva com o botão **"Salvar"** fixo no rodapé da seção, que só fica ativo quando há mudanças. Ao tentar sair com alterações não salvas, perguntar "Descartar alterações?"
- Toda alteração gera um registro em `audit_log` (quem, quando, o campo, valor anterior e novo)
- As mudanças refletem **imediatamente** na landing, no formulário e no painel (invalidar o cache do TanStack Query e usar Realtime em `settings`)
- Validação com Zod em todos os campos; valores monetários com máscara de R$ e sempre ≥ 0
- **Nenhum valor de negócio pode ficar fixo no código.** Se algo precisa ser ajustável pelo dono, ele deve estar aqui

#### 10.9.1 Visão geral (`/painel/admin`)
- Cards de status: Cobrança (ativa/inativa e modelo atual), E-mail, WhatsApp e Pagamento (configurado / não configurado / com erro)
- Atalhos para as seções e lista das últimas 10 alterações do `audit_log`

#### 10.9.2 Empresa e marca (`/painel/admin/empresa`)
- Nome da empresa, nome exibido no site, CNPJ, endereço (opcional)
- Logo (upload, com versão para fundo claro e para fundo escuro) e favicon
- WhatsApp de contato, e-mail de contato, horário de atendimento
- Redes sociais (opcional)
- E-mail(s) que recebem as notificações internas da equipe (lista)

#### 10.9.3 Cobrança (`/painel/admin/cobranca`)
- **Cobrança ativa** (switch). Desligado = cotação gratuita, sem etapa de pagamento
- **Modelo de cobrança** (segmented control):
  - **Valor fixo por pedido** — campo "Valor da taxa (R$)"
  - **Valor por produto** — campo "Valor por produto (R$)" + "Valor máximo por pedido (R$, opcional)"
  - **Faixas** — tabela editável: "de X a Y produtos = R$ Z" (adicionar/remover linhas)
- **Momento da cobrança:** "Antes de cotar" (o pedido só entra na fila depois de pago) ou "Depois de cotar" (o cliente paga para liberar a visualização da cotação)
- **Abater a taxa na compra** (switch): se o cliente aprovar a cotação, o valor da taxa é descontado do total. Mostrar isso ao cliente na página da cotação
- **Mostrar o valor na landing** (switch)
- **Formas de pagamento aceitas:** Pix automático (gateway), Pix manual (chave), cartão (se o gateway suportar)
- **Pix manual:** chave Pix, tipo da chave, nome do recebedor, instrução exibida ao cliente
- **Prazo para pagamento** (horas). Pedido não pago após esse prazo vai para `cancelado` automaticamente
- **Cupons de desconto** (tabela): código, tipo (% ou R$), valor, validade, limite de usos, usos realizados, ativo/inativo
- **Isentar clientes específicos** (busca de cliente + switch "Cliente isento de taxa")
- Preview ao vivo: "Um pedido com 3 produtos custaria R$ X"

#### 10.9.4 Regras de cotação (`/painel/admin/cotacao`)
- SLA de atendimento (horas) e o texto de prazo exibido ao cliente
- Validade padrão da cotação (dias)
- Máximo de produtos por pedido e máximo de fotos por produto
- Tamanho máximo de cada foto (MB)
- **Campos do formulário:** para cada campo opcional (CNPJ, link de referência, unidade, observações, categoria), escolher "Oculto / Opcional / Obrigatório"
- Número máximo de opções (A, B, C...) por produto
- Margem mínima de alerta (%): no detalhe da tarefa, avisar o cotador se a margem ficar abaixo desse valor
- Distribuição automática de tarefas: "Manual" ou "Rodízio entre cotadores ativos"
- Prioridade padrão dos novos pedidos
- Termos de uso (editor de texto simples) exibidos no formulário

#### 10.9.5 Landing page (`/painel/admin/landing`)
- Título, subtítulo e textos dos botões do hero
- Os passos de "Como funciona" (editar, reordenar com arrastar, ativar/desativar)
- Vantagens (editar, reordenar)
- **Perguntas frequentes** (tabela `faq_items`): pergunta, resposta, ordem, ativo
- Texto do CTA final
- Imagem de compartilhamento (Open Graph), título e descrição para SEO
- Botão "Ver site" que abre a landing em nova aba

#### 10.9.6 Mensagens (`/painel/admin/mensagens`)
- Lista de todos os eventos (pedido recebido, pagamento confirmado, cotação pronta, não encontrado, aprovação recebida, lembrete de pagamento, status da compra; e os internos: novo pedido, aprovada, recusada)
- Para cada evento: switch **E-mail** e switch **WhatsApp**, editor do assunto/corpo do e-mail e do texto do WhatsApp
- Chips clicáveis com as variáveis disponíveis (`{{nome}}`, `{{empresa}}`, `{{codigo}}`, `{{link}}`, `{{total}}`, `{{taxa}}`, `{{validade}}`, `{{prazo}}`, `{{mensagem}}`) que inserem a variável no cursor
- Preview ao vivo com dados de exemplo, no formato de bolha do WhatsApp e no formato de e-mail
- Botão "Restaurar padrão" por template
- **Lembretes automáticos:** enviar lembrete de pagamento após X horas; lembrete de cotação não respondida após X dias (com switches)

#### 10.9.7 Integrações (`/painel/admin/integracoes`)
- **E-mail (Resend):** remetente (nome e e-mail), status, botão "Enviar e-mail de teste"
- **WhatsApp:** provedor (Z-API / Evolution / Meta / Nenhum — usar link wa.me), status da conexão, botão "Enviar mensagem de teste" para um número informado
- **Pagamento:** provedor (Asaas / Mercado Pago / AbacatePay / Nenhum — Pix manual), ambiente (sandbox / produção), status, URL do webhook para copiar
- **As chaves secretas (tokens, API keys) NÃO ficam no banco nem no front-end:** ficam nos Secrets do Supabase. Esta tela apenas mostra se cada secret está configurado (✓ / ✗, via Edge Function `integration-status`) e explica qual secret cadastrar

#### 10.9.8 Equipe (`/painel/admin/equipe`)
- Listar usuários (avatar, nome, e-mail, papel, ativo, último acesso)
- Convidar por e-mail, editar papel, desativar/reativar, reenviar convite
- **Matriz de permissões** editável por papel (linhas = ações, colunas = papéis, células = switch): ver receita, ver custo e margem, confirmar pagamento, enviar cotação, excluir pedido, gerenciar compras, gerenciar clientes, acessar Administração (só admin, não editável)
- Impedir que o último admin seja removido ou rebaixado

#### 10.9.9 Categorias e unidades (`/painel/admin/categorias`)
- Categorias de produto (nome, ativo, ordem), usadas no formulário e nos filtros
- Unidades de medida (un, cx, kg, m, par, pct...), editáveis

#### 10.9.10 Fornecedores (`/painel/admin/fornecedores`)
- Cadastro: nome, contato, WhatsApp, e-mail, site, categorias atendidas, observações, ativo
- Usado no autocomplete do detalhe da tarefa; mostrar quantas cotações e compras cada um já teve

#### 10.9.11 Logs (`/painel/admin/logs`)
- **Auditoria:** tabela do `audit_log` com filtros por usuário, seção e período
- **Notificações:** tabela do `notifications_log` com canal, destinatário, status e erro; botão "Reenviar" nas que falharam
- Exportar CSV

---

## 11. BANCO DE DADOS (Supabase / Postgres)

Crie as tabelas abaixo, com `id uuid default gen_random_uuid()`, `created_at` e `updated_at` (com trigger):

```
profiles
  id (= auth.users.id), full_name, avatar_url, role ('admin'|'cotador'|'comprador'), active bool

customers
  id, name, company, cnpj, whatsapp (E.164), email, notes

quote_requests
  id, code (text único, 'COT-000123' via sequence), public_token (text único, aleatório),
  customer_id → customers, status (enum da seção 6), priority ('baixa'|'normal'|'alta'|'urgente'),
  assigned_to → profiles, fee_amount numeric, payment_status ('pendente'|'pago'|'isento'|'estornado'),
  payment_method, payment_id, paid_at, paid_confirmed_by → profiles,
  customer_message text, valid_until date, sent_at, responded_at, decline_reason text

quote_items
  id, request_id → quote_requests, name, description, reference_url, quantity int, unit,
  target_price numeric, notes, not_found bool default false, position int

quote_item_photos
  id, item_id → quote_items, storage_path, position

quote_options
  id, item_id → quote_items, label ('A','B','C'), supplier_name, supplier_contact (interno),
  cost_price numeric (interno), sale_price numeric, lead_time_days int, payment_terms,
  freight_included bool, freight_value numeric, customer_notes, internal_notes,
  selected_by_customer bool default false

purchase_tasks
  id, request_id, item_id, option_id, status ('a_comprar'|'comprado'|'em_transito'|'entregue'|'cancelado'),
  assigned_to → profiles, purchased_at, supplier_order_number, tracking_code,
  expected_delivery date, notes

purchase_attachments
  id, purchase_task_id, storage_path, file_name

comments
  id, request_id, author_id → profiles, body, mentions uuid[]

status_history
  id, entity_type ('quote'|'purchase'), entity_id, from_status, to_status, changed_by → profiles (nullable p/ ações do cliente), note

notifications_log
  id, request_id, channel ('email'|'whatsapp'), recipient, template, status ('enviado'|'falhou'), error, payload jsonb

settings  (linha única; NENHUM valor monetário fixo como default — o seed pode deixar a cobrança desativada)
  -- empresa
  company_name, display_name, cnpj, address, logo_light_path, logo_dark_path, favicon_path,
  contact_whatsapp, contact_email, business_hours, social_links jsonb, team_notification_emails text[],
  -- cobrança
  charge_enabled bool default false,
  fee_model ('fixo_pedido'|'por_produto'|'faixas'),
  fee_fixed numeric, fee_per_item numeric, fee_per_item_max numeric, fee_tiers jsonb,
  charge_moment ('antes'|'depois'), deduct_fee_on_purchase bool, show_fee_on_landing bool,
  payment_methods text[], pix_key, pix_key_type, pix_receiver_name, pix_instructions,
  payment_deadline_hours int,
  -- regras de cotação
  sla_hours int, eta_text, default_validity_days int, max_items_per_request int,
  max_photos_per_item int, max_photo_mb int, form_fields_config jsonb, max_options_per_item int,
  min_margin_alert numeric, assignment_mode ('manual'|'rodizio'), default_priority, terms_text,
  -- landing
  landing_content jsonb, seo_title, seo_description, og_image_path,
  -- mensagens
  email_templates jsonb, whatsapp_templates jsonb, notification_toggles jsonb, reminders_config jsonb,
  -- integrações (somente escolhas, nunca segredos)
  email_from_name, email_from_address, whatsapp_provider, payment_provider, payment_env

coupons
  id, code (único, case-insensitive), discount_type ('percent'|'fixed'), value numeric,
  valid_until, max_uses int, used_count int, active bool

fee_exempt_customers
  customer_id → customers (pk)

faq_items
  id, question, answer, position int, active bool

categories
  id, name, position, active

units
  id, code, label, active

suppliers
  id, name, contact_name, whatsapp, email, website, category_ids uuid[], notes, active

role_permissions
  role, permission, allowed bool   (pk: role + permission)

audit_log
  id, user_id → profiles, section, entity, entity_id, field, old_value jsonb, new_value jsonb
```

**Storage buckets:**
- `product-photos` (privado, acesso por signed URLs)
- `purchase-attachments` (privado)
- `branding` (público, para a logo)

**RLS (Row Level Security) — obrigatório em todas as tabelas:**
- Usuários autenticados e ativos leem e escrevem conforme o papel e a matriz `role_permissions` (funções `has_role()` e `can()` com `security definer`)
- Somente `admin` escreve em `settings`, `coupons`, `faq_items`, `categories`, `units`, `role_permissions`; `audit_log` é somente leitura para admin e só recebe inserções por trigger
- A landing lê os dados públicos de `settings` por uma view `public_settings` que expõe apenas campos não sensíveis
- `comprador` só acessa `purchase_tasks` e `purchase_attachments`, e lê o básico de `quote_requests`
- **O público (anon) NÃO acessa as tabelas diretamente.** A criação do pedido, a consulta por token e a aprovação/recusa passam por **Edge Functions** ou por **funções RPC `security definer`** que validam o `public_token`
- As colunas internas (`cost_price`, `supplier_contact`, `internal_notes`) **nunca** podem ser retornadas para as rotas públicas. Crie uma view ou RPC pública que exponha apenas os campos permitidos

**Seed:** um usuário admin inicial; uma linha em `settings` com a **cobrança desativada** (o admin define o valor no primeiro acesso), textos iniciais da landing, FAQ, unidades e templates de mensagem já preenchidos; matriz de permissões padrão.

**Primeiro acesso do admin:** se a empresa ainda não estiver configurada, mostrar um assistente curto (3 passos: Empresa → Cobrança → Contato/WhatsApp) antes de liberar o painel.

---

## 12. EDGE FUNCTIONS (Supabase)

1. **`create-quote-request`** (pública): recebe os dados do formulário, cria ou reaproveita o cliente, cria o pedido, os itens e as fotos (o upload é feito antes, via signed upload URL, por uma função auxiliar `get-upload-url`), gera o `code` e o `public_token`, define o status inicial conforme `charge_enabled` e dispara as notificações de "pedido recebido". Inclui proteção básica contra spam (honeypot e rate limit por IP/telefone).
2. **`create-pix-charge`**: gera a cobrança Pix via **Asaas** ou **Mercado Pago** (provedor escolhido pela variável `PAYMENT_PROVIDER`) e retorna o QR code e o copia-e-cola. Com a **AbacatePay**, cria um checkout hospedado (Pix, cartão e boleto) e retorna a `checkout_url`; o cliente paga lá e volta para a página de acompanhamento. Se não houver chave configurada, retorna o modo manual.
3. **`payment-webhook`**: recebe a confirmação do provedor, marca o pedido como pago, muda o status para `novo` e notifica a equipe.
4. **`send-quote`** (autenticada): monta a mensagem a partir dos templates e envia por e-mail e/ou WhatsApp, grava em `notifications_log` e atualiza o status.
5. **`public-quote`** (pública): retorna os dados da cotação pelo token (somente campos públicos) e processa aprovar/recusar, criando as `purchase_tasks` na aprovação.
6. **`send-test-notification`** (admin): envia um teste de e-mail ou WhatsApp.
7. **`calculate-fee`** (pública): calcula a taxa de um pedido a partir das regras de `settings`, do número de produtos, do cupom e da isenção do cliente. O formulário e o `create-quote-request` usam essa mesma função, para que o valor nunca seja calculado só no front-end.
8. **`integration-status`** (admin): informa quais secrets estão configurados, sem nunca retornar o valor deles.
9. **`expire-unpaid`** (agendada, a cada hora): cancela pedidos não pagos após o prazo e envia os lembretes configurados.

**E-mail:** use **Resend** (secret `RESEND_API_KEY`, remetente em `EMAIL_FROM`). E-mails em HTML responsivo, com a logo, o resumo e o botão para o link.

**WhatsApp:** crie uma camada de adaptador (`sendWhatsApp(to, message, mediaUrl?)`) que suporte, conforme a variável `WHATSAPP_PROVIDER`:
- `zapi` (Z-API: `ZAPI_INSTANCE`, `ZAPI_TOKEN`, `ZAPI_CLIENT_TOKEN`)
- `evolution` (Evolution API: `EVOLUTION_URL`, `EVOLUTION_KEY`, `EVOLUTION_INSTANCE`)
- `meta` (WhatsApp Cloud API oficial: `META_TOKEN`, `META_PHONE_ID`)
- Se nenhum estiver configurado, **não falhar**: registrar no log como "não configurado". No painel, oferecer o botão "Enviar pelo meu WhatsApp", que abre `https://wa.me/<numero>?text=<mensagem codificada>` com a mensagem pronta

Se um canal falhar, o outro deve continuar. Mostrar um toast com o resultado de cada canal.

---

## 13. TEMPLATES DE MENSAGEM PADRÃO

**WhatsApp — pedido recebido:**
```
Olá, {{nome}}! 👋
Recebemos seu pedido de cotação *{{codigo}}*.
Nossa equipe já vai começar a pesquisar. Prazo: {{prazo}}.
Acompanhe aqui: {{link}}
```

**WhatsApp — cotação pronta:**
```
Olá, {{nome}}! Sua cotação *{{codigo}}* está pronta ✅
Total: *{{total}}*
Válida até {{validade}}.
Veja os detalhes e aprove por aqui: {{link}}
```

**WhatsApp — não encontrado:**
```
Olá, {{nome}}. Sobre o pedido *{{codigo}}*: infelizmente não encontramos o produto pelo preço-alvo informado.
{{mensagem}}
Qualquer dúvida, é só responder esta mensagem.
```

Criar os equivalentes em e-mail (assunto e corpo HTML) para: pedido recebido, pagamento confirmado, cotação pronta, não encontrado e aprovação recebida. Para a equipe: novo pedido, cotação aprovada e cotação recusada.

---

## 14. REQUISITOS DE QUALIDADE

- Estados de **loading** (skeletons), **vazio** (ilustração e texto amigável) e **erro** em todas as listas e páginas
- Toasts (sonner) para o feedback das ações
- Confirmação antes de ações destrutivas (cancelar, recusar, excluir)
- Validação com Zod e mensagens de erro em português
- Máscaras de telefone, CNPJ e moeda
- Imagens com lazy loading
- Acessibilidade: labels nos inputs, foco visível e contraste adequado
- SEO na landing: title, meta description, Open Graph (imagem de compartilhamento para o WhatsApp) e favicon
- Código organizado em `components/`, `pages/`, `hooks/`, `lib/` (supabase client, formatadores, validações) e `types/`
- Tipos TypeScript gerados a partir do schema do Supabase
- Nada de dados mockados no fluxo final: tudo lendo e gravando no Supabase

---

## 15. ORDEM DE CONSTRUÇÃO SUGERIDA

1. Configurar o Supabase: tabelas, RLS, buckets, seed e auth
2. Landing page
3. Formulário `/cotar` com upload de fotos e a Edge Function `create-quote-request`
4. Login e layout do painel
5. Kanban de cotação e detalhe da tarefa (preenchimento da cotação)
6. Página pública da cotação com aprovar/recusar
7. Envio por e-mail (Resend) e WhatsApp (adaptador e fallback wa.me)
8. Pagamento Pix (manual primeiro, depois a integração)
9. Kanban de compras
10. Dashboard e clientes
11. **Painel de Administração completo** (seção 10.9) — mas a tabela `settings` e a leitura das configurações devem existir desde o passo 1, para que nada seja fixado no código

---

## 16. CRITÉRIOS DE ACEITE

- [ ] Um cliente consegue, pelo celular, enviar um pedido com 2 produtos e fotos em menos de 2 minutos
- [ ] O pedido aparece no kanban em tempo real, sem recarregar a página
- [ ] Um cotador consegue assumir, preencher a cotação com 2 opções e enviar
- [ ] O cliente recebe o e-mail (e o WhatsApp, se configurado) com o link
- [ ] O cliente aprova pela página pública, e uma tarefa de compra é criada automaticamente
- [ ] Os campos internos (custo, contato do fornecedor, notas internas) **nunca** aparecem nas páginas públicas
- [ ] Um usuário `comprador` não consegue acessar a Administração nem ver margens
- [ ] Não existe nenhum valor de taxa escrito no código: alterar o valor ou o modelo de cobrança no Painel de Administração reflete imediatamente na landing e no formulário
- [ ] Desligar a cobrança remove a etapa de pagamento e as menções a valor no site
- [ ] Um cupom válido aplica o desconto; um inválido mostra erro
- [ ] Editar um texto da landing ou um template de mensagem no admin muda o site/mensagem sem deploy
- [ ] Toda alteração na Administração aparece no log de auditoria
- [ ] Nenhum token ou chave secreta aparece no front-end ou no banco
- [ ] Todo o sistema funciona bem em telas de 360px
