# A2-UX-FIX: актуальная матрица поля, потребителя и эффекта

Дата: 2026-10-23. Source baseline: `5b7879b6bec22e4585940151d23cd5821a2ea6a8`.
Матрица составлена по текущим исходникам и первоначальному read-only осмотру Windows Directus. Она не подменяет приёмку установленного исправления: результаты выполнения и ограничения отдельно записываются в A2-UX-ACCEPTANCE.md. Старые A2-FIELD-CONSUMERS.md и a2-approved/FIELD-CONSUMERS.md содержат устаревшие выводы о поиске и SEO и теперь ссылаются на эту матрицу. Владелец утвердил показанное предложение 2026-10-23.

## Цепочка и общие условия

- H: `directus/extensions/commerce-integrity/src/index.js:43` (`synchronizeSeoPayload`) и `:135` (`home_page.items.update`). Guarded API вызывает ItemsService и этот hook. Скалярные SEO-изменения объединяются с исходным `seo`; неизвестные свойства сохраняются. JSON → скаляры и скаляры → JSON — две проекции одного результата.
- G: `directus/extensions/commerce-api/src/storefront.mjs`: allowlist `home_page`, фильтр published, own technical account, ограничение singleton, `no-store` ответа. Нет нового публичного доступа в A2.
- Q: `storefront/lib/content.ts:197` (`getCmsHome`), отдельный `getSections:48`; `storefront/lib/directus.ts:66` переводит URL через gateway и передаёт `next.revalidate`. Home/children revalidate=120 секунд; мгновенная инвалидация редактором не найдена. В mock-режиме CMS home не читается.
- P: `storefront/app/page.tsx:14` (metadata), `:34` (HomePage); L: `storefront/app/layout.tsx:63` → Header → SearchBox; B: `storefront/components/CmsPageRenderer.tsx`.
- CMS home используется только при `status=published`; иначе сайт использует fallback. Дочерние записи дополнительно требуют `status=published`, `is_visible=true`, принадлежность этой главной; запрос до 100, sort_order. Они выводятся после фиксированных блоков сайта. Сохранение родителя и каждого блока — отдельные CAS-транзакции, без атомарного Save All.

## Все 34 поля главной

| Поле исходной записи | Hook/проекция | Gateway / запрос | Потребитель и эффект | Представление в A2-UX-FIX |
|---|---|---|---|---|
| id | Служебная identity | G/Q; привязка child | Выбор блоков этой главной | Не бизнес-поле |
| status | Не меняется обычным Save A2 | G/Q published | Допуск CMS home на сайт | Понятный readonly статус |
| h1 | Нет | G/Q | P metadata: резерв после seo_title, перед hero_title; не видимый H1 | Редкое поле в поисковых настройках |
| hero_title | Нет | G/Q | P видимый H1, резерв metadata | Основной ввод первого экрана |
| hero_text | Нет | G/Q | P видимый текст, резерв description | Основной ввод |
| hero_image | Нет | G/Q и asset gateway | P hero desktop/mobile и изображение карточки ссылки; при отсутствии встроенное фото | Native file picker |
| hero_image_alt | Нет | G/Q | P описание выбранного CMS изображения | «Описание изображения» |
| hero_primary_button_text | Нет | G/Q | P подпись первой кнопки при допустимой ссылке и непустом тексте; иначе «Открыть каталог» | Ввод + точное условие |
| hero_primary_button_url | Нет | G/Q | P безопасный href, иначе /catalog | Ввод + валидация |
| hero_secondary_button_text | Нет | G/Q | P подпись второй кнопки при допустимой ссылке и непустом тексте; иначе «Отправить список» | Ввод + точное условие |
| hero_secondary_button_url | Нет | G/Q | P href; /request переводится в /request?import=1; fallback /request?import=1 | Ввод + валидация |
| hero_search_label | Нет | G/Q читает и маппит | Не передаётся компонентам; aria-label/быстрые ссылки заданы в коде | Readonly: сайт не использует эту подпись |
| hero_search_placeholder | Нет | G/Q → L | Header/SearchBox: подсказка настоящего поиска в шапке | Рабочий ввод, отдельно от label |
| hero_search_button_text | Нет | G/Q → L | Header/SearchBox: текст кнопки поиска | Рабочий ввод |
| hero_bulk_prompt | Нет | Нет в Q | Публичный потребитель не найден | Readonly с конкретным ограничением |
| hero_bulk_link_text | Нет | Нет в Q | Публичный потребитель не найден | Readonly |
| hero_bulk_link_url | Нет | Нет в Q | Публичный потребитель не найден | Readonly |
| hero_excel_link_text | Нет | Нет в Q | Публичный потребитель не найден | Readonly |
| hero_excel_link_url | Нет | Нет в Q | Публичный потребитель не найден | Readonly |
| hero_photo_link_text | Нет | Нет в Q | Публичный потребитель не найден | Readonly |
| hero_photo_link_url | Нет | Нет в Q | Публичный потребитель не найден | Readonly |
| seo_title | H ↔ seo.title | G/Q | P document/OG title, fallback h1/hero_title | Один скалярный ввод |
| seo_description | H ↔ seo.meta_description | G/Q | P document/OG description, fallback hero_text | Один скалярный ввод |
| canonical_url | H ↔ seo.additional_fields.canonical_url | G/Q | P safeCanonicalUrl → absolute canonical и OG URL | «Основной адрес страницы» |
| is_indexable | H ↔ !seo.no_index | G/Q | P false: robots noindex/follow | Понятный checkbox |
| og_title | Нет в H | Нет в Q | Отдельного эффекта нет; OG title из seo_title/fallback | Readonly, не второй title |
| og_description | Нет в H | Нет в Q | Отдельного эффекта нет; OG description из seo_description/fallback | Readonly |
| og_image | H ↔ seo.og_image | G allowlist, но не Q | Главная использует hero_image для OG; отдельный файл не используется | Readonly, не второй picker |
| seo | H: title/meta_description/og_image/no_index/additional_fields.canonical_url → скаляры; scalar merge сохраняет остальные ключи | Не читается Q напрямую | Косвенный эффект через четыре рабочих скалярных поля; og_image не влияет на текущую главную | Убрать двойной ввод, сохранить данные/проекции |
| sections | Alias; не записывать родителем | Q отдельный getSections | B: только опубликованные включённые children | «Блоки страницы», отдельное сохранение |
| source_page | Служебная связь | Нет в Q; требуется read редактору | Не источник hero/блоков | Скрыть из бизнес-формы, сохранить значение |
| translations | Нет потребителя в цепочке home | Нет в Q | Не меняет текущую страницу | Readonly сохранённое состояние |
| created_at | Служебное | Нет в Q | Нет публичного эффекта | При необходимости понятная дата |
| updated_at | CAS baseline; child hook меняет родителя | Нет в Q | Защита конкурентного редактирования | Не редактировать; reconcile не Save |

`safeContentHref` (`content.ts:267`) принимает локальные пути, HTTP(S), mailto/tel; текущая форма home принимает локальные/HTTP(S). Расширение протоколов не входит в предложение. Пустой текст или непригодная ссылка включает встроенную кнопку, а не скрывает её. Новый frontend не подключается.

## Дочерние блоки: поле → эффект

| Поле | Query/потребитель | Фактический эффект / предложение |
|---|---|---|
| title | getSections → B | Видимый заголовок; понятное имя строки редактора |
| text | getSections → B | Видимый текст |
| subtitle | getSections маппит, B не рендерит | Не выдавать за рабочую настройку; readonly |
| image / image_alt | getSections → B generic | Фото/описание в обычном блоке; ветка cta/parts_request/lead_form их не выводит |
| button_text / button_url | getSections → B SectionButton | Кнопка только если оба значения пригодны; иначе отсутствует (в отличие от hero fallback) |
| items | getSections → normalizeItems → B | Список; faq — раскрывающиеся ответы; обычные типы — сетка; callout-ветка items не показывает. Живая metadata 23.10: input-code JSON. Безопасный просмотр известных title/text/link, неизвестное не нормализовать; не требовать ручной JSON |
| settings | getSections маппит, B не использует | Readonly, прямо указать отсутствие эффекта |
| translations | Нет в Q | Readonly |
| section_type | Q → B | faq — ответы; cta/parts_request/lead_form — callout; остальные, в том числе неизвестные, — общая панель. Не обещать особое поведение по одному названию типа |
| status | Published filter | Readonly; включение черновика не публикует его; новая публикация не входит в A2 |
| is_visible | Published + visible filter | «Включён» не равно «опубликован»; отдельно объяснить оба условия |
| sort_order / owner / id / updated_at | Порядок, принадлежность, CAS | Display/служебное, не создавать reorder или смену владельца |

## Проверенное окружение и ограничения исследования

Windows/Node win32; Directus image 12.1.1; Compose `universal-commerce-cms-dev`; loopback `127.0.0.1:18056`. Подтверждённый bind: `C:/Users/Alexandr/.codex/worktrees/storefront-directus-acceptance/Universal Commerce CMS/directus/extensions`. Исторический путь D:/codex/Universal-Commerce-CMS-main — основной Git checkout, не фактический bind.

На исходном read-only осмотре singleton был опубликован, дочерних блоков не было; тогда данные не менялись. Снимки Before получены из исходного установленного интерфейса, After — отдельный HTML. После утверждения адресная приёмка изменила только журналируемые тестовые поля и создала собственные временные блоки; восстановление и очистка проверены отдельно. Реальные проверки эффекта полей, сохранений и состояний описаны в `../A2-UX-ACCEPTANCE.md`. Живая metadata items/settings — input-code, хотя studio-blueprint предлагает repeater: схема не меняется в A2. Сессия Administrator и существующий неадминистраторский gateway не являются приёмкой менеджерской роли.
