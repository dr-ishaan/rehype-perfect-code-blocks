/**
 * The copy-button client script. Inlined once per page (deduped by the
 * Astro integration via `injectScript`). ~1.2 KB gzipped.
 *
 * Behavior:
 *   - Listens for clicks on `.pcb__copy` (event delegation on document)
 *   - Copies the textContent of the nearest `pre code`
 *   - Toggles `.pcb__copy--done` and swaps the icon + label
 *   - Resets after `data-feedback-duration` ms (default 1600)
 *   - Falls back to execCommand for non-secure contexts
 *   - Respects `prefers-reduced-motion` (the CSS handles the animation)
 *   - Reads `data-done-label`, `data-success-icon`, `data-feedback-duration` from the button
 *   - Strips leading `#` comment lines when `data-strip-comments` is set (terminal preset)
 *   - Announces "Copied" to screen readers via an aria-live region (WCAG 4.1.2)
 *   - Hides copy button when JS is disabled (via .no-js class on <html>)
 *
 * Pattern 4 (adopted from VitePress + expressive-code):
 *   - Event delegation via `document.addEventListener('click', ...)` — works
 *     regardless of how buttons were rendered (SSR, CSR, view transitions).
 *   - MutationObserver re-initializes the aria-live region and the .no-js → .js
 *     class swap when new code blocks are added to the DOM (SPA support).
 *   - `astro:page-load` event listener for Astro view transitions.
 */
export const COPY_SCRIPT = `
(function () {
  if (window.__pcbCopyReady) return;
  window.__pcbCopyReady = true;

  // Remove the .no-js class so the copy buttons become visible (graceful degradation).
  function swapNoJs() {
    if (document.documentElement.classList.contains('no-js')) {
      document.documentElement.classList.remove('no-js');
      document.documentElement.classList.add('js');
    }
  }
  swapNoJs();

  // Reuse a single aria-live region for all copy announcements.
  var liveRegion = null;
  function ensureLiveRegion() {
    if (liveRegion && document.body.contains(liveRegion)) return liveRegion;
    liveRegion = document.querySelector('.pcb__sr-live');
    if (!liveRegion) {
      liveRegion = document.createElement('span');
      liveRegion.className = 'pcb__sr-live';
      liveRegion.setAttribute('aria-live', 'polite');
      liveRegion.setAttribute('aria-atomic', 'true');
      liveRegion.setAttribute('role', 'status');
      document.body.appendChild(liveRegion);
    }
    return liveRegion;
  }
  ensureLiveRegion();

  function announce(msg) {
    var lr = ensureLiveRegion();
    if (!lr) return;
    lr.textContent = '';
    // Force re-announcement by clearing then setting on next tick.
    setTimeout(function () { lr.textContent = msg; }, 50);
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

  // Event-delegated click handler. Works for buttons added after initial
  // render (e.g. via React/Vue re-render or Astro view transitions) because
  // the listener is on document, not on each button.
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
      // v2.1.0: Update aria-label for screen readers — announce "copied" state
      var originalAriaLabel = btn.getAttribute('aria-label') || 'Copy code';
      btn.setAttribute('aria-label', done + ' — ' + originalAriaLabel);
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
        // v2.1.0: Restore original aria-label after feedback duration
        btn.setAttribute('aria-label', originalAriaLabel);
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

  // Pattern 4: MutationObserver for SPA support + .no-js race fix.
  // Watches for:
  //   - New code blocks added to the DOM (React/Vue re-render, Astro view
  //     transitions, Turbolinks) → re-apply .no-js → .js swap + ensure
  //     aria-live region.
  //   - Attribute changes on <html> (specifically the class attribute) →
  //     catches the case where a later script adds .no-js AFTER this script
  //     ran (a race condition that previously left copy buttons hidden).
  if (typeof MutationObserver !== 'undefined') {
    var pendingObserve = false;
    var observer = new MutationObserver(function (mutations) {
      // Batch checks with microtask to avoid layout thrash.
      if (pendingObserve) return;
      pendingObserve = true;
      Promise.resolve().then(function () {
        pendingObserve = false;
        var needsSwap = false;
        for (var i = 0; i < mutations.length; i++) {
          var m = mutations[i];
          // childList: new nodes added (SPA navigation, view transitions)
          if (m.type === 'childList' && m.addedNodes && m.addedNodes.length) {
            needsSwap = true;
          }
          // attributes: class changed on <html> (the .no-js race fix)
          if (m.type === 'attributes' && m.attributeName === 'class') {
            needsSwap = true;
          }
        }
        if (needsSwap) {
          swapNoJs();
          ensureLiveRegion();
        }
      });
    });
    // Observe documentElement for BOTH childList (new nodes) AND attribute
    // changes (class attribute — catches .no-js being added by a later script).
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class'],
    });
  }

  // Defensive: re-run swapNoJs() on DOMContentLoaded and window.load.
  // Belt + suspenders for the .no-js race — if a framework (Astro, Next.js,
  // etc.) adds .no-js in a way the MutationObserver doesn't catch (e.g.,
  // before the observer is set up, or in a different document context),
  // these event handlers will catch it.
  if (typeof document.addEventListener === 'function') {
    document.addEventListener('DOMContentLoaded', function () {
      swapNoJs();
      ensureLiveRegion();
    });
  }
  if (typeof window.addEventListener === 'function') {
    window.addEventListener('load', function () {
      swapNoJs();
      ensureLiveRegion();
    });
  }

  // Pattern 4: astro:page-load event listener for Astro view transitions.
  // Astro emits this event after a view transition completes; the new page's
  // DOM may have replaced the old, so re-apply the .no-js → .js swap.
  if (typeof document.addEventListener === 'function') {
    document.addEventListener('astro:page-load', function () {
      swapNoJs();
      ensureLiveRegion();
    });
  }
})();
`;
