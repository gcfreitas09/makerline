import { state, saveState } from '../../core/state.js';
import { setScriptOutput, showToast } from '../../core/ui.js?v=20260301g';
import { renderAll } from '../../core/renderers.js';

const copyText = (text, doneMessage) => {
  const value = String(text || '').trim();
  if (!value) return;

  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(value).then(() => showToast(doneMessage));
    return;
  }

  const temp = document.createElement('textarea');
  temp.value = value;
  document.body.appendChild(temp);
  temp.select();
  document.execCommand('copy');
  document.body.removeChild(temp);
  showToast(doneMessage);
};

const openScriptFromHistory = (scriptId) => {
  const script = state.scripts.find((item) => item.id === scriptId);
  if (!script) return;
  state.ui.openScript = scriptId;
  setScriptOutput(script.text);
  saveState();
  renderAll();
};

const copyScriptFromHistory = (scriptId) => {
  const script = state.scripts.find((item) => item.id === scriptId);
  if (!script || !script.text) return;
  copyText(script.text, 'Copiado do histórico.');
};

const copyCurrentScript = () => {
  const output = document.getElementById('script-output');
  if (!output) return;
  copyText(output.textContent, 'Texto copiado.');
};

export { openScriptFromHistory, copyScriptFromHistory, copyCurrentScript };
