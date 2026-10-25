# A5 — действующие потребители настроек

Проверено по коду main `6bbfd3cdbc06fc17fa91251f92218480778bb44f`, 25.10.2026. Это уточнение исторической матрицы v3, не заявление о live-эффекте каждого поля. UI A5 и серверный guard не подключают новые поля к витрине.

Путь чтения: `directus/extensions/commerce-api/src/storefront.mjs` → `storefront/lib/content.ts:getCmsSiteSettings()` → компоненты и страницы. Gateway допускает21 поле; Next.js запрашивает17, из них15 имеют потребителя. Четыре file-связи также участвуют в проверке доступности asset, хотя Next.js их не запрашивает.

| Поля | Потребитель и эффект | Ограничение |
|---|---|---|
| company_name | Header: подпись ссылки; Footer, about, Organization JSON-LD | Название не заменяет статический логотип |
| phone, email | Header/Footer, contacts и Organization JSON-LD | Контент кешируется; мгновенное обновление не обещается |
| city, address, working_hours | Footer и contacts; address также fallback JSON-LD | Юридический и фактический адрес остаются разными полями |
| legal_name, legal_address | Organization JSON-LD в app/layout.tsx | Самостоятельного видимого блока с этими двумя значениями нет |
| inn, kpp, ogrn | contacts, подпись ссылки Footer; inn также Organization JSON-LD | Идентификаторы — строки, ведущие нули сохраняются |
| vat_info | Встроенная страница payment | CMS-страница может заменить встроенное содержимое |
| delivery_region | Заголовок встроенной delivery | CMS-страница может заменить встроенное содержимое |
| footer_text, footer_disclaimer | Footer | Применяются; их нельзя объявлять неподключёнными вместе со всем оформлением |
| primary_cta_text, primary_cta_url | Запрашиваются getCmsSiteSettings | Render-потребитель не найден; сейчас не меняют основную кнопку |
| logo, favicon, company_image, default_og_image | Gateway allowlist и проверка file-reference eligibility | Глобальные изображения витрины их пока не используют. Новый файл дополнительно должен быть читаемым изображением в существующей настроенной публичной папке |
| primary_color, accent_color | Потребитель не найден | Тема витрины задана в app/theme.css |
| seo_title, seo_description, og_title, og_description | В общем getCmsSiteSettings не запрашиваются | Глобальные metadata заданы в app/layout.tsx; у отдельных страниц есть собственные поисковые настройки |
| requisites_url, documents_url | Потребитель не найден | Сохраняются как данные настроек, без обещания появления ссылки на сайте |
| messengers, social_links | Потребитель не найден; live metadata — input-code | В A5 только понятное пояснение, без JSON-ввода/автоматического преобразования |
| commerce_profile, analytics IDs, translations, id, created_at, updated_at | Служебные данные | Не показываются менеджеру и не входят в changes; id/updated_at используются технически для CAS |

Запрос `revalidate:120` не гарантирует обновление ровно через две минуты. Для effect acceptance различаются статический путь, реальный gateway/API и видимое представление установленной витрины. Локальный пример поисковой карточки — иллюстрация, не реальная поисковая выдача.
