# A3: реальная установленная проверка

Это снимки настоящего Windows Directus 12.1.1 на `http://127.0.0.1:18056`, не HTML-макет. Сопоставление — с [утверждённым предложением](../ux-proposal/PROPOSAL.md). Владелец утвердил предложение; тестирование настоящим менеджером/новичком не проводилось.

## Последняя визуальная сверка: candidate 6

Pages source/dist SHA256 `71109cabff4a988bd349427a881b9cdd98594394d6b9be9b44840562b782fdce`, served aggregate `d8a9f876785624c5d32b2805642c3240e5f8a1897c1f5341e93374b5a0f09d1c`. Это установленный кандидат из ещё не закоммиченного worktree на BASE `22c2892e3ee632e0a08e0f9ba27bc47b7dc649bc`. Его финальная установка из merged commit фиксируется отдельно в HANDOFF; этот набор не выдаётся за post-merge release.

Все 21 PNG лично проверены lead по фактическим PNG dimensions и SHA256; только 1536×1024 / 390×844. [Manifest](candidate-6/manifest.json) фиксирует артефакты, provenance, размеры и computed contrast. Normal-text контраст: текст черновика в списке/заголовке/контексте 7.05:1, значение индексации 7.54:1; общие подписи/пояснения — 7.54:1 по предыдущей сверке. Disabled controls не считаются normal text. Это адресная проверка, не WCAG-сертификация.

| Состояние | Компьютер | Телефон |
|---|---|---|
| Список | [1536×1024](candidate-6/pages-list-desktop-1536x1024.png) | [390×844](candidate-6/pages-list-mobile-390x844.png) |
| Поиск списка | [1536×1024](candidate-6/pages-search-desktop-1536x1024.png) | [390×844](candidate-6/pages-search-mobile-390x844.png) |
| Новая страница | [1536×1024](candidate-6/new-blank-draft-desktop-1536x1024.png) | [390×844](candidate-6/new-blank-draft-mobile-390x844.png) |
| Содержимое | [1536×1024](candidate-6/page-1-main-desktop-1536x1024.png) | [390×844](candidate-6/page-1-main-mobile-390x844.png) |
| Поиск и ссылки | [1536×1024](candidate-6/page-1-seo-search-settings-desktop-1536x1024.png) | [390×844](candidate-6/page-1-seo-search-settings-mobile-390x844.png) |
| Блоки | [1536×1024](candidate-6/page-1-blocks-desktop-1536x1024.png) | [390×844](candidate-6/page-1-blocks-lower-mobile-390x844.png) |
| Дополнительно | [1536×1024](candidate-6/page-1-additional-desktop-1536x1024.png) | [390×844](candidate-6/page-1-additional-mobile-390x844.png) |
| Диалог публикации | [1536×1024](candidate-6/publication-dialog-desktop-1536x1024.png) | [390×844](candidate-6/publication-dialog-mobile-390x844.png) |

Нижние поля доступны прокруткой: [текст внизу страницы](candidate-6/page-1-main-lower-seo-text-mobile-390x844.png), [вступление](candidate-6/page-1-main-lower-intro-mobile-390x844.png), [существующий блок](candidate-6/page-1-existing-block-rendered-mobile-390x844.png). Состояние черновика: [реальная существующая запись](candidate-6/existing-draft-main-desktop-1536x1024.png).

Read-only capture не создавал fixtures и не сохранял содержимое. Native prompts Directus закрыты «Пропустить» / «Remind Later», без задания owner/license/roles. Попытка native `PATCH /users/me/track/page` была заблокирована и отдельно записана как telemetry; `contentWriteAttempts: []`. Отмена диалога публикации дополнительно проверена неизменными status / updated_at.

## Поведение и управляемые состояния

[acceptance-results.json](acceptance-results.json) содержит 20 уникальных исходов с passing closure на установленном candidate 5, до последних copy/contrast-only поправок. Failures observer и незавершённый процесс не скрыты: приватные исходные журналы сохранены; read-only audit проверил отсутствие всех 81 собственных ID в 12 текущих журналах. Реальное API и PostgreSQL использовались для create, guarded save, 409, readback, children, статуса и файла. Публичная витрина на другом origin вернула HTTP 200 с сохранёнными h1/intro/seo_text.

- [Настоящий конфликт](runtime-conflict-1536.png).
- [Два собственных блока](runtime-two-blocks-1536.png), [телефон](runtime-two-blocks-390.png).
- [Настоящая нулевая поисковая выдача](runtime-search-empty-1536.png).
- [Пустая коллекция — controlled response](controlled-collection-empty-1536.png).
- [Отсутствующая база сайта — controlled response](controlled-missing-base-1536.png).
- [Потерянный ответ создания — controlled transport fault после real commit](controlled-lost-create-390.png).
- [Настоящая опубликованная синтетическая страница](runtime-published-page-1536.png), после проверки точно удалённая.

Эти функциональные снимки относятся к candidate 5 и могут содержать старый светлый статус; последняя визуальная сверка — таблица candidate 6 выше. Они не являются финальными release-снимками и не доказывают отдельные manager permissions.
