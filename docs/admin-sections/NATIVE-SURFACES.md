# Системные разделы и вспомогательные редакторы
«Все разделы» покрывает 14 бизнес-экранов и все9supportcollections. Следующие native Directus surfaces сохраняются и интегрируются визуально средствами оболочки, без переписывания защищённых механизмов.

| Поверхность | Решение | Граница |
|---|---|---|
| Файлы / File Library | Native picker/upload внутри нужных редакторов, native глобальная библиотека | Не удалять общие файлы; permissions/native assets |
| Пользователи, роли, policies | Native | Auth/permissions protected, без новых прав |
| Settings, Data Model | Native | Schema/config protected |
| Flows / webhooks | Native существующие | Revalidation/lead processing внеUIscope |
| Insights / dashboards | Native workspace bookmarks/panels | Не придумывать новые KPI, не менять dashboard config |
| Revisions / Versions | Native mechanisms + existing guarded version routes в pages/home | Не заменять клиентской историей |
| Imports / SEO worker | Существующие CLI/jobs, readonly ссылки/состояния | Не создавать новый uploader/job manager без задания |

## Coverage support
page_sections → home_page/pages через общий A0 PageSectionEditor.
contact_channels → секции контактов home_page/pages, component A0, запись толькоG1.
articles_editor_nodes → articles, native Flexible Editor.
product_images,product_specifications,product_documents → products, действующий managed-child readonly regime.
order_items → orders, immutable исторический состав.
lead_forms → самостоятельная коллекция настроек, показывается как вспомогательный экран только для чтения рядом с `site_settings`; реальные поля-ссылки `products.lead_form` и `leads.lead_form`. `page_sections.section_type=lead_form` — только тип блока, без связи с этой коллекцией. `lead_forms` не поле `site_settings`; безопасность и обработка форм защищены.
seo_redirects → seo_work_items readonly support, самостоятельное точное поручение для CRUD.

Нет обещания нового CRM, schema editor или конструктора flow. Такие изменения не следуют из согласования общего стиля.

