/**
 * The copy-button client script. Inlined once per page (deduped by the
 * Astro integration via `injectScript`). ~500 bytes gzipped.
 *
 * Behavior:
 *   - Listens for clicks on `.pcb__copy`
 *   - Copies the textContent of the nearest `pre code`
 *   - Toggles `.pcb__copy--done` and swaps the icon + label
 *   - Resets after `data-feedback-duration` ms (default 1600)
 *   - Falls back to execCommand for non-secure contexts
 *   - Respects `prefers-reduced-motion` (the CSS handles the animation)
 *   - Reads `data-done-label`, `data-success-icon`, `data-feedback-duration` from the button
 */
export const COPY_SCRIPT = `
(function () {
  if (window.__pcbCopyReady) return;
  window.__pcbCopyReady = true;

  function findLabel(btn) {
    return btn.querySelector('.pcb__copy-label');
  }

  function findIcon(btn) {
    return btn.querySelector('svg');
  }

  document.addEventListener('click', function (e) {
    var btn = e.target && e.target.closest && e.target.closest('.pcb__copy');
    if (!btn) return;
    var figure = btn.closest('.pcb');
    var code = figure && figure.querySelector('pre code');
    if (!code) return;

    var done = btn.getAttribute('data-done-label') || 'copied!';
    var duration = parseInt(btn.getAttribute('data-feedback-duration') || '1600', 10);
    var successIconHtml = btn.getAttribute('data-success-icon');

    var label = findLabel(btn);
    var icon = findIcon(btn);
    var originalLabel = label ? label.textContent : null;
    var originalIconHtml = icon ? icon.outerHTML : null;

    var finish = function () {
      btn.classList.add('pcb__copy--done');
      if (label) label.textContent = done;
      if (successIconHtml && icon) {
        var tmp = document.createElement('span');
        tmp.innerHTML = successIconHtml;
        var newIcon = tmp.firstChild;
        if (newIcon) {
          icon.replaceWith(newIcon);
          icon = newIcon;
        }
      }
      setTimeout(function () {
        btn.classList.remove('pcb__copy--done');
        if (label && originalLabel != null) label.textContent = originalLabel;
        if (originalIconHtml && icon) {
          var tmp2 = document.createElement('span');
          tmp2.innerHTML = originalIconHtml;
          var oldIcon = icon;
          icon = tmp2.firstChild;
          if (icon) oldIcon.replaceWith(icon);
        }
      }, duration);
    };

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(code.innerText).then(finish).catch(fallback);
    } else {
      fallback();
    }

    function fallback() {
      var ta = document.createElement('textarea');
      ta.value = code.innerText;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); finish(); } catch (_) {}
      document.body.removeChild(ta);
    }
  });
})();
`;
//# sourceMappingURL=copy-script.js.map