(function () {
  'use strict';

  function time2endPlugin() {
    if (window.time2end_plugin) return;
    window.time2end_plugin = true;

    // Не обов'язково, але як в оригіналі (TV UI)
    try { Lampa.Platform && Lampa.Platform.tv && Lampa.Platform.tv(); } catch (e) {}

    const STYLE_ID = 'time2end_style';
	const CLOCK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24">
  <circle cx="12" cy="12" r="10"/>
  <polyline points="12 6 12 12 16 14"/>
</svg>`;




    if (!document.getElementById(STYLE_ID)) {
      $('body').append(
        `<div id="${STYLE_ID}"><style>
          .bell__item--info { box-shadow: 0 0 0 0.2em #ffe216 !important; }
        </style></div>`
      );
    }

    let mode = Number(Lampa.Storage.get('time2endMode') || 0);
    let intervalId = null;
    let originalEndEl = null;
    let finishEl = null;

    function notify(text) {
      try {
        if (Lampa.Bell && Lampa.Bell.info) Lampa.Bell.info({ text: text });
        else if (Lampa.Noty && Lampa.Noty.show) Lampa.Noty.show(text);
      } catch (e) {}
    }

    function modeText(m) {
      if (m === 0) return 'Оригінальний вигляд';
      if (m === 1) return 'Повний час / час завершення';
      if (m === 2) return 'Залишок часу';
      return '';
    }

    function timeToSec(str) {
      if (!str || str.indexOf(':') === -1) return 0;
      const p = str.split(':');
      const h = +p[0] || 0, m = +p[1] || 0, s = +p[2] || 0;
      return h * 3600 + m * 60 + s;
    }

    function pad2(n) {
      const t = (n < 10 ? '0' : '') + n;
      return t.replace('NaN', '00');
    }

    function formatHMS(sec) {
      if (sec < 0) sec = 0;
      const h = Math.floor(sec / 3600);
      const m = Math.floor((sec % 3600) / 60);
      const s = sec % 60;
      return `${pad2(h)}:${pad2(m)}:${pad2(s)}`;
    }

    function formatClock(d) {
      return `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
    }

    function ensureButton() {
      $('.time2end').remove();

      const base = $('.player-panel__playlist');
      if (!base.length) return;

      const btn = base.clone();
      btn.addClass('time2end');
      btn.find('svg').replaceWith(CLOCK_SVG);
      btn.insertBefore($('.player-panel__quality'));

      btn.on('hover:enter', function () {
        mode = (mode + 1) % 3;
        Lampa.Storage.set('time2endMode', mode);
        notify(modeText(mode));
      });
    }

    function cleanup() {
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }

      $('.player-panel__timeend--finish').remove();

      if (originalEndEl) {
        originalEndEl.style.display = '';
        originalEndEl = null;
      }

      finishEl = null;
    }

    function onPlay() {
      cleanup();
      ensureButton();

      const nowEl = document.querySelector('.player-panel__timenow');
      const endEl = document.querySelector('.player-panel__timeend');
      if (!nowEl || !endEl) return;

      originalEndEl = endEl;

      const clone = endEl.cloneNode(true);
      clone.className += ' player-panel__timeend--finish';

      endEl.style.display = 'none';
      endEl.parentNode.insertBefore(clone, endEl.nextSibling);
      finishEl = clone;

      function tick() {
        if (!finishEl) return;

        const nowStr = (nowEl.textContent || nowEl.innerText || '').trim();
        const endStr = (endEl.textContent || endEl.innerText || '').trim();

        if (endStr === '00:00:00') {
          finishEl.textContent = 'Очікуємо завантаження...';
          return;
        }

        const nowSec = timeToSec(nowStr);
        const endSec = timeToSec(endStr);
        let remaining = endSec - nowSec;
        if (remaining < 0) remaining = 0;

        if (mode === 0) {
          finishEl.textContent = endStr;
        } else if (mode === 1) {
          const finish = new Date(Date.now() + remaining * 1000);
          finishEl.textContent = `${endStr} / ${formatClock(finish)}`;
        } else {
          finishEl.textContent = `До завершення ${formatHMS(remaining)}`;
        }
      }

      tick();
      intervalId = setInterval(tick, 1000);
    }

    Lampa.PlayerVideo.listener.follow('play', onPlay);
    Lampa.Player.listener.follow('destroy', cleanup);
  }

  if (window.appready) time2endPlugin();
  else {
    Lampa.Listener.follow('app', function (e) {
      if (e && e.type === 'ready') time2endPlugin();
    });
  }
})();
