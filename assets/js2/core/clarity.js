/**
 * Microsoft Clarity - gravacao de sessao e mapa de calor.
 *
 * Para ligar: crie o projeto em https://clarity.microsoft.com, copie o Project ID
 * e cole em CLARITY_PROJECT_ID abaixo. Enquanto estiver vazio, este arquivo nao
 * carrega nada e nao faz nenhuma requisicao externa.
 *
 * Privacidade: o Clarity usa a mascara equilibrada configurada no projeto, que
 * protege campos de formulario e dados sensiveis. Nao aplicamos uma mascara no
 * documento inteiro, pois ela deixaria toda a gravacao ilegivel. Para esconder
 * uma area especifica, use data-clarity-mask="true" no elemento correspondente.
 */

const CLARITY_PROJECT_ID = 'xt9kha6vi6';

const isTrackableEnvironment = () => {
  const host = String(window.location.hostname || '').toLowerCase();
  if (!host) return false;
  if (window.location.protocol === 'file:') return false;

  const isLocal = host === 'localhost' || host === '127.0.0.1' || host.endsWith('.local');
  if (!isLocal) return true;

  // Em local o Clarity fica desligado pra nao sujar as metricas com sessao de
  // desenvolvimento. Pra testar mesmo assim, rode no console do navegador:
  //   localStorage.setItem('makerlineClarityLocal', '1')
  try {
    return localStorage.getItem('makerlineClarityLocal') === '1';
  } catch (error) {
    return false;
  }
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

    // O app nao possui banner de cookies proprio. Este sinal permite que o
    // Clarity respeite o consentimento configurado no projeto da Microsoft.
    window.clarity('consent');
  } catch (error) {
    // Analytics nunca pode derrubar o app.
  }
};

/** Identifica a sessao pra cruzar gravacao com usuario no tracker. */
const identifyClarityUser = (userId) => {
  if (!window.clarity) return;
  const safeId = String(userId || '').trim();
  if (!safeId) return;

  try {
    window.clarity('identify', safeId);
  } catch (error) {
    // Silencioso de proposito.
  }
};

export { initClarity, identifyClarityUser, CLARITY_PROJECT_ID };
