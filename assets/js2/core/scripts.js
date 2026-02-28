import { state } from './state.js';

const pick = (list) => list[Math.floor(Math.random() * list.length)];
const shuffle = (arr) => { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

/* ── Labels ── */
const TYPE_LABELS = { review: 'Review', unboxing: 'Unboxing', tutorial: 'Tutorial', storytelling: 'Storytelling', reels: 'Reels', tiktok: 'TikTok', depoimento: 'Depoimento', comparativo: 'Comparativo' };
const TONE_LABELS = { leve: 'Leve e direto', engra: 'Engraçado', educativo: 'Educativo', profissional: 'Profissional', emocional: 'Emocional' };
const STRUCTURE_LABELS = { AIDA: 'AIDA (Atenção → Interesse → Desejo → Ação)', PAS: 'PAS (Problema → Agitação → Solução)', BAB: 'BAB (Antes → Depois → Ponte)', storytelling: 'Storytelling (Contexto → Conflito → Resolução)', straight: 'Direto ao ponto' };

/* ── Hook library ── */
const HOOKS = {
  dor: (audience, goal) => `HOOK (0-3s)\n• Dor direta: "${audience} cansou de ${goal}? Olha isso aqui."`,
  intriga: (_, goal) => `HOOK (0-3s)\n• Intriga visual: close no produto + pergunta: "Já imaginou ${goal}?"`,
  autoridade: (_, __, brand) => `HOOK (0-3s)\n• Autoridade: "Testei ${brand} e vou te mostrar o que mudou."`,
  choque: (audience) => `HOOK (0-3s)\n• Choque: "A maioria de vocês (${audience}) tá errando nessa."`,
  curiosidade: (_, goal) => `HOOK (0-3s)\n• Curiosidade: "O segredo pra ${goal} que ninguém tá te contando."`,
  antes_depois: (_, __, brand) => `HOOK (0-3s)\n• Antes/depois: "Antes de ${brand} eu fazia assim... Agora..."`,
  trend: () => `HOOK (0-3s)\n• Trend: Começa com áudio viral + transição pra produto.`,
  pergunta: (audience, goal) => `HOOK (0-3s)\n• Pergunta polêmica: "${audience}, vocês realmente acham que ${goal} é impossível?"`
};
const hookKeys = Object.keys(HOOKS);

/* ── Development blocks ── */
const DEV_BLOCKS = {
  AIDA: (brand, tone, length) => [
    `INTERESSE`,
    `• Mostra o problema em 2-3 cortes rápidos.`,
    `• Apresenta ${brand} como solução.`,
    `• Tom ${tone}, frases curtas, sem enrolação.`,
    ``,
    `DESEJO`,
    `• Benefício principal em destaque.`,
    `• B-roll focado no produto/resultado.`,
    `• Ritmo de ${length} — cortes a cada 3-5s.`
  ],
  PAS: (brand, tone) => [
    `AGITAÇÃO`,
    `• Aprofunda a dor — mostra consequências de não resolver.`,
    `• Tom ${tone}: usa linguagem que o público sente.`,
    ``,
    `SOLUÇÃO`,
    `• Entra com ${brand} de forma natural.`,
    `• 2-3 benefícios rápidos (1 frase cada).`,
    `• Close no momento "aha!".`
  ],
  BAB: (brand) => [
    `ANTES`,
    `• Cena cotidiana sem o produto — frustração real.`,
    ``,
    `DEPOIS`,
    `• Mesmo cenário com ${brand} — resultado claro.`,
    ``,
    `PONTE`,
    `• Explica como chegou do antes ao depois (1-2 frases).`
  ],
  storytelling: (brand, tone) => [
    `CONTEXTO`,
    `• Conta uma mini-história pessoal (max 10s).`,
    `• Tom ${tone} e autêntico.`,
    ``,
    `CONFLITO`,
    `• O problema que enfrentava (dor real).`,
    ``,
    `RESOLUÇÃO`,
    `• Como ${brand} resolveu — transição visual.`,
    `• Reação genuína.`
  ],
  straight: (brand, tone) => [
    `DEMONSTRAÇÃO`,
    `• 3 passos diretos:`,
    `  1. Contexto rápido (1 frase)`,
    `  2. Demonstração clara de ${brand}`,
    `  3. Benefício visível`,
    `• Tom ${tone}, sem rodeios.`
  ]
};

/* ── Proof blocks ── */
const PROOFS = [
  `PROVA SOCIAL\n• Depoimento curto em 1 frase ou print de review real.`,
  `PROVA SOCIAL\n• Número simples (ex: "+42% de tempo salvo", "3x mais eficiente").`,
  `PROVA SOCIAL\n• Antes/depois visual (split-screen se possível).`,
  `PROVA SOCIAL\n• Frase de autoridade ou dado de mercado relevante.`,
  `PROVA SOCIAL\n• "Mais de X pessoas já testaram" ou screenshot de comentários.`
];

/* ── CTA blocks ── */
const CTAS = {
  link: `CTA\n• "Link na bio pra garantir o seu" (urgência leve).`,
  salva: `CTA\n• "Se curtiu, salva e manda pra alguém que precisa."`,
  dm: `CTA\n• "Me manda DM com 'QUERO' que eu te passo tudo."`,
  comenta: `CTA\n• "Comenta 'EU QUERO' que eu te mando o link."`,
  arrasta: `CTA\n• "Arrasta pra cima / clica no link" + reforça benefício principal.`,
  custom: null // filled from settings
};

/* ── Final ── */
const FINALS = [
  `FINAL VISUAL (últimos 3s)\n• Fecha reforçando o benefício principal em 1 linha.\n• Logo/pack-shot do produto.`,
  `FINAL VISUAL (últimos 3s)\n• Mostra o produto + lembrete visual do link.\n• Texto na tela com o benefício-chave.`,
  `FINAL VISUAL (últimos 3s)\n• Pede pra salvar/compartilhar (rápido).\n• End-screen com call-to-action visual.`,
  `FINAL VISUAL (últimos 3s)\n• Reação genuína + frase de impacto.\n• Overlay com @marca e link.`
];

/* ── Sugestão de cortes ── */
const CORTES = [
  `SUGESTÃO DE CORTES\n• Corte 1: Hook (0-3s) — close + texto\n• Corte 2: Contexto (3-8s) — medium shot\n• Corte 3: Produto (8-15s) — B-roll\n• Corte 4: Prova + CTA (15-${'{'}duração{'}'})`,
  `SUGESTÃO DE CORTES\n• Ritmo: corte a cada 2-4s\n• Alternar entre close-up e plano médio\n• Usar texto na tela nos momentos-chave\n• Transições simples (corte seco ou fade rápido)`,
  `SUGESTÃO DE CORTES\n• Corte rápido no hook (2s)\n• Plano sequência no desenvolvimento (5-8s)\n• B-roll intercalado no produto (3-5s)\n• Close no CTA + end-card`
];

/* ── Generate ── */

const generateScript = (payload) => {
  const s = state.settings || {};

  const typeName = TYPE_LABELS[payload.type] || payload.type || 'Vídeo';
  const toneName = TONE_LABELS[s.aiTone || payload.tone] || TONE_LABELS[payload.tone] || payload.tone || 'Leve e direto';
  const structure = s.aiStructure || 'AIDA';
  const structureLabel = STRUCTURE_LABELS[structure] || structure;
  const lengthName = payload.length || '30s';
  const goal = payload.goal || 'gerar mais interesse';
  const audience = payload.audience || 'público geral';
  const brand = payload.brand || 'a marca';
  const ctaCustom = s.aiCta || '';
  const style = s.aiStyle || '';
  const niche = s.niche || '';
  const platforms = Array.isArray(s.platforms) ? s.platforms : [];

  /* System prompt context */
  const systemContext = [
    `SISTEMA DE ROTEIRO MAKERLINE`,
    `Estrutura: ${structureLabel}`,
    ``,
    `CONTEXTO DO CRIADOR:`,
    niche ? `• Nicho: ${niche}` : null,
    platforms.length ? `• Plataformas: ${platforms.join(', ')}` : null,
    style ? `• Estilo/referência: ${style}` : null,
    `• Tom padrão: ${toneName}`,
    ``
  ].filter(Boolean).join('\n');

  /* Hook */
  const hookFn = HOOKS[pick(shuffle(hookKeys))];
  const hookBlock = hookFn(audience, goal, brand);

  /* Development */
  const devFn = DEV_BLOCKS[structure] || DEV_BLOCKS.AIDA;
  const devBlock = devFn(brand, toneName, lengthName).join('\n');

  /* Proof */
  const proofBlock = pick(PROOFS);

  /* CTA */
  let ctaBlock;
  if (ctaCustom) {
    ctaBlock = `CTA\n• ${ctaCustom}`;
  } else {
    const ctaKeys = Object.keys(CTAS).filter(k => k !== 'custom');
    ctaBlock = CTAS[pick(ctaKeys)];
  }

  /* Final */
  const finalBlock = pick(FINALS);

  /* Cortes */
  const cortesBlock = pick(CORTES);

  /* Assembly */
  const output = [
    systemContext,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `ROTEIRO ${typeName.toUpperCase()} — ${brand.toUpperCase()}`,
    `Duração: ${lengthName} | Tom: ${toneName} | Estrutura: ${structure}`,
    `Público: ${audience}`,
    `Objetivo: ${goal}`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    ``,
    hookBlock,
    ``,
    devBlock,
    ``,
    proofBlock,
    ``,
    ctaBlock,
    ``,
    finalBlock,
    ``,
    cortesBlock,
    ``,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `Gerado por Makerline • Estrutura ${structure} • ${new Date().toLocaleDateString('pt-BR')}`
  ].join('\n');

  return output;
};

export { generateScript };
