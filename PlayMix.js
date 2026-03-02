(function() {
    'use strict';

    const PLUGIN_NAME = 'Lampa PotPlayer Mix';
    const PLUGIN_VERSION = '1.3';

    let pluginLogs = [];
    let pendingAction = null;
    let actionTimeout = null;

    function log(message, data) {
        let time = new Date().toLocaleTimeString();
        let logMessage = `[${time}] ${message}`;
        pluginLogs.push(logMessage + (data ? ' | ' + JSON.stringify(data).substring(0, 200) : ''));
        if (pluginLogs.length > 50) pluginLogs.shift();
        console.log(logMessage, data || '');
    }

    function showNotify(msg) {
        if (Lampa.Noty) Lampa.Noty.show(msg);
        else if (Lampa.Notification) Lampa.Notification.show(msg);
    }

    function fixUrl(url) {
        if (!url) return url;
        let fixedUrl = url.replace(/&preload$/, '&play');
        fixedUrl = fixedUrl.replace(/&preload(&|$)/, '&play$1');
        return fixedUrl;
    }

    // Збереження аудіо в пам'ять Lampa
    function saveAudioUrl(url) {
        try {
            Lampa.Storage.set('potplayer_mix_audio_url', url);
            showNotify('🎵 Аудіо-посилання збережено в пам\'ять Lampa!');
            log('Аудіо збережено у Storage', url);
            return true;
        } catch(e) {
            log('Помилка збереження', e);
            showNotify('Помилка збереження в пам\'ять!');
            return false;
        }
    }

    // Запуск відео з аудіо-треком
    function playMixedVideo(videoUrl) {
        try {
            let audioUrl = Lampa.Storage.get('potplayer_mix_audio_url');
            
            if (!audioUrl || !audioUrl.match(/^https?:/)) {
                showNotify('У пам\'яті немає збереженого аудіо! Спочатку натисніть "Запам\'ятати як аудіо".');
                return;
            }

            videoUrl = fixUrl(videoUrl);
            audioUrl = fixUrl(audioUrl);

            log('Відео URL:', videoUrl);
            log('Аудіо URL:', audioUrl);

            // 1. Об'єднуємо посилання через |
            let combinedString = videoUrl + "|" + audioUrl;
            
            // 2. Кодуємо весь рядок, щоб Windows не "з'їла" спецсимволи (&, =, ?)
            let safeString = encodeURIComponent(combinedString);

            // 3. Формуємо безпечне посилання для нашого скрипта (реєстру)
            let playerUrl = `potplayer://${safeString}`;

            showNotify('▶️ Запуск PotPlayer Mix...');
            
            // Очищаємо аудіо після запуску, щоб уникнути плутанини в майбутньому
            Lampa.Storage.set('potplayer_mix_audio_url', '');

            window.location.href = playerUrl;

        } catch(e) {
            log('Помилка запуску', e);
            showNotify('Помилка під час формування посилання!');
        }
    }

    // Симуляція натискання на файл для отримання його посилання
    function setActionAndClick(actionType) {
        log('Підготовка до перехоплення. Дія: ' + actionType);
        
        pendingAction = actionType;

        clearTimeout(actionTimeout);
        actionTimeout = setTimeout(() => {
            if (pendingAction) {
                log('Таймаут очікування дії');
                pendingAction = null;
            }
        }, 30000);

        // Закриваємо меню дій, щоб фокус повернувся на список серій/файлів
        Lampa.Controller.toggle('content');

        setTimeout(function() {
            if (Lampa.Controller && Lampa.Controller.enter) {
                Lampa.Controller.enter();
            } else {
                let activeElem = document.querySelector('.focus');
                if (activeElem) {
                    activeElem.click();
                    if (typeof $ !== 'undefined') $(activeElem).trigger('hover:enter');
                } else {
                    showNotify('Не вдалося знайти файл');
                    pendingAction = null;
                }
            }
        }, 300);
    }

    function initPlugin() {
        log(`=== ${PLUGIN_NAME} v${PLUGIN_VERSION} ===`);

        if (typeof Lampa === 'undefined') return;

        // ПЕРЕХОПЛЕННЯ PLAY
        if (Lampa.Player && Lampa.Player.play && !Lampa.Player._potMixHooked) {
            let originalPlayerPlay = Lampa.Player.play;

            Lampa.Player.play = function(playerData) {
                if (pendingAction) {
                    let url = playerData.url || playerData.stream_url || playerData.link || playerData.file;
                    let action = pendingAction;
                    
                    pendingAction = null; 
                    clearTimeout(actionTimeout);

                    if (url && typeof url === 'string' && url.match(/^https?:/)) {
                        
                        setTimeout(() => {
                            if (Lampa.Player.stop) Lampa.Player.stop();
                        }, 50);

                        if (action === 'save_audio') {
                            saveAudioUrl(fixUrl(url));
                        } else if (action === 'play_mix') {
                            playMixedVideo(url);
                        }
                    } else {
                        showNotify('Помилка: не знайдено прямого HTTP-посилання');
                        originalPlayerPlay.call(this, playerData);
                    }
                } else {
                    // Стандартний запуск Lampa, якщо просто натиснули "ОК" на файлі
                    // ТАКОЖ тут ми додамо перехоплення на звичайний potplayer://, якщо ви хочете дивитись і звичайні фільми через PotPlayer
                    if(Lampa.Storage.get('player') === 'potplayer'){
                         let url = playerData.url || playerData.stream_url || playerData.link || playerData.file;
                         if (url) {
                             setTimeout(() => { if (Lampa.Player.stop) Lampa.Player.stop(); }, 50);
                             window.location.href = `potplayer://${encodeURIComponent(fixUrl(url))}`;
                             return;
                         }
                    }
                    originalPlayerPlay.call(this, playerData);
                }
            };
            Lampa.Player._potMixHooked = true;
        }

        // ДОДАВАННЯ КНОПОК У МЕНЮ "ДІЯ"
        if (Lampa.Select && !Lampa.Select._potMixMenuHooked) {
            const originalSelectShow = Lampa.Select.show;

            Lampa.Select.show = function(params) {
                let isActionMenu = false;

                if (params && params.items && Array.isArray(params.items)) {
                    let hasMark = params.items.find(i => i.title && i.title.toLowerCase().includes('позначити'));
                    let hasPlay = params.items.find(i => i.title && i.title.toLowerCase().includes('запустити'));
                    
                    if (hasMark || hasPlay) isActionMenu = true;
                }

                if (isActionMenu && params.items) {
                    let alreadyAdded = params.items.find(i => i.pot_mix_item);

                    if (!alreadyAdded) {
                        params.items.push({
                            title: '─── POTPLAYER MIX ───',
                            ghost: true,
                            separator: true,
                            pot_mix_item: true
                        });

                        params.items.push({
                            title: '▶️ Відтворити Mix (PotPlayer)',
                            pot_mix_item: true,
                            onSelect: function() {
                                setActionAndClick('play_mix');
                            }
                        });

                        params.items.push({
                            title: '🎵 Запам\'ятати як аудіо',
                            pot_mix_item: true,
                            onSelect: function() {
                                setActionAndClick('save_audio');
                            }
                        });
                    }
                }
                originalSelectShow.call(this, params);
            };
            Lampa.Select._potMixMenuHooked = true;
        }
    }

    if (window.appready) initPlugin();
    else Lampa.Listener.follow('app', function(e) { if (e.type === 'ready') setTimeout(initPlugin, 100); });

})();
