const FEEDBACK_ALLOWED_EMAILS = new Set(['fgui3662@gmail.com', 'lorenzo.ritter27@gmail.com']);
const FEEDBACK_MAX_IMAGES = 4;

const escapeHtml = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

const readFileAsDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

const getSessionToken = () => {
  try {
    return sessionStorage.getItem('ugcQuestToken') || localStorage.getItem('ugcQuestSessionToken') || '';
  } catch (error) {
    return '';
  }
};

const getSessionEmail = () => {
  try {
    const value = sessionStorage.getItem('ugcQuestUserEmail') || localStorage.getItem('ugcQuestSessionUserEmail') || '';
    return String(value).trim().toLowerCase();
  } catch (error) {
    return '';
  }
};

const getFeedbackModal = () => ({
  modal: document.getElementById('feedback-modal'),
  form: document.getElementById('feedback-form'),
  message: document.getElementById('feedback-message'),
  imagesInput: document.getElementById('feedback-images'),
  dropzone: document.querySelector('[data-feedback-dropzone]'),
  previews: document.querySelector('[data-feedback-image-previews]'),
  submitBtn: document.getElementById('feedback-submit'),
  msg: document.getElementById('feedback-msg')
});

let feedbackDraftImages = [];

const renderFeedbackImagePreviews = () => {
  const { previews } = getFeedbackModal();
  if (!previews) return;
  previews.innerHTML = feedbackDraftImages
    .map(
      (image, index) => `
        <div class="feedback-image-preview">
          <img src="${image.dataUrl}" alt="${escapeHtml(image.name)}" />
          <button type="button" class="feedback-image-preview-remove" data-feedback-image-remove="${index}" aria-label="Remover imagem">×</button>
        </div>
      `
    )
    .join('');
};

const addFeedbackImageFiles = async (fileList) => {
  const { imagesInput, msg } = getFeedbackModal();
  const files = Array.from(fileList || []).filter((file) => file.type.startsWith('image/'));
  if (!files.length) return;

  const remainingSlots = FEEDBACK_MAX_IMAGES - feedbackDraftImages.length;
  if (remainingSlots <= 0) {
    if (msg) msg.textContent = `Maximo de ${FEEDBACK_MAX_IMAGES} imagens por feedback.`;
    if (imagesInput) imagesInput.value = '';
    return;
  }

  const toAdd = files.slice(0, remainingSlots);
  for (const file of toAdd) {
    try {
      const dataUrl = await readFileAsDataUrl(file);
      feedbackDraftImages.push({ name: file.name, dataUrl });
    } catch (error) {}
  }
  if (imagesInput) imagesInput.value = '';
  renderFeedbackImagePreviews();
};

const handleFeedbackImagesChange = (event) => addFeedbackImageFiles(event.target.files);

const resetFeedbackDraftImages = () => {
  feedbackDraftImages = [];
  const { previews } = getFeedbackModal();
  if (previews) previews.innerHTML = '';
};

const openFeedbackModal = () => {
  const { modal, msg, message } = getFeedbackModal();
  if (!modal) return;
  if (msg) msg.textContent = '';
  modal.classList.add('open');
  modal.setAttribute('aria-hidden', 'false');
  if (message) message.focus();
};

const closeFeedbackModal = () => {
  const { modal, form, msg } = getFeedbackModal();
  if (!modal) return;
  modal.classList.remove('open');
  modal.setAttribute('aria-hidden', 'true');
  if (form) form.reset();
  if (msg) msg.textContent = '';
  resetFeedbackDraftImages();
};

const submitFeedback = async (event) => {
  event.preventDefault();
  const { message, submitBtn, msg } = getFeedbackModal();
  const text = String(message?.value || '').trim();
  if (!text) {
    if (msg) msg.textContent = 'Escreve alguma coisa antes de enviar.';
    return;
  }

  const token = getSessionToken();
  if (!token) {
    if (msg) msg.textContent = 'Sessao invalida. Faz login de novo.';
    return;
  }

  if (submitBtn) submitBtn.disabled = true;
  if (msg) msg.textContent = 'Enviando...';

  try {
    const page = String(document.querySelector('.page-section.active')?.dataset.section || '').trim();
    const images = feedbackDraftImages.map((image) => image.dataUrl);
    const res = await fetch('api/feedback_submit.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, message: text, page, images })
    });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data || data.ok !== true) {
      const error = data && data.error ? String(data.error) : 'Nao consegui enviar agora. Tenta de novo.';
      if (msg) msg.textContent = error;
      return;
    }
    if (msg) msg.textContent = 'Feedback enviado. Valeu!';
    setTimeout(() => closeFeedbackModal(), 900);
  } catch (error) {
    if (msg) msg.textContent = 'Nao consegui enviar agora. Tenta de novo.';
  } finally {
    if (submitBtn) submitBtn.disabled = false;
  }
};

const initFeedbackWidget = () => {
  const openBtn = document.querySelector('[data-action="open-feedback-modal"]');
  if (openBtn && openBtn.dataset.bound !== '1') {
    openBtn.dataset.bound = '1';
    openBtn.addEventListener('click', openFeedbackModal);
  }

  document.querySelectorAll('[data-action="close-feedback-modal"]').forEach((el) => {
    if (el.dataset.bound === '1') return;
    el.dataset.bound = '1';
    el.addEventListener('click', closeFeedbackModal);
  });

  const { form, imagesInput, dropzone, previews } = getFeedbackModal();
  if (form && form.dataset.bound !== '1') {
    form.dataset.bound = '1';
    form.addEventListener('submit', submitFeedback);
  }

  if (imagesInput && imagesInput.dataset.bound !== '1') {
    imagesInput.dataset.bound = '1';
    imagesInput.addEventListener('change', handleFeedbackImagesChange);
  }

  if (dropzone && dropzone.dataset.bound !== '1') {
    dropzone.dataset.bound = '1';
    ['dragenter', 'dragover'].forEach((eventName) => {
      dropzone.addEventListener(eventName, (event) => {
        event.preventDefault();
        dropzone.classList.add('is-dragover');
      });
    });
    ['dragleave', 'dragend'].forEach((eventName) => {
      dropzone.addEventListener(eventName, () => {
        dropzone.classList.remove('is-dragover');
      });
    });
    dropzone.addEventListener('drop', (event) => {
      event.preventDefault();
      dropzone.classList.remove('is-dragover');
      addFeedbackImageFiles(event.dataTransfer?.files);
    });
  }

  if (previews && previews.dataset.bound !== '1') {
    previews.dataset.bound = '1';
    previews.addEventListener('click', (event) => {
      const removeBtn = event.target.closest('[data-feedback-image-remove]');
      if (!removeBtn) return;
      const index = Number(removeBtn.dataset.feedbackImageRemove);
      if (Number.isNaN(index)) return;
      feedbackDraftImages.splice(index, 1);
      renderFeedbackImagePreviews();
    });
  }

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    const { modal } = getFeedbackModal();
    if (modal && modal.classList.contains('open')) closeFeedbackModal();
  });
};

const isFeedbackAdmin = () => FEEDBACK_ALLOWED_EMAILS.has(getSessionEmail());

const formatFeedbackDate = (iso) => {
  const date = new Date(String(iso || ''));
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

let feedbackItemsById = new Map();

const getFeedbackDetailModal = () => ({
  modal: document.getElementById('feedback-detail-modal'),
  name: document.querySelector('[data-feedback-detail-name]'),
  meta: document.querySelector('[data-feedback-detail-meta]'),
  message: document.querySelector('[data-feedback-detail-message]'),
  images: document.querySelector('[data-feedback-detail-images]'),
  deleteBtn: document.querySelector('[data-action="delete-feedback-item"]')
});

const closeFeedbackDetailModal = () => {
  const { modal } = getFeedbackDetailModal();
  if (!modal) return;
  modal.classList.remove('open');
  modal.setAttribute('aria-hidden', 'true');
};

const openFeedbackDetailModal = (id) => {
  const item = feedbackItemsById.get(id);
  if (!item) return;
  const { modal, name, meta, message, images, deleteBtn } = getFeedbackDetailModal();
  if (!modal) return;

  if (name) name.textContent = item.user_name || 'Sem nome';
  if (meta) meta.textContent = `${item.user_email || ''} · ${formatFeedbackDate(item.created_at)}${item.page ? ` · ${item.page}` : ''}`;
  if (message) message.textContent = item.message || '';
  if (images) {
    const list = Array.isArray(item.images) ? item.images : [];
    images.innerHTML = list.map((src) => `<img src="${escapeHtml(src)}" alt="Imagem anexada" />`).join('');
  }
  if (deleteBtn) deleteBtn.dataset.feedbackId = id;

  modal.classList.add('open');
  modal.setAttribute('aria-hidden', 'false');
};

const removeFeedbackItemFromDom = (id) => {
  feedbackItemsById.delete(id);
  const article = document.querySelector(`.feedback-item[data-feedback-id="${id}"]`);
  if (article) article.remove();
  const status = document.querySelector('[data-feedback-status]');
  if (status) {
    const remaining = feedbackItemsById.size;
    status.textContent = remaining
      ? `${remaining} feedback${remaining === 1 ? '' : 's'} recebido${remaining === 1 ? '' : 's'}.`
      : 'Nenhum feedback recebido ainda.';
  }
};

const deleteFeedbackItem = async (id) => {
  if (!id) return;
  if (!window.confirm('Apagar esse feedback? Essa acao nao pode ser desfeita.')) return;

  const token = getSessionToken();
  if (!token) return;

  try {
    const res = await fetch('api/admin_feedback.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, action: 'delete', id })
    });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data || data.ok !== true) return;
    removeFeedbackItemFromDom(id);
    closeFeedbackDetailModal();
  } catch (error) {}
};

const renderFeedbackList = (items) => {
  const list = document.querySelector('[data-feedback-list]');
  const status = document.querySelector('[data-feedback-status]');
  if (!list) return;

  feedbackItemsById = new Map();
  (Array.isArray(items) ? items : []).forEach((item) => {
    if (item && item.id) feedbackItemsById.set(item.id, item);
  });

  if (!Array.isArray(items) || items.length === 0) {
    if (status) status.textContent = 'Nenhum feedback recebido ainda.';
    list.innerHTML = '';
    return;
  }

  if (status) status.textContent = `${items.length} feedback${items.length === 1 ? '' : 's'} recebido${items.length === 1 ? '' : 's'}.`;

  list.innerHTML = items
    .map((item) => {
      const id = escapeHtml(item.id || '');
      const name = escapeHtml(item.user_name || 'Sem nome');
      const email = escapeHtml(item.user_email || '');
      const message = escapeHtml(item.message || '');
      const page = item.page ? escapeHtml(item.page) : '';
      const date = escapeHtml(formatFeedbackDate(item.created_at));
      const images = Array.isArray(item.images) ? item.images : [];
      const thumbs = images.length
        ? `<div class="feedback-item-thumbs">${images
            .slice(0, 4)
            .map((src) => `<img src="${escapeHtml(src)}" alt="Imagem anexada" />`)
            .join('')}</div>`
        : '';
      return `
        <article class="feedback-item" data-feedback-id="${id}">
          <button type="button" class="feedback-item-delete" data-feedback-delete="${id}" aria-label="Apagar feedback">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
              <path d="M3 6h18" />
              <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
            </svg>
          </button>
          <div class="feedback-item-head">
            <strong>${name}</strong>
            <span class="muted">${email}</span>
            <span class="feedback-item-date">${date}</span>
          </div>
          ${page ? `<span class="feedback-item-page">${page}</span>` : ''}
          <p>${message}</p>
          ${thumbs}
        </article>
      `;
    })
    .join('');
};

let feedbackAdminLoaded = false;
let feedbackAdminRequest = null;

const loadFeedbackAdminList = () => {
  const status = document.querySelector('[data-feedback-status]');
  if (window.location.protocol === 'file:') return;
  if (feedbackAdminLoaded || feedbackAdminRequest) return;

  const token = getSessionToken();
  if (!token) return;

  feedbackAdminRequest = fetch('api/admin_feedback.php', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token })
  })
    .then((res) => res.json().catch(() => null).then((data) => ({ res, data })))
    .then(({ res, data }) => {
      if (!res.ok || !data || data.ok !== true) {
        const error = data && data.error ? String(data.error) : 'Nao consegui carregar os feedbacks agora.';
        if (status) status.textContent = error;
        return;
      }
      feedbackAdminLoaded = true;
      renderFeedbackList(data.items);
    })
    .catch(() => {
      if (status) status.textContent = 'Nao consegui carregar os feedbacks agora.';
    })
    .finally(() => {
      feedbackAdminRequest = null;
    });
};

const bindFeedbackAdminInteractions = () => {
  const list = document.querySelector('[data-feedback-list]');
  if (list && list.dataset.bound !== '1') {
    list.dataset.bound = '1';
    list.addEventListener('click', (event) => {
      const deleteBtn = event.target.closest('[data-feedback-delete]');
      if (deleteBtn) {
        deleteFeedbackItem(deleteBtn.dataset.feedbackDelete);
        return;
      }
      const article = event.target.closest('.feedback-item[data-feedback-id]');
      if (article) openFeedbackDetailModal(article.dataset.feedbackId);
    });
  }

  document.querySelectorAll('[data-action="close-feedback-detail-modal"]').forEach((el) => {
    if (el.dataset.bound === '1') return;
    el.dataset.bound = '1';
    el.addEventListener('click', closeFeedbackDetailModal);
  });

  const { deleteBtn } = getFeedbackDetailModal();
  if (deleteBtn && deleteBtn.dataset.bound !== '1') {
    deleteBtn.dataset.bound = '1';
    deleteBtn.addEventListener('click', () => deleteFeedbackItem(deleteBtn.dataset.feedbackId));
  }
};

const initAdminFeedback = () => {
  const navItem = document.querySelector('.nav-item[data-founder-only="1"][data-target="feedback"]');
  const section = document.querySelector('.page-section[data-section="feedback"]');
  const sendWidget = document.querySelector('.sidebar-feedback-btn');

  if (!isFeedbackAdmin()) {
    if (navItem) navItem.remove();
    if (section) section.remove();
    return;
  }

  if (navItem) navItem.hidden = false;
  if (sendWidget) sendWidget.remove();
  bindFeedbackAdminInteractions();
  loadFeedbackAdminList();
};

export { initFeedbackWidget, initAdminFeedback };
