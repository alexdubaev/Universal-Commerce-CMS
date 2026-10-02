# Разделы и самостоятельные задания

Все ссылки локальны и работают после распаковки архива с сохранением структуры. Откройте mockups.html обычным браузером: макет автономный, без подключения к CMS. Переключение разделов, вкладок и ширины390px демонстрационное. Обычная запись в пакет не означает разрешение на защищённые API/данные.

| Раздел | ТЗ и поля | Задание исполнителю | Макет | Волна / зависимость |
|---|---|---|---|---|
| Главная страница | [ТЗ](sections/home_page/TZ.md), [поля](sections/home_page/FIELD-MAP.md) | [LAUNCH](sections/home_page/LAUNCH.md) | [Экран](sections/home_page/mockup.html) | 1: A0, версии/секции |
| Страницы | [ТЗ](sections/pages/TZ.md), [поля](sections/pages/FIELD-MAP.md) | [LAUNCH](sections/pages/LAUNCH.md) | [Экран](sections/pages/mockup.html) | 1: A0, версии/секции |
| Меню | [ТЗ](sections/navigation_items/TZ.md), [поля](sections/navigation_items/FIELD-MAP.md) | [LAUNCH](sections/navigation_items/LAUNCH.md) | [Экран](sections/navigation_items/mockup.html) | 1R → 2: A0 + G1 для записи |
| Товары | [ТЗ](sections/products/TZ.md), [поля](sections/products/FIELD-MAP.md) | [LAUNCH](sections/products/LAUNCH.md) | [Экран](sections/products/mockup.html) | 3: Существующий эталон, регрессия |
| Категории | [ТЗ](sections/categories/TZ.md), [поля](sections/categories/FIELD-MAP.md) | [LAUNCH](sections/categories/LAUNCH.md) | [Экран](sections/categories/mockup.html) | 1: A0, текущий CAS/permissions |
| Коды товаров | [ТЗ](sections/product_codes/TZ.md), [поля](sections/product_codes/FIELD-MAP.md) | [LAUNCH](sections/product_codes/LAUNCH.md) | [Экран](sections/product_codes/mockup.html) | 1: A0, текущий CAS/identity/permissions |
| Аналоги товаров | [ТЗ](sections/products_analogs/TZ.md), [поля](sections/products_analogs/FIELD-MAP.md) | [LAUNCH](sections/products_analogs/LAUNCH.md) | [Экран](sections/products_analogs/mockup.html) | 1R → 2G: A0, readonly до G2 |
| Статьи | [ТЗ](sections/articles/TZ.md), [поля](sections/articles/FIELD-MAP.md) | [LAUNCH](sections/articles/LAUNCH.md) | [Экран](sections/articles/mockup.html) | 1: A0, native Flexible Editor/SEO |
| Вопросы и ответы | [ТЗ](sections/faq_items/TZ.md), [поля](sections/faq_items/FIELD-MAP.md) | [LAUNCH](sections/faq_items/LAUNCH.md) | [Экран](sections/faq_items/mockup.html) | 1R → 2: A0 + G1 для записи |
| Недавние поставки | [ТЗ](sections/recent_supplies/TZ.md), [поля](sections/recent_supplies/FIELD-MAP.md) | [LAUNCH](sections/recent_supplies/LAUNCH.md) | [Экран](sections/recent_supplies/mockup.html) | 1R → 2: A0 + G1 для записи |
| Заявки | [ТЗ](sections/leads/TZ.md), [поля](sections/leads/FIELD-MAP.md) | [LAUNCH](sections/leads/LAUNCH.md) | [Экран](sections/leads/mockup.html) | 1R → 2: A0 + отдельный G1 operational |
| Заказы | [ТЗ](sections/orders/TZ.md), [поля](sections/orders/FIELD-MAP.md) | [LAUNCH](sections/orders/LAUNCH.md) | [Экран](sections/orders/mockup.html) | 1R → 2: A0 + отдельный G1 operational |
| Настройки сайта | [ТЗ](sections/site_settings/TZ.md), [поля](sections/site_settings/FIELD-MAP.md) | [LAUNCH](sections/site_settings/LAUNCH.md) | [Экран](sections/site_settings/mockup.html) | 1: A0, protected settings readonly |
| SEO-задачи | [ТЗ](sections/seo_work_items/TZ.md), [поля](sections/seo_work_items/FIELD-MAP.md) | [LAUNCH](sections/seo_work_items/LAUNCH.md) | [Экран](sections/seo_work_items/mockup.html) | 1R: A0, readonly lifecycle |

Перед стартом каждой секции выполните предстартовый блок её LAUNCH: актуальный destination HEAD, чистая отдельная task branch/worktree, принятый A0, live contract check и индивидуальный allowlist. Архивные SHA не используются как рабочие базы. Каждый LAUNCH указывает совместимый путь `directus/extensions/deere-shop-product-editor`; отсутствие реализации иных редакторов не маскируется документами.

Перед стартом каждой секции выполните предстартовый блок её LAUNCH: актуальный destination HEAD, чистая отдельная task branch/worktree, принятый A0, live contract check и индивидуальный allowlist. Архивные SHA не используются как рабочие базы. Каждый LAUNCH указывает совместимый путь `directus/extensions/deere-shop-product-editor`; документы не утверждают, что все секции уже реализованы.

Каждая папка содержит TZ.md, LAUNCH.md, routes.md, FIELD-MAP.md, fields.json и fixture.json. Fixture — offline demo, не импортировать. Общие правила: DESIGN-SYSTEM.md и CONTRACTS.md; схема и происхождение: RESEARCH.md + research; 9 вспомогательных коллекций: support и NATIVE-SURFACES.md.

Стартовая архитектурная задача A0 и backend gates G1/G2 описаны в PLAN.md. Для параллельной реализации сначала фиксируются exports A0; затем каждый исполнитель работает в своём src/sections/<collection>.js + dist mirror + test и передаёт reviewed commit интегратору. Индекс/маршрутизация и общий PageSectionEditor имеют одного владельца.




