# Android-компаньон — интеграция с ODP

*Перевод справочно. Оригинал — только на английском: [`docs/ANDROID.md`](../ANDROID.md). При расхождении верен английский.*

Приложение-верификатор NFC лежит в отдельном репозитории `android-verifier` — переименован из
`odp-android-companion` 22.08.2026. **Он приватный, а приложение начали и не довели**, поэтому имя
дано без ссылки, а страницы ниже недостижимы. Публичной реализации якоря `nfc` нет ни на одной
платформе; эталонной реализацией теперь становится приложение ODP для iOS.

Этот репозиторий держит веб-интерфейс и мост handoff. Правила протокола — в
[репозитории спецификации](https://github.com/object-digital-passport/specifications).

Дальше описан handoff в том виде, в каком он был спроектирован. Описание сохранено потому, что
разделение шагов доверия ниже — по-прежнему верная форма для того, что будет читать пломбу следующим.

## Роль в ODP

| Слой | Где |
|-------|--------|
| Реестр, хэши, SPEC | [Репозиторий спецификации](https://github.com/object-digital-passport/specifications) — [SPEC.md](https://github.com/object-digital-passport/specifications/blob/main/SPEC.md) |
| Веб-интерфейс Verify / Passport | [frontend/verify.html](../../frontend/verify.html), [frontend/passport.html](../../frontend/passport.html) |
| Мост «веб → Android» | [frontend/js/odp-android-companion.js](../../frontend/js/odp-android-companion.js) |
| Рантайм NFC на устройстве | `android-verifier` (приватный, не доведён) |

Компаньон **не** заменяет проверку в цепи из браузера. Он добавляет чтение и запись NFC-носителя, свидетельства EV2/TagTamper и честно разделённые строки результата.

## Handoff

Экспорт из Verify или Manage passport выдаёт версионированный JSON (`odp-android-companion-handoff`) с доверенными полями:

- `passportId`, `verifyUrl`, `ndppCommitmentHash`, `nfcPublicKey`, `dataHash`
- опционально `chipBinding.profileId`, `proof`, `route`

Доставка:

- **Диплинк:** `odpcompanion://import?handoff=<url-encoded-json>`
- **Share / копирование** — тот же JSON обычным текстом

Реализация: [`frontend/js/odp-android-companion.js`](../../frontend/js/odp-android-companion.js) (`buildAndroidCompanionHandoff`, `openAndroidCompanionImport`).

## Форма носителя (эталонная)

Запись NDEF 1: адрес Verify на хостинге GitHub. Запись 2: сырые байты `odp:off`.
`ndppCommitmentHash = SHA-256(сырые байты офлайн-нагрузки)` — не адрес и не всё сообщение NDEF.

Цель первой ссылки остаётся Verify на Pages до тех пор, пока не появится контекст резолвера `odp://` (SPEC).

## Шаги доверия (держать раздельно)

1. Носитель открыт
2. Офлайн-нагрузка против `ndppCommitmentHash`
3. Сессия чипа (EV2 / TagTamper)
4. Чип против `nfcPublicKey` в цепи (зеркало профиля либо ключ EV2 в зависимости от деплоя)
5. Канонический `.odpass` / `dataHash`

Нормативные формулировки по NFC — **SPEC** (порядок работы эмитента, `highAssuranceSeal` для TagTamper).
Практический процесс с чипом и TagWriter: [ANDROID_NTAG424DNA_TAGTAMPER.md](https://github.com/object-digital-passport/specifications/blob/main/docs/ANDROID_NTAG424DNA_TAGTAMPER.md) ([перевод](https://github.com/object-digital-passport/specifications/blob/main/docs/ru/ANDROID_NTAG424DNA_TAGTAMPER.md)).
Чеклист области MVP: [ANDROID_VERIFIER_MVP.md](https://github.com/object-digital-passport/specifications/blob/main/docs/ANDROID_VERIFIER_MVP.md) ([перевод](https://github.com/object-digital-passport/specifications/blob/main/docs/ru/ANDROID_VERIFIER_MVP.md)).

## Установка

Устанавливать нечего. Приложение не выпускалось, а его репозиторий приватный.
