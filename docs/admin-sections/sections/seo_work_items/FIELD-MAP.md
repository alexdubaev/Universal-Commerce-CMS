# Поля: SEO-задачи

Статический снимок blueprint/Studio, 2026-10-02. Это не выгрузка фактической БД. Требования readonly ниже дополнительно ограничивают UI; они не изменяют native permissions.

| Поле | Подпись | Тип | Обязательное | Режим нового UI | Допустимые значения / связь | Native group/interface |
|---|---|---|---|---|---|---|
| id | id | uuid | Да | Только просмотр до отдельного контракта | — |  |
| type | type | string | Нет | Только просмотр до отдельного контракта | — |  |
| subtype | subtype | string | Нет | Только просмотр до отдельного контракта | — |  |
| status | status | string | Да | Только просмотр до отдельного контракта | draft, ready, review, approved, processing, draft_created, retryable, applied, rolled_back, rejected |  |
| severity | severity | string | Нет | Только просмотр до отдельного контракта | — |  |
| priority_score | priority_score | integer | Нет | Только просмотр до отдельного контракта | — |  |
| confidence | confidence | decimal | Нет | Только просмотр до отдельного контракта | — |  |
| entity_type | entity_type | string | Нет | Только просмотр до отдельного контракта | — |  |
| entity_id | entity_id | uuid | Нет | Только просмотр до отдельного контракта | — |  |
| entity_key | entity_key | string | Нет | Только просмотр до отдельного контракта | — |  |
| url | url | string | Нет | Только просмотр до отдельного контракта | — |  |
| title | title | string | Нет | Только просмотр до отдельного контракта | — |  |
| summary | summary | text | Нет | Только просмотр до отдельного контракта | — |  |
| recommendation | recommendation | text | Нет | Только просмотр до отдельного контракта | — |  |
| current_value_json | current_value_json | json | Нет | Только просмотр до отдельного контракта | — |  |
| proposed_value_json | proposed_value_json | json | Нет | Только просмотр до отдельного контракта | — |  |
| patch_json | patch_json | json | Нет | Только просмотр до отдельного контракта | — |  |
| evidence_json | evidence_json | json | Нет | Только просмотр до отдельного контракта | — |  |
| sources_json | sources_json | json | Нет | Только просмотр до отдельного контракта | — |  |
| metrics_json | metrics_json | json | Нет | Только просмотр до отдельного контракта | — |  |
| dedupe_key | dedupe_key | string | Да | Только просмотр до отдельного контракта | — |  |
| before_hash | before_hash | string | Нет | Только просмотр до отдельного контракта | — |  |
| article | article | uuid | Нет | Только просмотр до отдельного контракта | "articles" |  |
| worker_run_id | worker_run_id | string | Нет | Только просмотр до отдельного контракта | — |  |
| claimed_at | claimed_at | timestamp | Нет | Только просмотр до отдельного контракта | — |  |
| expires_at | expires_at | timestamp | Нет | Только просмотр до отдельного контракта | — |  |
| applied_at | applied_at | timestamp | Нет | Только просмотр до отдельного контракта | — |  |
| rolled_back_at | rolled_back_at | timestamp | Нет | Только просмотр до отдельного контракта | — |  |
| last_error | last_error | text | Нет | Только просмотр до отдельного контракта | — |  |
| created_at | created_at | timestamp | Нет | Только просмотр до отдельного контракта | — |  |
| updated_at | updated_at | timestamp | Нет | Только просмотр до отдельного контракта | — |  |
