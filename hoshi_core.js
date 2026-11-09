(() => {
  'use strict';

  const clone = value => {
    if (typeof structuredClone === 'function') return structuredClone(value);
    return JSON.parse(JSON.stringify(value));
  };

  const warningText = language => language === 'en'
    ? 'Progress could not be saved on this device. Please keep this page open.'
    : 'Не удалось сохранить прогресс на этом устройстве. Не закрывайте страницу.';

  const corruptionText = language => language === 'en'
    ? 'Saved progress was damaged. A backup was kept, and a new progress record was started.'
    : 'Сохранённый прогресс оказался повреждён. Резервная копия сохранена, начата новая запись прогресса.';

  const showStorageWarning = (language, message = warningText(language), persistent = false) => {
    let warning = document.querySelector('[data-hoshi-storage-warning]');
    if (!warning) {
      warning = document.createElement('div');
      warning.dataset.hoshiStorageWarning = '';
      warning.setAttribute('role', 'alert');
      warning.style.cssText = [
        'position:fixed', 'z-index:1000', 'left:50%', 'bottom:max(14px,env(safe-area-inset-bottom))',
        'transform:translateX(-50%)', 'width:min(560px,calc(100% - 24px))', 'padding:12px 16px',
        'border:1px solid rgba(126,76,0,.22)', 'border-radius:16px', 'background:#fff5d7',
        'box-shadow:0 10px 32px rgba(42,64,86,.22)', 'color:#704b00',
        'font:600 14px/1.4 Arial,sans-serif', 'text-align:center'
      ].join(';');
      document.body.append(warning);
    }
    warning.dataset.persistent = String(persistent);
    warning.textContent = message;
  };

  const hideStorageWarning = () => {
    const warning = document.querySelector('[data-hoshi-storage-warning]');
    if (warning?.dataset.persistent !== 'true') warning?.remove();
  };

  const readRaw = key => {
    try {
      return { ok: true, value: localStorage.getItem(key) };
    } catch (error) {
      return { ok: false, value: null, error };
    }
  };

  const writeRaw = (key, value, language = document.documentElement.lang || 'ru') => {
    try {
      localStorage.setItem(key, value);
      hideStorageWarning();
      return true;
    } catch (error) {
      showStorageWarning(language);
      return false;
    }
  };

  const createProgressStore = ({ key, defaults, normalize, language = 'ru' }) => ({
    load() {
      const fallback = defaults();
      const result = readRaw(key);
      if (!result.ok) {
        queueMicrotask(() => showStorageWarning(language));
        return fallback;
      }
      if (!result.value) return fallback;
      try {
        const parsed = JSON.parse(result.value);
        return normalize ? normalize(parsed, fallback) : parsed;
      } catch (error) {
        try {
          localStorage.setItem(`${key}-corrupt-backup`, result.value);
          localStorage.removeItem(key);
        } catch (backupError) {}
        queueMicrotask(() => showStorageWarning(language, corruptionText(language), true));
        return fallback;
      }
    },
    save(value) {
      return writeRaw(key, JSON.stringify(value), language);
    },
    clear() {
      try {
        localStorage.removeItem(key);
        hideStorageWarning();
        return true;
      } catch (error) {
        showStorageWarning(language);
        return false;
      }
    }
  });

  const createChapterController = ({ initial = 1, available = [], onChange }) => {
    const allowed = new Set([...available].map(Number));
    let current = allowed.has(Number(initial)) ? Number(initial) : [...allowed][0] || 1;
    return {
      get current() { return current; },
      open(value, options = {}) {
        const next = Number(value);
        if (!allowed.has(next)) return false;
        const previous = current;
        current = next;
        onChange?.({ current, previous, changed: current !== previous, ...options });
        return true;
      }
    };
  };

  const focusFirstHeading = container => {
    const heading = container?.querySelector?.('h1, h2, h3');
    if (!heading) return false;
    heading.setAttribute('data-programmatic-focus', 'true');
    heading.style.setProperty('outline', 'none', 'important');
    heading.style.setProperty('box-shadow', 'none', 'important');
    heading.style.setProperty('-webkit-tap-highlight-color', 'transparent');
    heading.tabIndex = -1;
    heading.focus({ preventScroll: true });
    return document.activeElement === heading;
  };

  window.HoshiCore = Object.freeze({
    clone,
    createProgressStore,
    createChapterController,
    focusFirstHeading,
    readRaw,
    writeRaw,
    showStorageWarning
  });
})();
