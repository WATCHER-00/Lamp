(function () {
    'use strict';

    if (window.hls_buffer_settings_plugin) return;
    window.hls_buffer_settings_plugin = true;

    // 1. Інтегруємо пункт в меню налаштувань плеєра
    function applySelectOverride() {
        if (!window.Lampa || !window.Lampa.Select || window.Lampa.Select.__hls_buffer_overridden) return false;
        
        var originalSelectShow = window.Lampa.Select.show;
        
        window.Lampa.Select.show = function (params) {
            if (params && params.items && params.items.length > 0) {
                
                // Перевіряємо чи це меню налаштувань плеєра (шукаємо наявність пункту "Розмір відео")
                var isPlayerSettings = false;
                for (var i = 0; i < params.items.length; i++) {
                    var title = params.items[i].title || '';
                    if (title.indexOf('Розмір відео') !== -1 || 
                        title.indexOf('Размер видео') !== -1 || 
                        (window.Lampa.Lang && title === window.Lampa.Lang.translate('player_video_size'))) {
                        isPlayerSettings = true;
                        break;
                    }
                }

                if (isPlayerSettings) {
                    var currentVal = parseInt(window.Lampa.Storage.get('hls_custom_max_buffer', '30'));
                    var currentText = currentVal >= 60 ? (currentVal / 60) + ' хв.' : currentVal + ' сек.';
                    var subtitleText = currentText + ' (Потребує перезапуску)';

                    // Шукаємо, чи пункт вже існує (захист від дублікатів по унікальному id)
                    var existingItem = null;
                    for (var j = 0; j < params.items.length; j++) {
                        if (params.items[j].id === 'hls_buffer_setting') {
                            existingItem = params.items[j];
                            break;
                        }
                    }

                    if (existingItem) {
                        // Якщо вже є - просто оновлюємо підпис
                        existingItem.subtitle = subtitleText;
                    } else {
                        // Якщо немає - додаємо пункт
                        params.items.push({
                            id: 'hls_buffer_setting', // Унікальний ідентифікатор
                            title: 'Розмір буфера HLS',
                            subtitle: subtitleText,
                            onSelect: function () {
                                // Відкриваємо вікно вибору буфера
                                window.Lampa.Select.show({
                                    title: 'Розмір буфера HLS',
                                    items: [
                                        { title: '30 секунд (Стандарт)', value: '30' },
                                        { title: '1 хвилина', value: '60' },
                                        { title: '2 хвилини', value: '120' },
                                        { title: '5 хвилин', value: '300' },
                                        { title: '10 хвилин', value: '600' }
                                    ],
                                    onBack: function () {
                                        window.Lampa.Select.show(params);
                                    },
                                    onSelect: function (a) {
                                        window.Lampa.Storage.set('hls_custom_max_buffer', a.value);
                                        window.Lampa.Noty.show('Збережено: ' + a.title + '. Перезапустіть відео!');
                                        
                                        // Оновлюємо текст перед поверненням в попереднє меню
                                        for (var k = 0; k < params.items.length; k++) {
                                            if (params.items[k].id === 'hls_buffer_setting') {
                                                var newVal = parseInt(a.value);
                                                var newText = newVal >= 60 ? (newVal / 60) + ' хв.' : newVal + ' сек.';
                                                params.items[k].subtitle = newText + ' (Потребує перезапуску)';
                                                break;
                                            }
                                        }
                                        
                                        // Повертаємось до меню налаштувань плеєра
                                        window.Lampa.Select.show(params);
                                    }
                                });
                            }
                        });
                    }
                }
            }
            return originalSelectShow.apply(this, arguments);
        };
        
        window.Lampa.Select.__hls_buffer_overridden = true;
        return true;
    }

    // 2. Перехоплюємо створення HLS плеєра
    function interceptHls() {
        if (window.Hls && !window.Hls.__isProxied) {
            var OriginalHls = window.Hls;
            
            window.Hls = new Proxy(OriginalHls, {
                construct: function(target, args) {
                    var config = args[0] || {};
                    var maxBuffer = parseInt(window.Lampa.Storage.get('hls_custom_max_buffer', '30'));
                    
                    config.maxBufferLength = maxBuffer;
                    config.maxMaxBufferLength = Math.max(600, maxBuffer * 2);
                    
                    console.log('[HLS Buffer Plugin] Створено Hls з буфером:', config.maxBufferLength, 'сек');
                    
                    return new target(config);
                }
            });
            window.Hls.__isProxied = true;
        }
    }

    function init() {
        interceptHls();
        if (window.Lampa && window.Lampa.Player) {
            window.Lampa.Player.listener.follow('ready', interceptHls);
            window.Lampa.Player.listener.follow('start', interceptHls);
        }

        // Перевіряємо кожні пів секунди, чи завантажилась система меню Lampa, і лише тоді додаємо пункт
        if (!applySelectOverride()) {
            var timer = setInterval(function() {
                if (applySelectOverride()) {
                    clearInterval(timer);
                }
            }, 500);
        }
    }

    // Запуск плагіна
    if (window.appready) {
        init();
    } else {
        window.addEventListener('appready', init);
        if (window.Lampa && window.Lampa.Listener) {
            window.Lampa.Listener.follow('app', function(e) {
                if (e.type == 'ready') init();
            });
        }
    }
})();
