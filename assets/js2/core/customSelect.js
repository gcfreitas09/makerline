// Mobile custom select with viewport-safe dropdown positioning.
// Applies to single-select elements on mobile, unless opted out with:
// <select data-native-mobile="1">

(() => {
  const MOBILE_BREAKPOINT = 768;
  const VIEWPORT_GUTTER = 8;
  const DROPDOWN_OFFSET = 4;
  const MAX_DROPDOWN_HEIGHT = 320;

  const instances = new Set();
  const selectToInstance = new WeakMap();

  let openInstance = null;
  let observer = null;
  let hydrateQueued = false;

  const isMobile = () => window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`).matches;

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

  const isEligibleSelect = (select) => {
    if (!(select instanceof HTMLSelectElement)) return false;
    if (select.multiple) return false;
    if (Number(select.size || 0) > 1) return false;
    if (select.dataset.nativeMobile === '1') return false;
    return true;
  };

  const getSelectedLabel = (select) => {
    const option = select.options[select.selectedIndex] || select.options[0];
    if (!option) return '';
    return String(option.textContent || option.label || '').trim();
  };

  const closeDropdown = (instance) => {
    if (!instance || !instance.isOpen) return;
    instance.isOpen = false;
    instance.dropdown.style.display = 'none';
    instance.dropdown.setAttribute('aria-hidden', 'true');
    instance.display.setAttribute('aria-expanded', 'false');
    if (openInstance === instance) openInstance = null;
  };

  const closeOpenDropdown = () => {
    if (!openInstance) return;
    closeDropdown(openInstance);
  };

  const syncDisplayState = (instance) => {
    const label = getSelectedLabel(instance.select);
    instance.display.textContent = label;
    instance.display.title = label;

    const disabled = instance.select.disabled || instance.select.options.length === 0;
    instance.display.classList.toggle('is-disabled', disabled);
    instance.display.setAttribute('aria-disabled', disabled ? 'true' : 'false');
    if (disabled) closeDropdown(instance);
  };

  const syncDropdownOptions = (instance) => {
    const { select, dropdown } = instance;
    dropdown.innerHTML = '';

    Array.from(select.options).forEach((option, index) => {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'custom-select-option';
      item.dataset.value = option.value;
      item.dataset.index = String(index);
      item.setAttribute('role', 'option');

      if (option.disabled) {
        item.classList.add('disabled');
        item.disabled = true;
      }

      if (option.selected) {
        item.classList.add('selected');
        item.setAttribute('aria-selected', 'true');
      } else {
        item.setAttribute('aria-selected', 'false');
      }

      const text = document.createElement('span');
      text.className = 'custom-select-option-text';
      text.textContent = String(option.textContent || option.label || '').trim();
      item.appendChild(text);

      item.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (option.disabled) return;

        const prevValue = select.value;
        select.value = option.value;

        if (select.value !== prevValue) {
          select.dispatchEvent(new Event('change', { bubbles: true }));
        } else {
          select.dispatchEvent(new Event('change', { bubbles: true }));
        }

        syncDisplayState(instance);
        syncDropdownOptions(instance);
        closeDropdown(instance);
      });

      dropdown.appendChild(item);
    });
  };

  const positionDropdown = (instance) => {
    const { display, dropdown } = instance;
    const viewportW = Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0);
    const viewportH = Math.max(document.documentElement.clientHeight || 0, window.innerHeight || 0);
    const rect = display.getBoundingClientRect();

    let width = rect.width;
    const maxWidth = Math.max(140, viewportW - VIEWPORT_GUTTER * 2);
    width = Math.min(width, maxWidth);

    let left = rect.left;
    left = clamp(left, VIEWPORT_GUTTER, viewportW - VIEWPORT_GUTTER - width);

    dropdown.style.display = 'block';
    dropdown.style.visibility = 'hidden';
    dropdown.style.left = `${left}px`;
    dropdown.style.width = `${width}px`;
    dropdown.style.maxHeight = `${MAX_DROPDOWN_HEIGHT}px`;

    const desiredHeight = Math.min(dropdown.scrollHeight, MAX_DROPDOWN_HEIGHT);
    const spaceBelow = Math.max(0, viewportH - rect.bottom - VIEWPORT_GUTTER);
    const spaceAbove = Math.max(0, rect.top - VIEWPORT_GUTTER);
    const shouldOpenUp = spaceBelow < Math.min(desiredHeight, 180) && spaceAbove > spaceBelow;

    const availableSpace = shouldOpenUp ? spaceAbove : spaceBelow;
    const calculatedHeight = Math.min(desiredHeight, availableSpace);
    const maxHeight = clamp(calculatedHeight, 48, MAX_DROPDOWN_HEIGHT);

    let top = shouldOpenUp
      ? rect.top - maxHeight - DROPDOWN_OFFSET
      : rect.bottom + DROPDOWN_OFFSET;

    top = clamp(top, VIEWPORT_GUTTER, viewportH - VIEWPORT_GUTTER - maxHeight);

    dropdown.style.top = `${top}px`;
    dropdown.style.maxHeight = `${maxHeight}px`;
    dropdown.style.visibility = 'visible';
  };

  const openDropdown = (instance) => {
    if (!instance) return;
    if (instance.display.classList.contains('is-disabled')) return;

    closeOpenDropdown();
    syncDisplayState(instance);
    syncDropdownOptions(instance);

    instance.isOpen = true;
    openInstance = instance;
    instance.dropdown.setAttribute('aria-hidden', 'false');
    instance.display.setAttribute('aria-expanded', 'true');

    positionDropdown(instance);

    const selected = instance.dropdown.querySelector('.custom-select-option.selected');
    if (selected) {
      try {
        selected.scrollIntoView({ block: 'nearest' });
      } catch (e) {}
    }
  };

  const createOrGetWrapper = (select) => {
    const parent = select.parentElement;
    if (parent && parent.classList.contains('custom-select')) {
      return { wrapper: parent, generated: false };
    }

    const wrapper = document.createElement('div');
    wrapper.className = 'custom-select';
    wrapper.dataset.customSelectGenerated = '1';
    select.parentNode.insertBefore(wrapper, select);
    wrapper.appendChild(select);
    return { wrapper, generated: true };
  };

  const initSelect = (select) => {
    if (!isEligibleSelect(select)) return;
    if (selectToInstance.has(select)) return;

    const { wrapper, generated } = createOrGetWrapper(select);
    wrapper.classList.add('custom-select-ready');

    const display = document.createElement('button');
    display.type = 'button';
    display.className = 'custom-select-display';
    display.setAttribute('aria-haspopup', 'listbox');
    display.setAttribute('aria-expanded', 'false');

    const dropdown = document.createElement('div');
    dropdown.className = 'custom-select-dropdown';
    dropdown.setAttribute('role', 'listbox');
    dropdown.setAttribute('aria-hidden', 'true');
    dropdown.style.display = 'none';

    select.classList.add('custom-select-native');

    wrapper.appendChild(display);
    document.body.appendChild(dropdown);

    const instance = {
      select,
      wrapper,
      display,
      dropdown,
      generatedWrapper: generated,
      isOpen: false
    };

    const onDisplayClick = (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (instance.isOpen) {
        closeDropdown(instance);
      } else {
        openDropdown(instance);
      }
    };

    const onDisplayKeyDown = (event) => {
      const key = event.key;
      if (key === 'Enter' || key === ' ') {
        event.preventDefault();
        if (instance.isOpen) closeDropdown(instance);
        else openDropdown(instance);
        return;
      }

      if (key === 'ArrowDown' || key === 'ArrowUp') {
        event.preventDefault();
        openDropdown(instance);
      }
    };

    const onSelectChange = () => {
      syncDisplayState(instance);
      syncDropdownOptions(instance);
    };

    display.addEventListener('click', onDisplayClick);
    display.addEventListener('keydown', onDisplayKeyDown);
    select.addEventListener('change', onSelectChange);

    instance.onDisplayClick = onDisplayClick;
    instance.onDisplayKeyDown = onDisplayKeyDown;
    instance.onSelectChange = onSelectChange;

    selectToInstance.set(select, instance);
    instances.add(instance);

    syncDisplayState(instance);
    syncDropdownOptions(instance);
  };

  const destroyInstance = (instance) => {
    if (!instance) return;

    closeDropdown(instance);

    instance.display.removeEventListener('click', instance.onDisplayClick);
    instance.display.removeEventListener('keydown', instance.onDisplayKeyDown);
    instance.select.removeEventListener('change', instance.onSelectChange);

    if (instance.dropdown && instance.dropdown.parentNode) {
      instance.dropdown.parentNode.removeChild(instance.dropdown);
    }

    if (instance.display && instance.display.parentNode) {
      instance.display.parentNode.removeChild(instance.display);
    }

    instance.select.classList.remove('custom-select-native');

    if (instance.generatedWrapper && instance.wrapper && instance.wrapper.parentNode) {
      instance.wrapper.parentNode.insertBefore(instance.select, instance.wrapper);
      instance.wrapper.parentNode.removeChild(instance.wrapper);
    } else if (instance.wrapper) {
      instance.wrapper.classList.remove('custom-select-ready');
    }

    selectToInstance.delete(instance.select);
    instances.delete(instance);
  };

  const pruneInstances = () => {
    Array.from(instances).forEach((instance) => {
      const stillInDom = document.documentElement.contains(instance.select);
      if (!stillInDom || !isEligibleSelect(instance.select) || !isMobile()) {
        destroyInstance(instance);
      }
    });
  };

  const startObserver = () => {
    if (observer || !document.body) return;
    observer = new MutationObserver(() => {
      if (!isMobile()) return;
      if (hydrateQueued) return;
      hydrateQueued = true;
      requestAnimationFrame(() => {
        hydrateQueued = false;
        enableCustomSelects();
      });
    });
    observer.observe(document.body, { childList: true, subtree: true });
  };

  const stopObserver = () => {
    if (!observer) return;
    observer.disconnect();
    observer = null;
  };

  const enableCustomSelects = (root = document) => {
    if (!isMobile()) {
      disableCustomSelects();
      return;
    }

    pruneInstances();

    const targets = [];
    if (root instanceof HTMLSelectElement) {
      targets.push(root);
    } else if (root && typeof root.querySelectorAll === 'function') {
      targets.push(...root.querySelectorAll('select'));
    } else {
      targets.push(...document.querySelectorAll('select'));
    }

    targets.forEach((select) => {
      if (!isEligibleSelect(select)) return;
      if (selectToInstance.has(select)) {
        const instance = selectToInstance.get(select);
        syncDisplayState(instance);
        syncDropdownOptions(instance);
        return;
      }
      initSelect(select);
    });

    startObserver();
  };

  const disableCustomSelects = () => {
    stopObserver();
    closeOpenDropdown();
    Array.from(instances).forEach((instance) => destroyInstance(instance));
  };

  const handlePointerDown = (event) => {
    if (!openInstance) return;
    const target = event.target;
    if (openInstance.display.contains(target)) return;
    if (openInstance.dropdown.contains(target)) return;
    closeOpenDropdown();
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Escape') closeOpenDropdown();
  };

  const handleViewportChange = () => {
    if (!isMobile()) {
      disableCustomSelects();
      return;
    }
    closeOpenDropdown();
    enableCustomSelects();
  };

  const handleScroll = () => {
    if (openInstance) closeOpenDropdown();
  };

  document.addEventListener('pointerdown', handlePointerDown, true);
  document.addEventListener('keydown', handleKeyDown);
  document.addEventListener('scroll', handleScroll, true);
  window.addEventListener('resize', handleViewportChange);
  window.addEventListener('orientationchange', handleViewportChange);

  document.addEventListener('DOMContentLoaded', () => {
    enableCustomSelects();
  });

  window.enableCustomSelects = enableCustomSelects;
  window.disableCustomSelects = disableCustomSelects;
})();
