/**
 * Microsoft Clarity - gravacao de sessao e mapa de calor.
 *
 * Para ligar: crie o projeto em https://clarity.microsoft.com, copie o Project ID
 * e cole em CLARITY_PROJECT_ID abaixo. Enquanto estiver vazio, este arquivo nao
 * carrega nada e nao faz nenhuma requisicao externa.
 *
 * Privacidade: o app mostra valores de pagamento, contatos de marcas e e-mails.
 * Por isso o Clarity sobe em modo mascarado por padrao (mask: true), que substitui
 * o texto por blocos na gravacao. Continua dando pra ver onde a pessoa clicou, onde
 * travou e onde deu "rage click", que e o que interessa pra achar atrito de UX,
 * sem expor dado de cliente. Marque com data-clarity-unmask="true" o que puder
 * aparecer legivel (rotulos de UI, titulos de secao).
 */

const CLARITY_PROJECT_ID = '';

const isTrackableEnvironment = () => {
  const host = String(window.location.hostname || '').toLowerCase();
  if (!host) return false;
  if (host === 'localhost' || host === '127.0.0.1' || host.endsWith('.local')) return false;
  if (window.location.protocol === 'file:') return false;
  return true;
};

const initClarity = () => {
  const projectId = String(CLARITY_PROJECT_ID || '').trim();
  if (!projectId) return;
  if (!isTrackableEnvironment()) return;
  if (window.clarity) return;

  try {
    (function (c, l, a, r, i, t, y) {
      c[a] =
        c[a] ||
        function () {
          (c[a].q = c[a].q || []).push(arguments);
        };
      t = l.createElement(r);
      t.async = 1;
      t.src = 'https://www.clarity.ms/tag/' + i;
      y = l.getElementsByTagName(r)[0];
      y.parentNode.insertBefore(t, y);
    })(window, document, 'clarity', 'script', projectId);

    // Mascara o conteudo por padrao: a gravacao mostra layout e interacao,
    // mas nao o texto real de valores, contatos e e-mails.
    window.clarity('consent');
    window.clarity('set', 'mask', 'true');
  } catch (error) {
    // Analytics nunca pode derrubar o app.
  }
};

/** Identifica a sessao pra cruzar gravacao com usuario no tracker. */
const identifyClarityUser = (userId, userEmail) => {
  if (!window.clarity) return;
  const safeId = String(userId || '').trim();
  if (!safeId) return;

  try {
    window.clarity('identify', safeId);
    const safeEmail = String(userEmail || '').trim().toLowerCase();
    if (safeEmail) window.clarity('set', 'userEmail', safeEmail);
  } catch (error) {
    // Silencioso de proposito.
  }
};

export { initClarity, identifyClarityUser, CLARITY_PROJECT_ID };
