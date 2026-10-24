# A2 — предварительный аудит полей home_page и публичного Next.js

> Исторический срез, не доказательство текущего поведения. Актуальная матрица A2-UX-FIX от 23.10.2026 для main `5b7879b` находится в [FIELD-CONSUMERS-CURRENT.md](../ux-proposal/FIELD-CONSUMERS-CURRENT.md). Она учитывает подключённый поиск в шапке, SEO hook-проекции и live metadata блоков. Выводы ниже о поиске и отсутствии эффекта всего SEO JSON устарели.

Срез `main = 9b810ff63e363c17c288f409cff6a25d9cc3de7d` на момент проектирования. Это **статическая сверка кода** `storefront/lib/content.ts`, `storefront/app/page.tsx`, `storefront/components/Header.tsx`, `CmsPageRenderer.tsx`, не runtime/production-проверка. Агент обязан обновить матрицу по актуальному main и реальному сайту.

| Поля | Из CMS читается? | Что делает текущая витрина | Вывод для A2 |
|---|---|---|---|
| `status` | Да | Опубликованная `home_page` даёт CMS home; иначе fallback | Критично; не менять обычным Save незаметно |
| `h1` | Да | Используется для metadata fallback при отсутствии `seo_title`; hero `<h1>` берёт `hero_title` | Объяснить разницу двух полей |
| `hero_title`, `hero_text` | Да | Текст первого экрана и запасные SEO значения | Поля видимы |
| `hero_image`, `hero_image_alt` | Да | Изображение hero, alt и fallback OG image | Поля видимы |
| `hero_primary_button_*`, `hero_secondary_button_*` | Да | Ссылки и подписи кнопок hero; URL валидируются `safeContentHref` | Видимы при корректных URL |
| `hero_search_label`, `hero_search_placeholder`, `hero_search_button_text` | Да (в адаптере) | В текущем `app/page.tsx` не передаются в поиск; Header использует свою логику | Хранятся, но реальный эффект на публичный поиск не подтверждён |
| `hero_bulk_prompt`, `hero_bulk_link_*`, `hero_excel_link_*`, `hero_photo_link_*` | Не входят в текущий запрос `getCmsHome` | Не используются в нынешнем `app/page.tsx`; другие ссылки заданы в коде | При сохранении могут не изменять текущую витрину |
| `seo_title`, `seo_description`, `canonical_url`, `is_indexable` | Да | Метаданные, canonical/robots indexability | Публичный эффект существует после публикации/инвалидации |
| `og_title`, `og_description`, `og_image`, `seo` (JSON) | Нет, не в текущем запросе `getCmsHome` | В `app/page.tsx` OG использует hero title/desc и hero image вместо этих отдельных полей | Заполняются в CMS, но текущий main не демонстрирует эффекта этих полей на OG |
| `sections` alias | Не напрямую | Читаются отдельные опубликованные `page_sections` привязанные к `home_page` | Видны при статусах/поддерживаемых типах; A0 сохраняет child отдельно |
| `source_page`, `translations`, техполя | Не в публичном запросе home | Не рендерятся непосредственно в главной | Служебные/будущие |

**Важное ограничение:** часть главной витрины (список брендов, категории, подборка товаров, «Как заказать», статьи) реализована кодом и другими источниками, а не редактируется как обычные дочерние секции `home_page`. A2 не обещает управлять ими через drag-and-drop или заменить их без отдельного изменения storefront.

Если пользователь позже захочет «все блоки главной настраиваются в CMS и показываются на витрине», оформить **отдельную** задачу после A2 с явными frontend/contracts правками. Не делать это скрытно в UI-A2.
