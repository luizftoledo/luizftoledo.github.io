/* Shared appearance control for the portfolio and its project pages. */
(function () {
  var portuguese = document.documentElement.lang.toLowerCase().split('-')[0] === 'pt';
  var lightLabel = portuguese ? 'Modo claro' : 'Light mode';
  var darkLabel = portuguese ? 'Modo escuro' : 'Dark mode';
  var switchToLight = portuguese ? 'Ativar modo claro' : 'Switch to light mode';
  var switchToDark = portuguese ? 'Ativar modo escuro' : 'Switch to dark mode';
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
  var warmPalette = !!document.querySelector('#editorial-theme[data-palette="warm"]');
  var theme = savedTheme === 'dark' || (warmPalette && savedTheme !== 'light') ? 'dark' : 'light';
  document.documentElement.setAttribute('data-site-theme', theme);
  var editorialTheme = document.getElementById('editorial-theme');
  if (editorialTheme) editorialTheme.disabled = !warmPalette && theme === 'dark';

  function installControl() {
    if (document.querySelector('[data-theme-toggle]')) return;
    var button = document.createElement('button');
    button.type = 'button';
    button.className = 'site-theme-toggle';
    button.setAttribute('data-theme-toggle', '');
    button.innerHTML = '<span aria-hidden="true">◐</span><span class="site-theme-toggle-label"></span>';
    document.body.appendChild(button);

    function render(nextTheme) {
      document.documentElement.setAttribute('data-site-theme', nextTheme);
      var isDark = nextTheme === 'dark';
      document.querySelectorAll('#editorial-theme').forEach(function (stylesheet) {
        stylesheet.disabled = !warmPalette && isDark;
      });
      button.setAttribute('aria-label', isDark ? switchToLight : switchToDark);
      button.setAttribute('title', isDark ? switchToLight : switchToDark);
      button.querySelector('.site-theme-toggle-label').textContent = isDark ? lightLabel : darkLabel;
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
