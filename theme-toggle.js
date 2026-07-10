/* Shared appearance control for the portfolio and its project pages. */
(function () {
  var storageKey = 'luizftoledo-theme';
  var currentScript = document.currentScript;
  if (currentScript && currentScript.src) {
    var stylesheet = document.createElement('link');
    stylesheet.rel = 'stylesheet';
    stylesheet.href = new URL('theme-toggle.css', currentScript.src).href;
    document.head.appendChild(stylesheet);
  }
  var savedTheme;
  try { savedTheme = localStorage.getItem(storageKey); } catch (error) { /* storage is optional */ }
  var theme = savedTheme === 'dark' ? 'dark' : 'light';
  document.documentElement.setAttribute('data-site-theme', theme);
  var editorialTheme = document.getElementById('editorial-theme');
  if (editorialTheme) editorialTheme.disabled = theme === 'dark';

  function installControl() {
    if (document.querySelector('[data-theme-toggle]')) return;
    var button = document.createElement('button');
    button.type = 'button';
    button.className = 'site-theme-toggle';
    button.setAttribute('data-theme-toggle', '');
    button.setAttribute('aria-label', 'Switch to dark mode');
    button.setAttribute('title', 'Switch to dark mode');
    button.innerHTML = '<span aria-hidden="true">◐</span><span class="site-theme-toggle-label">Dark mode</span>';
    document.body.appendChild(button);

    function render(nextTheme) {
      document.documentElement.setAttribute('data-site-theme', nextTheme);
      var isDark = nextTheme === 'dark';
      document.querySelectorAll('#editorial-theme').forEach(function (stylesheet) {
        stylesheet.disabled = isDark;
      });
      button.setAttribute('aria-label', isDark ? 'Switch to light mode' : 'Switch to dark mode');
      button.setAttribute('title', isDark ? 'Switch to light mode' : 'Switch to dark mode');
      button.querySelector('.site-theme-toggle-label').textContent = isDark ? 'Light mode' : 'Dark mode';
    }

    render(theme);
    button.addEventListener('click', function () {
      theme = document.documentElement.getAttribute('data-site-theme') === 'dark' ? 'light' : 'dark';
      try { localStorage.setItem(storageKey, theme); } catch (error) { /* storage is optional */ }
      render(theme);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', installControl);
  else installControl();
})();
