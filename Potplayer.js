(function() {
    'use strict';

    const PLUGIN_NAME = 'Зовнішній плеєр';
    const PLUGIN_VERSION = '1.7';

    const PLAYERS = {
        potplayer: {
            name: 'PotPlayer',
            icon: '🔵',
            protocol: 'potplayer://'
        }
    };

    let pluginLogs = [];
    let useExternalPlayerOnce = null;
    let externalPlayerTimeout = null;

    function log(message, data) {
        let time = new Date().toLocaleTimeString();
        let logMessage = `[${time}] ${message}`;

        pluginLogs.push(logMessage + (data ? ' | ' + JSON.stringify(data).substring(0, 200) : ''));
        if (pluginLogs.length > 50) pluginLogs.shift();

        if (typeof console !== 'undefined') {
            if (data) console.log(logMessage, data);
            else console.log(logMessage);
        }
    }

    function getLogs() {
        return pluginLogs.join('\n');
    }

    function showNotify(msg) {
        log('Сповіщення: ' + msg);
        if (Lampa.Noty) Lampa.Noty.show(msg);
        else if (Lampa.Notification) Lampa.Notification.show(msg);
    }

    function fixUrl(url) {
        if (!url) return url;
        let fixedUrl = url.replace(/&preload$/, '&play');
        fixedUrl = fixedUrl.replace(/&preload(&|$)/, '&play$1');
        if (fixedUrl !== url) log('URL виправлено: &preload -> &play');
        return fixedUrl;
    }

    async function copyToClipboard(text) {
        log('Копіювання: ' + text.substring(0, 50) + '...');
        try {
            await navigator.clipboard.writeText(text);
            showNotify('URL скопійовано!');
            return true;
        } catch(e) {
            showNotify('Помилка копіювання. Див. консоль');
            return false;
        }
    }

    function openInPlayer(url, playerKey) {
        let player = PLAYERS[playerKey];
        if (!player) return;

        let fixedUrl = fixUrl(url);
        log('Відкриття в ' + player.name + ': ' + fixedUrl.substring(0, 60));

        if (!fixedUrl.match(/^https?:\/\//)) fixedUrl = 'http://' + fixedUrl;

        let playerUrl = player.protocol + fixedUrl;

        try {
            let currentHash = window.location.hash;
            window.location.href = playerUrl;

            setTimeout(function() {
                if (window.location.hash !== currentHash) {
                    history.replaceState(null, null, currentHash || '#');
                }
            }, 500);
        } catch(e) {
            log('Помилка відкриття: ' + e.message);
        }

        showNotify('Відкриваю в ' + player.name + '...');
    }

    // Головна функція для імітації кліку та увімкнення перехоплювача
    function setActionAndClick(actionType) {
        log('Підготовка до перехоплення. Дія: ' + actionType);

        // 1. Встановлюємо прапорець "ПЕРЕХОПИТИ НАСТУПНИЙ ЗАПУСК"
        useExternalPlayerOnce = actionType;

        // Скидаємо прапорець через 30 секунд, якщо плеєр так і не запустився (наприклад, скасували меню перекладу)
        clearTimeout(externalPlayerTimeout);
        externalPlayerTimeout = setTimeout(function() {
            if (useExternalPlayerOnce) {
                log('Таймаут очікування запуску');
                useExternalPlayerOnce = null;
            }
        }, 30000);

        // 2. Закриваємо меню "Дія", щоб фокус повернувся до файлу
        Lampa.Controller.toggle('content');

        // 3. Робимо реальний клік по файлу (за допомогою вбудованого контролера Lampa)
        setTimeout(function() {
            log('Симуляція натискання OK на файлі...');

            // Lampa.Controller.enter() робить ідеальний клік (ніби ви натиснули кнопку OK на пульті)
            if (Lampa.Controller && Lampa.Controller.enter) {
                Lampa.Controller.enter();
            } else {
                // Резервний варіант
                let activeElem = document.querySelector('.focus');
                if (activeElem) {
                    activeElem.click();
                    if (typeof $ !== 'undefined') $(activeElem).trigger('hover:enter');
                } else {
                    showNotify('Не вдалося знайти файл для запуску');
                    useExternalPlayerOnce = null;
                }
            }
        }, 300); // Чекаємо 300мс, поки меню зникне
    }

    function initPlugin() {
        log('=== ' + PLUGIN_NAME + ' v' + PLUGIN_VERSION + ' ===');

        if (typeof Lampa === 'undefined') {
            log('ПОМИЛКА: Lampa не знайдена');
            return;
        }

        // ЧАСТИНА 1: ОРИГІНАЛЬНА ЛОГІКА ПЕРЕХОПЛЕННЯ LAMPA.PLAYER
        // Ми беремо логіку з вашого оригінального плагіну, яка 100% перехоплює готове посилання
        if (Lampa.Player && Lampa.Player.play && !Lampa.Player._externalHooked) {
            let originalPlayerPlay = Lampa.Player.play;

            Lampa.Player.play = function(playerData) {
                log('Lampa.Player.play викликано');

                // Якщо ми натиснули кнопку в меню "Дія", прапорець useExternalPlayerOnce буде заповнений
                if (useExternalPlayerOnce) {
                    let url = playerData.url || playerData.stream_url || playerData.link || playerData.file;
                    let action = useExternalPlayerOnce;

                    // Відразу скидаємо прапорець, щоб наступні відео грали нормально
                    useExternalPlayerOnce = null; 
                    clearTimeout(externalPlayerTimeout);

                    if (url && typeof url === 'string' && url.match(/^https?:\/\//)) {
                        log('Посилання перехоплено: ' + url.substring(0, 50));

                        // Зупиняємо внутрішній плеєр
                        setTimeout(function() {
                            if (Lampa.Player.stop) Lampa.Player.stop();
                        }, 50);

                        if (action === 'copy') {
                            copyToClipboard(fixUrl(url));
                        } else {
                            openInPlayer(url, action);
                        }
                    } else {
                        log('Невалідне посилання, запускаємо внутрішній плеєр');
                        showNotify('Помилка: не знайдено прямого HTTP-посилання');
                        originalPlayerPlay.call(this, playerData);
                    }
                } else {
                    // Якщо ми просто клікнули по файлу (без меню Дія), граємо у внутрішньому плеєрі
                    originalPlayerPlay.call(this, playerData);
                }
            };
            Lampa.Player._externalHooked = true;
            log('Оригінальне перехоплення Lampa.Player встановлено');
        }

        // ЧАСТИНА 2: ДОДАВАННЯ КНОПОК У МЕНЮ "ДІЯ"
        if (Lampa.Select && !Lampa.Select._externalPlayerHooked) {
            const originalSelectShow = Lampa.Select.show;

            Lampa.Select.show = function(params) {
                let isActionMenu = false;

                if (params && params.items && Array.isArray(params.items)) {
                    let hasMark = params.items.find(i => i.title && (
                        i.title.toLowerCase().includes('позначити') ||
                        i.title.toLowerCase().includes('відмітити')
                    ));
                    let hasPlay = params.items.find(i => i.title && (
                        i.title.toLowerCase().includes('запустити') ||
                        i.title.toLowerCase().includes('play')
                    ));
                    let hasTorrent = params.items.find(i => i.title && (
                        i.title.toLowerCase().includes('торент') ||
                        i.title.toLowerCase().includes('торрент')
                    ));

                    if (hasMark || hasPlay || hasTorrent) {
                        isActionMenu = true;
                    }
                }

                if (isActionMenu && params.items) {
                    let alreadyAdded = params.items.find(i => i.external_player_item);

                    if (!alreadyAdded) {
                        log('Додаємо пункти у меню дій');

                        params.items.push({
                            title: '─── ЗОВНІШНІ ПЛЕЄРИ ───',
                            ghost: true,
                            separator: true,
                            external_player_item: true
                        });

                        Object.keys(PLAYERS).forEach(function(key) {
                            let p = PLAYERS[key];
                            params.items.push({
                                title: p.icon + ' Відкрити в ' + p.name,
                                external_player_item: true,
                                onSelect: function() {
                                    setActionAndClick(key);
                                }
                            });
                        });

                        params.items.push({
                            title: '📋 Скопіювати URL відео',
                            external_player_item: true,
                            onSelect: function() {
                                setActionAndClick('copy');
                            }
                        });
                    }
                }

                originalSelectShow.call(this, params);
            };

            Lampa.Select._externalPlayerHooked = true;
            log('Меню Дія підключено');
        }
    }

    if (window.appready) initPlugin();
    else Lampa.Listener.follow('app', function(e) { if (e.type === 'ready') setTimeout(initPlugin, 100); });

    window.ExternalPlayerPlugin = { version: PLUGIN_VERSION, getLogs: getLogs };

})();
