/**
 * The copy-button client script. Inlined once per page (deduped by the
 * Astro integration via `injectScript`). ~600 bytes gzipped.
 *
 * Behavior:
 *   - Listens for clicks on `.pcb__copy`
 *   - Copies the textContent of the nearest `pre code`
 *   - Toggles `.pcb__copy--done` and swaps the icon + label
 *   - Resets after `data-feedback-duration` ms (default 1600)
 *   - Falls back to execCommand for non-secure contexts
 *   - Respects `prefers-reduced-motion` (the CSS handles the animation)
 *   - Reads `data-done-label`, `data-success-icon`, `data-feedback-duration` from the button
 *   - Strips leading `#` comment lines when `data-strip-comments` is set (terminal preset)
 *   - Announces "Copied" to screen readers via an aria-live region (WCAG 4.1.2)
 *   - Hides copy button when JS is disabled (via .no-js class on <html>)
 */
export const COPY_SCRIPT = `
(function () {
  if (window.__pcbCopyReady) return;
  window.__pcbCopyReady = true;

  // Remove the .no-js class so the copy buttons become visible (graceful degradation).
  if (document.documentElement.classList.contains('no-js')) {
    document.documentElement.classList.remove('no-js');
    document.documentElement.classList.add('js');
  }

  // Reuse a single aria-live region for all copy announcements.
  var liveRegion = document.querySelector('.pcb__sr-live');
  if (!liveRegion) {
    liveRegion = document.createElement('span');
    liveRegion.className = 'pcb__sr-live';
    liveRegion.setAttribute('aria-live', 'polite');
    liveRegion.setAttribute('aria-atomic', 'true');
    liveRegion.setAttribute('role', 'status');
    document.body.appendChild(liveRegion);
  }

  function announce(msg) {
    if (!liveRegion) return;
    liveRegion.textContent = '';
    // Force re-announcement by clearing then setting on next tick.
    setTimeout(function () { liveRegion.textContent = msg; }, 50);
  }

  function findLabel(btn) {
    return btn.querySelector('.pcb__copy-label');
  }

  function findIcon(btn) {
    return btn.querySelector('svg');
  }

  // Strip leading comment lines (e.g. shell prompts like "# comment") from
  // the text before copying. Used for terminal-preset blocks where the
  // displayed code may include comments the user doesn't want on the clipboard.
  function stripComments(text) {
    // Strip lines that start with optional whitespace followed by # (shell),
    // // (C-style), or REM (Windows batch). Keep everything else.
    return text.replace(/^[ \\t]*(?:#|\\/\\/|REM\\b).*$/gm, '').replace(/\\n{3,}/g, '\\n\\n').trim();
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
    var stripCommentsFlag = btn.hasAttribute('data-strip-comments');

    var label = findLabel(btn);
    var icon = findIcon(btn);
    var originalLabel = label ? label.textContent : null;
    var originalIconHtml = icon ? icon.outerHTML : null;

    var rawText = code.innerText;
    var textToCopy = stripCommentsFlag ? stripComments(rawText) : rawText;

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
      announce(done);
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
      navigator.clipboard.writeText(textToCopy).then(finish).catch(fallback);
    } else {
      fallback();
    }

    function fallback() {
      var ta = document.createElement('textarea');
      ta.value = textToCopy;
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
