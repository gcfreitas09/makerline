const generateScript = (payload) => {
  const pick = (list) => list[Math.floor(Math.random() * list.length)];

  const typeName =
    {
      review: 'Review',
      unboxing: 'Unboxing',
      tutorial: 'Tutorial',
      storytelling: 'Storytelling'
    }[payload.type] || payload.type || 'Vídeo';

  const toneName =
    {
      leve: 'Leve e direto',
      engra: 'Engraçado',
      educativo: 'Educativo'
    }[payload.tone] || payload.tone || 'Leve';

  const lengthName = payload.length || '30s';
  const goal = payload.goal || 'gerar mais interesse';
  const audience = payload.audience || 'público geral';
  const brand = payload.brand || 'a marca';

  const hooks = [
    `HOOK (0-3s)\n- Dor direta: "${audience} cansou de ${goal}? Olha isso aqui."`,
    `HOOK (0-3s)\n- Intriga visual: close no produto e pergunta: "já imaginou ${goal}?"`,
    `HOOK (0-3s)\n- Autoridade: "Testei ${brand} e vou te mostrar o que mudou."`
  ];

  const developments = [
    `DESENVOLVIMENTO\n- Mostra o problema em 2 cortes.\n- Em seguida, entra com a solução usando ${brand}.\n- Narra num tom ${toneName} e com frases curtas.`,
    `DESENVOLVIMENTO\n- 3 passos: (1) contexto rápido, (2) demonstração clara, (3) benefício visível.\n- Usa B-roll bem focado no produto.`,
    `DESENVOLVIMENTO\n- Prova social + um dado simples.\n- Mantém o ritmo de ${lengthName} (cortes rápidos e sem enrolar).`
  ];

  const proofs = [
    `PROVA\n- Depoimento curto em 1 frase ou antes/depois.`,
    `PROVA\n- Número simples (ex: "+42% de tempo salvo").`,
    `PROVA\n- Frase de review real (pode ser print).`
  ];

  const ctas = [
    `CTA\n- "Link na bio" ou "clica no link" (urgência leve).`,
    `CTA\n- "Se curtiu, salva e me marca" + reforça benefício.`,
    `CTA\n- "Me manda DM com 'ROTEIRO' que eu te passo o passo a passo."`
  ];

  const outros = [
    `FINAL\n- Fecha reforçando o benefício principal em 1 linha.`,
    `FINAL\n- Mostra o produto + lembrete visual do link/benefício.`,
    `FINAL\n- Pede pra salvar/compartilhar (bem rápido).`
  ];

  return [
    `ROTEIRO ${typeName.toUpperCase()} - ${brand}`,
    `Duração: ${lengthName} | Tom: ${toneName}`,
    `Público: ${audience}`,
    `Objetivo: ${goal}`,
    '',
    pick(hooks),
    pick(developments),
    pick(proofs),
    pick(ctas),
    pick(outros)
  ].join('\n');
};

export { generateScript };
