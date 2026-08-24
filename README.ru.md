# ODP — эталонный сайт

*Перевод справочно. Оригинал — только на английском: [`README.md`](README.md). При расхождении верен английский.*

Пример веб-интерфейса для **[Object Digital Passport](https://github.com/object-digital-passport/specifications)**: зарегистрировать личность, выпустить паспорт объекта и проверить его. Живёт на **https://object-digital-passport.github.io/**.

Проверка бесплатна и не требует кошелька: [**проверить что-нибудь**](https://object-digital-passport.github.io/verify.html).

## Это одна реализация, а не стандарт

Протокол лежит в собственном репозитории, и нормативен именно он:

- **[Спецификация](https://github.com/object-digital-passport/specifications/blob/main/SPEC.md)** — что такое паспорт и как работает проверка ([перевод](https://github.com/object-digital-passport/specifications/blob/main/docs/ru/SPEC.md))
- **[Контракты, схема, развёрнутые адреса](https://github.com/object-digital-passport/specifications)**

Всё, что этот сайт делает сверх требований спецификации, — это выбор, сделанный здесь, и вы вправе сделать другой. Ничего привилегированного в этом сайте нет: паспорт, зарегистрированный через него, читается любой реализацией, навсегда, ни у кого не спрашивая.

| Путь | Роль |
|------|------|
| [`frontend/`](frontend/) | HTML-страницы, CSS, скрипты интерфейса, строки интерфейса в `localization/` |
| [`backend/`](backend/) | Клиент реестра на стороне браузера: помощники ABI, бандл WalletConnect, `registry-config.json`. Сервера нет — «backend» здесь означает код, который говорит с цепью со страницы |
| [`docs/`](docs/) | Как пользоваться сайтом и интеграция с Android-компаньоном |
| [`frontend/e2e/`](frontend/e2e/) | Дымовые тесты Playwright |

## Запустить локально

```bash
TMP=$(mktemp -d) && cp -r frontend/. "$TMP/" && cp -r backend "$TMP/backend" && cd "$TMP" && python3 -m http.server 8080
# → http://127.0.0.1:8080/verify.html
```

Только статические файлы, без шага сборки — поэтому бандл WalletConnect закоммичен, а не собирается при деплое.

## Пересобрать бандл WalletConnect

```bash
cd backend && npm install && npm run build:wc
```

`backend/js/odp-wallet-wc.bundle.js` — сгенерированный вывод. Сканирование кода его игнорирует: находки внутри относятся к чужому коду, а следующая сборка перетрёт любую правку.

## С каким реестром он говорит

Адрес развёрнутого контракта подставляется во время деплоя из секрета Actions `ODP_CONTRACT_ADDRESS`, а при его отсутствии берётся значение, записанное в страницах. Актуальные адреса всех версий протокола — в [таблице деплоя](https://github.com/object-digital-passport/specifications/blob/main/docs/GUIDE.md#current-release).

## История

[`CHANGELOG.md`](CHANGELOG.md) ([перевод](CHANGELOG.ru.md)). До августа 2026 сайт был папкой `web/` внутри репозитория протокола; его коммиты переехали целиком, поэтому `git log` дотягивается до первого релиза в марте.

MIT.
