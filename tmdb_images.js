(function () {
  'use strict';

  if (window._tiv) return;
  window._tiv = true;

  // ── CSS ──────────────────────────────────────────────────────────────────
  var css = [
    '.tiv-line .scroll__body{display:flex;align-items:flex-start;gap:.5em}',
    '.tiv-item{flex:0 0 auto;width:18em;border-radius:.5em;overflow:hidden;',
    'cursor:pointer;position:relative;transition:transform .2s,box-shadow .2s;background:#111;}',
    '.tiv-item img{width:100%;aspect-ratio:16/9;display:block;object-fit:cover;transition:opacity .3s;}',
    '.tiv-item.focus,.tiv-item:hover{transform:scale(1.06);',
    'box-shadow:0 0 0 3px #fff,0 6px 24px rgba(0,0,0,.7);z-index:2;}',

    '.tiv-v{position:fixed;inset:0;z-index:9999;',
    'display:flex;flex-direction:column;align-items:center;justify-content:center;',
    'background:rgba(0,0,0,.88);',
    'backdrop-filter:blur(22px);-webkit-backdrop-filter:blur(22px);}',
    '.tiv-v__img{max-width:92vw;max-height:84vh;object-fit:contain;border-radius:.4em;',
    'transition:opacity .3s;box-shadow:0 8px 48px rgba(0,0,0,.8);}',
    '.tiv-v__loader{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);',
    'width:3em;height:3em;border:3px solid rgba(255,255,255,.15);border-top-color:#fff;',
    'border-radius:50%;animation:tiv-spin .7s linear infinite;}',
    '@keyframes tiv-spin{to{transform:translate(-50%,-50%) rotate(360deg)}}',
    '.tiv-v__nav{position:absolute;top:50%;transform:translateY(-50%);',
    'background:rgba(255,255,255,.12);border:0;color:#fff;font-size:2.6em;',
    'padding:.1em .35em;cursor:pointer;border-radius:.25em;outline:none;',
    'transition:background .15s,transform .15s;user-select:none;-webkit-user-select:none;}',
    '.tiv-v__nav.l{left:.5em}.tiv-v__nav.r{right:.5em}',
    '.tiv-v__nav.focus,.tiv-v__nav:hover{background:rgba(255,255,255,.3);transform:translateY(-50%) scale(1.1)}',
    '.tiv-v__cnt{position:absolute;bottom:1.2em;left:50%;transform:translateX(-50%);',
    'color:rgba(255,255,255,.55);font-size:.85em;',
    'background:rgba(0,0,0,.4);padding:.2em .7em;border-radius:1em;pointer-events:none;}',
    '.tiv-v__cls{position:absolute;top:.6em;right:.9em;',
    'background:rgba(255,255,255,.08);border:0;color:rgba(255,255,255,.6);font-size:1.4em;',
    'cursor:pointer;padding:.3em .5em;line-height:1;border-radius:.3em;outline:none;',
    'transition:background .15s,color .15s;}',
    '.tiv-v__cls.focus,.tiv-v__cls:hover{background:rgba(255,255,255,.2);color:#fff;}'
  ].join('');

  var styleEl = document.createElement('style');
  styleEl.textContent = css;
  document.head.appendChild(styleEl);

  // ── Локалізація ──────────────────────────────────────────────────────────
  Lampa.Lang.add({
    tiv_title: { ru: 'Изображения', uk: 'Світлини', en: 'Images', be: 'Выявы', zh: '图片' }
  });

  // ── Кеш ─────────────────────────────────────────────────────────────────
  var _cache = {};

  function load(type, id, cb) {
    var key = type + '/' + id;
    if (_cache[key]) { cb(_cache[key]); return; }
    var url = Lampa.TMDB.api(
      type + '/' + id + '/images?api_key=' + Lampa.TMDB.key() +
      '&include_image_language=null,xx'
    );
    $.get(url)
      .done(function (data) {
        var items = (data.backdrops || [])
          .filter(function (b) { return !b.iso_639_1 || b.iso_639_1 === 'xx'; })
          .sort(function (a, b) { return b.vote_average - a.vote_average; })
          .slice(0, 25);
        _cache[key] = items;
        cb(items);
      })
      .fail(function () { cb([]); });
  }

  // ── Viewer ───────────────────────────────────────────────────────────────
  function viewer(imgs, startIndex) {
    var idx = startIndex || 0;
    var prevController = null;
    try { var en = Lampa.Controller.enabled(); prevController = en && en.name; } catch (e) { }

    var $v = $('<div class="tiv-v" role="dialog" aria-modal="true">');
    var $ldr = $('<div class="tiv-v__loader">');
    var $img = $('<img class="tiv-v__img">').css('opacity', 0);
    var $l = $('<button class="tiv-v__nav l selector">&#8249;</button>');
    var $r = $('<button class="tiv-v__nav r selector">&#8250;</button>');
    var $cnt = $('<div class="tiv-v__cnt">');
    var $cls = $('<button class="tiv-v__cls selector">✕</button>');
    $v.append($ldr, $img, $l, $r, $cnt, $cls);
    $('body').append($v);

    function go(n) {
      idx = ((n % imgs.length) + imgs.length) % imgs.length;
      $img.css('opacity', 0); $ldr.show();
      $img.off('load error');
      $img.on('load', function () { $ldr.hide(); $img.css('opacity', 1); });
      $img.on('error', function () { $ldr.hide(); $img.css('opacity', 0.4); });
      $img.attr('src', 'https://image.tmdb.org/t/p/original' + imgs[idx].file_path);
      $cnt.text((idx + 1) + ' / ' + imgs.length);
    }

    function close() {
      $(document).off('keydown.tiv_viewer');
      $v.off('touchstart.tiv touchend.tiv');
      try { Lampa.Controller.remove('tiv_v'); } catch (e) { }
      $v.css({ opacity: 0, transition: 'opacity .2s' });
      setTimeout(function () { $v.remove(); }, 200);
      try {
        if (prevController) Lampa.Controller.toggle(prevController);
        else Lampa.Controller.back();
      } catch (e) { try { Lampa.Controller.back(); } catch (_) { } }
    }

    $cls.on('hover:enter', close);
    $l.on('hover:enter', function () { go(idx - 1); });
    $r.on('hover:enter', function () { go(idx + 1); });
    $v.on('click', function (e) { if (e.target === $v[0]) close(); });

    $(document).on('keydown.tiv_viewer', function (e) {
      var k = e.keyCode;
      if (k === 37 || k === 21) { e.preventDefault(); go(idx - 1); }
      else if (k === 39 || k === 22) { e.preventDefault(); go(idx + 1); }
      else if (k === 27) { e.preventDefault(); close(); }
    });

    var tx = 0;
    $v.on('touchstart.tiv', function (e) { tx = e.originalEvent.touches[0].clientX; });
    $v.on('touchend.tiv', function (e) {
      var dx = e.originalEvent.changedTouches[0].clientX - tx;
      if (Math.abs(dx) > 40) { dx < 0 ? go(idx + 1) : go(idx - 1); }
    });

    try {
      Lampa.Controller.add('tiv_v', {
        toggle: function () {
          Lampa.Controller.collectionSet($v);
          Lampa.Controller.collectionFocus($cls[0], $v[0]);
        },
        left: function () { go(idx - 1); },
        right: function () { go(idx + 1); },
        up: function () { },
        down: function () { close(); },
        back: function () { close(); },
        enter: function () { }
      });
      Lampa.Controller.toggle('tiv_v');
    } catch (e) { }

    go(idx);
  }

  // ── Побудова стрічки ─────────────────────────────────────────────────────
  function build(imgs) {
    if (!imgs || !imgs.length) return null;

    var scroll = new Lampa.Scroll({ horizontal: true, step: 280 });

    var tiv = { $line: null, scroll: scroll, lastFocus: null, navReady: false };

    imgs.forEach(function (imgData, n) {
      var $item = $('<div class="tiv-item selector" tabindex="0">');
      var $thumb = $('<img loading="lazy" alt="backdrop">')
        .attr('src', 'https://image.tmdb.org/t/p/w780' + imgData.file_path)
        .on('error', function () { $item.remove(); });
      $item.append($thumb);

      $item.on('hover:focus', function () {
        scroll.update($item);
        tiv.lastFocus = $item[0];
      });

      $item.on('mouseenter', function () {
        $item.closest('.tiv-line').find('.tiv-item').removeClass('focus');
        $item.addClass('focus');
      });

      $item.on('mouseleave', function () { $item.removeClass('focus'); });
      $item.on('hover:enter', function () { viewer(imgs, n); });
      scroll.append($item);
    });

    var $line = $('<div class="tiv-line items-line items-line--type-default layer--visible layer--render">');
    var $head = $('<div class="items-line__head"><div class="items-line__title">' +
      Lampa.Lang.translate('tiv_title') + '</div></div>');
    var $body = $('<div class="items-line__body">').append(scroll.render());
    $line.append($head, $body);

    $line.on('visible', function () {
      try { Lampa.Layer.visible(scroll.render(true)); } catch (e) { }
    });

    tiv.$line = $line;
    return tiv;
  }

  // ── Слухачі Lampa ────────────────────────────────────────────────────────
  Lampa.Listener.follow('full', function (e) {
    if (e.type !== 'complite') return;

    var movie = e.data && e.data.movie;
    if (!movie || !movie.id) return;

    var comp = e.link; // Інстанс Full компонента
    var renderEl = comp.activity && comp.activity.render()[0];
    if (!comp || !comp.scroll || !renderEl) return;

    var type = e.object.method === 'tv' ? 'tv' : 'movie';

    load(type, movie.id, function (imgs) {
      if ($(renderEl).find('.tiv-line').length) return;
      var tiv = build(imgs);
      if (!tiv) return;

      var targetIndex = -1;
      var afterNames = ['discuss', 'cards', 'recomend', 'simular', 'collection'];
      for (var i = 0; i < comp.rows.length; i++) {
        if (afterNames.indexOf(comp.rows[i][0]) !== -1) {
          targetIndex = i;
          break;
        }
      }

      // Імітуємо Lampa-компонент для повноцінної роботи пультом (клавіатурою)
      var tivComponent = {
        render: function () {
          return tiv.$line;
        },
        toggle: function () {
          var items = tiv.$line.find('.selector');
          if (!tiv.lastFocus && items.length) tiv.lastFocus = items[0];

          Lampa.Controller.add('tiv_line', {
            link: tivComponent,
            toggle: function () {
              Lampa.Controller.collectionSet(tiv.scroll.render(true));
              Lampa.Controller.collectionFocus(tiv.lastFocus, tiv.scroll.render(true));
            },
            left: function () {
              if (window.Navigator.canmove('left')) window.Navigator.move('left');
              else comp.emit('left');
            },
            right: function () {
              if (window.Navigator.canmove('right')) window.Navigator.move('right');
            },
            up: function () {
              comp.emit('up');
            },
            down: function () {
              comp.emit('down');
            },
            back: function () {
              comp.emit('back');
            }
          });

          Lampa.Controller.toggle('tiv_line');

          comp.active = comp.items.indexOf(tivComponent);
          comp.scroll.update(tiv.$line);
        },
        destroy: function () {
          tiv.scroll.destroy();
          tiv.$line.remove();
        }
      };

      tiv.scroll.onWheel = function (step) {
        if (!Lampa.Controller.own(tivComponent)) tivComponent.toggle();
        try { Lampa.Controller.enabled().controller[step > 0 ? 'right' : 'left'](); } catch (err) { }
      };

      var origAppend = comp.scroll.append;
      var inserted = false;

      comp.scroll.append = function (fragment) {
        if (!inserted) {
          if (targetIndex !== -1 && targetIndex < comp.items.length) {
            var targetComp = comp.items[targetIndex];
            var $targetEl = $(targetComp.render(true));
            // Вставляємо Світлини в DOM
            $targetEl.before(tiv.$line);
            // Інтегруємо в масив компонентів (Lampa.Controller сам почне маршрутизувати фокус сюди)
            comp.items.splice(targetIndex, 0, tivComponent);
            inserted = true;
          }
          else if (targetIndex === -1 && comp.items.length >= comp.rows.length) {
            var $sb = $(comp.scroll.render(true)).find('.scroll__body').first();
            $sb.append(tiv.$line);
            comp.items.push(tivComponent);
            inserted = true;
          }
        }

        var ret = origAppend.apply(this, arguments);

        if (inserted && !tiv.navReady) {
          try { Lampa.Layer.visible(tiv.scroll.render(true)); } catch (err) { }
          tiv.navReady = true;
        }

        return ret;
      };

      // Перевіряємо можливість негайної вставки
      if (targetIndex !== -1 && targetIndex < comp.items.length) {
        comp.scroll.append(document.createDocumentFragment());
      } else if (targetIndex === -1 && comp.items.length >= comp.rows.length) {
        comp.scroll.append(document.createDocumentFragment());
      }
    });
  });

})();
