import type { LandingContent } from '@/types/domain'

// Textos da landing fixos no código por enquanto, para a página aparecer
// na hora, sem esperar o banco (ver docs/DECISOES.md). Copiados de
// settings.landing_content em produção em 20/10/2026, com os textos sobre China.

export const LANDING: LandingContent = {
  hero: {
    title: 'Mande a foto. A gente acha o preço.',
    subtitle: 'Você diz quanto quer pagar e a gente cota no Brasil ou direto da China, com fabricantes e agentes de compra. A resposta chega no WhatsApp.',
    cta_primary: 'Solicitar cotação',
    cta_secondary: 'Como funciona',
  },
  steps: [
    {
      title: 'Envie a foto e o preço-alvo',
      text: 'Tire uma foto do produto, diga a quantidade e quanto quer pagar por unidade.',
      active: true,
      payment: false,
    },
    {
      title: 'Pague a taxa de cotação',
      text: 'Pix na hora. Assim que confirmamos, seu pedido entra na fila.',
      active: true,
      payment: true,
    },
    {
      title: 'A gente pesquisa',
      text: 'Nossa equipe procura o produto com fornecedores no Brasil e direto com fabricantes na China ou agentes de compra.',
      active: true,
      payment: false,
    },
    {
      title: 'Receba e aprove',
      text: 'A cotação chega no WhatsApp e no e-mail. Você aprova com um toque.',
      active: true,
      payment: false,
    },
  ],
  benefits: [
    { title: 'Menos tempo procurando', text: 'Você manda uma foto e volta ao seu trabalho. A pesquisa fica com a gente.' },
    { title: 'Direto da China', text: 'Cotamos com fabricantes chineses e agentes de compra, sem intermediários a mais no caminho.' },
    { title: 'Resposta rápida', text: 'Prazo claro desde o primeiro minuto, com acompanhamento em tempo real.' },
    { title: 'Tudo registrado', text: 'Pedidos, propostas e aprovações organizados em um só lugar.' },
  ],
  cta_final: {
    title: 'Tem um produto em mente?',
    text: 'Mande a foto agora e receba a cotação no seu WhatsApp.',
    button: 'Solicitar cotação',
  },
}

export const LANDING_ETA = 'em até 48 horas úteis'

export const LANDING_FAQ = [
  {
    id: 'taxa',
    question: 'O que está incluso na taxa de cotação?',
    answer:
      'A pesquisa com fornecedores para cada produto do pedido e uma proposta com preço, prazo e condições. Se você aprovar a compra, a taxa pode ser abatida do total, conforme as condições informadas no pedido.',
  },
  {
    id: 'prazo',
    question: 'Em quanto tempo recebo a cotação?',
    answer: 'Normalmente dentro do prazo informado no formulário. Você acompanha cada etapa pelo link que enviamos no WhatsApp e no e-mail.',
  },
  {
    id: 'preco',
    question: 'E se não encontrarem pelo meu preço?',
    answer: 'Avisamos você com as melhores alternativas encontradas, ou informamos que não foi possível atender ao preço-alvo.',
  },
  {
    id: 'china',
    question: 'Vocês cotam produtos da China?',
    answer:
      'Sim. Além de fornecedores no Brasil, cotamos direto com fabricantes na China ou por agentes de compra. Cada opção da cotação mostra a origem, para você decidir.',
  },
  {
    id: 'estado',
    question: 'Posso pedir produto usado ou seminovo?',
    answer: 'Pode. No pedido, marque os estados que você aceita: novo, 99% novo, seminovo ou usado. A cotação informa o estado de cada opção.',
  },
  {
    id: 'varios',
    question: 'Posso cotar vários produtos?',
    answer: 'Sim. Adicione quantos produtos precisar no mesmo pedido, cada um com suas fotos e seu preço-alvo.',
  },
  {
    id: 'recebo',
    question: 'Como recebo a cotação?',
    answer: 'Por WhatsApp e por e-mail, com um link para ver os detalhes e aprovar a compra em poucos toques.',
  },
]
