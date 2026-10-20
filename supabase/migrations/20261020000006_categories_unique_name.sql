-- =====================================================================
-- Cotaí — nome de categoria único (sem diferenciar maiúsculas)
-- =====================================================================

-- Junta duplicatas que já existam: mantém a mais antiga e repassa os itens
with ranked as (
  select id, first_value(id) over (partition by lower(btrim(name)) order by created_at, id) as keep_id
  from public.categories
)
update public.quote_items qi
set category_id = r.keep_id
from ranked r
where qi.category_id = r.id and r.id <> r.keep_id;

delete from public.categories c
using (
  select id, first_value(id) over (partition by lower(btrim(name)) order by created_at, id) as keep_id
  from public.categories
) r
where c.id = r.id and r.id <> r.keep_id;

create unique index categories_name_key on public.categories (lower(btrim(name)));
