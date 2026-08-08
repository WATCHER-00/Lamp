(function() {
    'use strict';

    const PLUGIN_NAME = 'Lampa PotPlayer Mix (Auto Low Audio)';
    const PLUGIN_VERSION = '1.7';

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

    // НОВА ФУНКЦІЯ: Автоматично знаходить посилання на найменшу якість (для аудіо)
    function fetchLowestQuality(originalUrl, callback) {
        if (!originalUrl || typeof originalUrl !== 'string' || originalUrl.indexOf('.m3u8') === -1) {
            return callback(originalUrl);
        }
        
        let requestUrl = originalUrl;
        if (requestUrl.includes('|')) requestUrl = requestUrl.split('|')[0];
        else if (requestUrl.includes('%7C')) requestUrl = requestUrl.split('%7C')[0];

        $.ajax({
            url: requestUrl,
            type: 'GET',
            dataType: 'text',
            timeout: 5000,
            success: function(data) {
                let lines = data.split('\n');
                let streams = [];
                
                for (let i = 0; i < lines.length; i++) {
                    if (lines[i].indexOf('#EXT-X-STREAM-INF') !== -1) {
                        // Шукаємо висоту відео (наприклад 541 з RESOLUTION=960x541)
                        let resMatch = lines[i].match(/RESOLUTION=\d+x(\d+)/);
                        // Запасний варіант: шукаємо пропускну здатність, якщо резолюція не вказана
                        let bwMatch = lines[i].match(/BANDWIDTH=(\d+)/);
                        
                        let score = 9999999;
                        if (resMatch) {
                            score = parseInt(resMatch[1], 10);
                        } else if (bwMatch) {
                            score = parseInt(bwMatch[1], 10);
                        }

                        let streamUrl = lines[i + 1] ? lines[i + 1].trim() : '';
                        
                        if (streamUrl && !streamUrl.startsWith('http')) {
                            try {
                                let urlObj = new URL(requestUrl);
                                let baseUrl = requestUrl.substring(0, requestUrl.lastIndexOf('/') + 1);
                                if (streamUrl.startsWith('/')) {
                                    streamUrl = urlObj.origin + streamUrl; 
                                } else {
                                    streamUrl = baseUrl + streamUrl; 
                                }
                            } catch(e) {
                                log('Помилка парсингу URL', e);
                            }
                        }
                        
                        if (streamUrl) {
                            streams.push({ url: streamUrl, score: score });
                        }
                    }
                }

                if (streams.length > 0) {
                    // Сортуємо від найменшої якості (найменшого score) до найбільшої
                    streams.sort((a, b) => a.score - b.score);
                    // Повертаємо найперше (найменше) посилання
                    callback(streams[0].url);
                } else {
                    callback(originalUrl); 
                }
            },
            error: function(jqXHR, textStatus) {
                log('Помилка читання m3u8: ' + textStatus);
                callback(originalUrl);
            }
        });
    }

    // Збереження аудіо в пам'ять Lampa з таймером
    function saveAudioUrl(url) {
        try {
            Lampa.Storage.set('potplayer_mix_audio_url', url);
            Lampa.Storage.set('potplayer_mix_audio_time', Date.now()); // Фіксуємо час збереження
            showNotify('🎵 Аудіо збережено!');
            log('Аудіо збережено у Storage', url);
            return true;
        } catch(e) {
            log('Помилка збереження', e);
            showNotify('Помилка збереження в пам\'ять!');
            return false;
        }
    }

    // Запуск відео з аудіо-треком (ОРИГІНАЛЬНИЙ)
    function playMixedVideo(videoUrl) {
        try {
            let audioUrl = Lampa.Storage.get('potplayer_mix_audio_url');
            let audioTime = Lampa.Storage.get('potplayer_mix_audio_time');
            
            if (audioUrl) {
                let timeElapsed = Date.now() - (audioTime || 0);
                if (timeElapsed > 600000) { // 10 хвилин = 600000 мс
                    showNotify('⏳ Час дії збереженого аудіо (10 хв) минув! Збережіть його знову.');
                    Lampa.Storage.set('potplayer_mix_audio_url', '');
                    return;
                }
            } else {
                showNotify('У пам\'яті немає збереженого аудіо! Натисніть "Запам\'ятати як аудіо".');
                return;
            }

            videoUrl = fixUrl(videoUrl);
            audioUrl = fixUrl(audioUrl);

            log('Відео URL:', videoUrl);
            log('Аудіо URL:', audioUrl);

            let combinedString = videoUrl + "|" + audioUrl;
            let safeString = encodeURIComponent(combinedString);
            let playerUrl = `potplayer://${safeString}`;

            showNotify('🔀 Запуск PotPlayer Mix...');
            
            // Не видаляємо аудіо, щоб можна було відкрити відео кілька разів протягом 10 хвилин
            window.location.href = playerUrl;

        } catch(e) {
            log('Помилка запуску', e);
            showNotify('Помилка під час формування посилання!');
        }
    }

    // Симуляція натискання
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
                            // Автоматично шукаємо найменшу якість перед збереженням
                            fetchLowestQuality(url, function(lowestUrl) {
                                saveAudioUrl(fixUrl(lowestUrl));
                            });
                        } else if (action === 'play_mix') {
                            // Відтворення Mix без парсингу якості відео (як в оригіналі)
                            playMixedVideo(url);
                        }
                    } else {
                        showNotify('Помилка: не знайдено прямого HTTP-посилання');
                        originalPlayerPlay.call(this, playerData);
                    }
                } else {
                    // Стандартний запуск Lampa (як в оригіналі)
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

        // ДОДАВАННЯ КНОПОК
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
