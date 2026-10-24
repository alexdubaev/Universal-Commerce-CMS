# A5 — Поля CMS и реальные потребители витрины

**Исходный аудит статического кода (унаследованная матрица):** 19.10.2026, `main` SHA `5cb9958181d4df211d9dcaccd16aa66439a8b8bb`.

В предыдущем пакете 19.10.2026 были проверены schema/studio blueprint, `commerce-api/src/storefront.mjs`, `storefront/lib/content.ts`, `storefront/lib/types.ts`, 54 файла страниц и компонентов, включая Header, Footer, layout, contacts, payment, delivery и about. Это **не** live-проверка базы, прав и окружения. Фактические metadata/permissions Directus 12.1.1 проверяются при реализации.

В итерации v3 повторно подтверждён неизменившийся SHA main через GitHub и перечитан `getCmsSiteSettings()`. Повторный полный обход всех страниц не выполнялся. Ниже сохранены результаты исходного аудита с обновлёнными названиями групп. При изменении main матрица требует обновления.

## Выводы

* В `site_settings` **38 физических полей** по актуальному `directus/schema/blueprint.mjs`.
* Публичный шлюз содержит **21 поле** в `site_settings` allowlist; Next.js `getCmsSiteSettings()` запрашивает **17**.
* **15 полей** на текущей витрине имеют подтверждённый потребитель. Два поля CTA запрашиваются, но не используются. Четыре file-поля разрешены в шлюзе, но не запрашиваются Next.js.
* Логотип Header/Footer является статическим файлом; цвета прописаны в `storefront/app/theme.css`; глобальные metadata заданы статически в `storefront/app/layout.tsx`.
* Изменения видимых полей могут проявиться не сразу: `getCmsSiteSettings` запрашивается с `revalidate: 120`. Также существуют страницы с собственными CMS SEO-полями.
* Исторический `fields.json` описывает старые цвета `#245c2a` / `#f2c94c`, актуальный `blueprint.mjs` — `#2563eb` / `#f59e0b`. Источником истины является свежая схема и live metadata, не архивный JSON.
* `logo`, `favicon` имеют явный `file-image` interface; `company_image` и `default_og_image` связаны с `directus_files`, но в текущем studio blueprint не имеют явного file picker interface. Их редактирование через picker блокировать до подтверждения native behavior.
* `social_links` — JSON без документированного визуального формата; не предлагать менеджеру ручной JSON, держать readonly до отдельного контракта.

## Матрица всех 38 полей

| Поле | Gateway | Next.js читает | Эффект сейчас | Экран A5 |
|---|---|---|---|---|
| id | нет | нет | только служебный CAS identity | Служебная информация |
| company_name | да | да | используется | Компания |
| phone | да | да | используется | Контакты |
| email | да | да | используется | Контакты |
| messengers | нет | нет | не выводится на витрине | Контакты · дополнительные |
| social_links | нет | нет | не выводится; JSON-формат не определён | Контакты · дополнительные |
| commerce_profile | нет | нет | служебный профиль | Служебная информация |
| address | да | да | используется | Контакты |
| city | да | да | используется | Контакты |
| working_hours | да | да | используется | Контакты |
| delivery_region | да | да | используется | Контакты |
| logo | да | нет | CMS хранит, витрина не использует | Оформление |
| favicon | да | нет | CMS хранит, витрина не использует | Оформление |
| default_og_image | да | нет | CMS хранит, витрина не использует | Поиск и соцсети |
| seo_title | нет | нет | CMS хранит, витрина не использует | Поиск и соцсети |
| seo_description | нет | нет | CMS хранит, витрина не использует | Поиск и соцсети |
| og_title | нет | нет | CMS хранит, витрина не использует | Поиск и соцсети |
| og_description | нет | нет | CMS хранит, витрина не использует | Поиск и соцсети |
| primary_color | нет | нет | CMS хранит, витрина не использует | Оформление |
| accent_color | нет | нет | CMS хранит, витрина не использует | Оформление |
| primary_cta_text | да | да | прочитано, но не использовано | Оформление |
| primary_cta_url | да | да | прочитано, но не использовано | Оформление |
| footer_text | да | да | используется | Оформление |
| footer_disclaimer | да | да | используется | Оформление |
| inn | да | да | используется | Компания · реквизиты |
| kpp | да | да | используется | Компания · реквизиты |
| ogrn | да | да | используется | Компания · реквизиты |
| legal_address | да | да | используется в metadata, визуального эффекта нет | Компания · реквизиты |
| legal_name | да | да | используется в metadata, визуального эффекта нет | Компания |
| vat_info | да | да | используется | Компания · реквизиты |
| requisites_url | нет | нет | CMS хранит, витрина не использует | Компания · дополнительные |
| documents_url | нет | нет | CMS хранит, витрина не использует | Компания · дополнительные |
| company_image | да | нет | CMS хранит, витрина не использует | Оформление |
| yandex_metrica_id | нет | нет | служебный идентификатор | Служебная информация |
| gtm_id | нет | нет | служебный идентификатор | Служебная информация |
| translations | нет | нет | не выводится | Служебная информация |
| created_at | нет | нет | системное поле | Служебная информация |
| updated_at | нет | нет | системный CAS baseline | Служебная информация |

## Подтверждённые пути

`directus/schema/blueprint.mjs` → `directus/schema/studio-blueprint.mjs` → `directus/extensions/commerce-api/src/storefront.mjs` → `storefront/lib/content.ts` → `storefront/lib/types.ts` → потребители:

* `storefront/components/Header.tsx`: company_name, phone, email (но не logo).
* `storefront/components/Footer.tsx`: company_name, phone, email, city, address, working_hours, footer_text, footer_disclaimer, inn/kpp/ogrn для подписи ссылки (но не logo).
* `storefront/app/layout.tsx`: JSON-LD Organization через company_name/legal_name, phone, email, address/legal_address, inn; статические metadata.
* `storefront/app/about/page.tsx`: company_name.
* `storefront/app/contacts/page.tsx`: company_name, phone, email, city, address, working_hours, inn, kpp, ogrn.
* `storefront/app/delivery/page.tsx`: delivery_region.
* `storefront/app/payment/page.tsx`: vat_info.

## Ограничения интерпретации

«Gateway: да» означает **только включение поля в публичный allowlist**, а не право чтения в каждой реальной инстанции и не фактический вывод в браузере. «Next.js читает: да» означает запрос через `getCmsSiteSettings()`, но не обязательно наличие render consumer. «Используется» означает статически подтверждённый consumer, а не live E2E. Изменение контента в Directus не равно мгновенному изменению видимого сайта.

## Режимы v3

38 физических полей: 30 потенциально редактируемых по live metadata/permissions; 7 защищённых полей; `social_links` дополнительно readonly из-за неподтверждённого формата. Это проектный UI-scope, не автоматически выданные права. `messengers` сохраняет неизвестные свойства, а при неизвестной структуре остаётся readonly.

Отсутствие видимого потребителя file-поля не отменяет проверки публичной eligibility: связь с site_settings может участвовать в gateway asset policy. Применение на сайте и разрешение чтения файла — разные вопросы.
