-- categories depth 1
insert into public.categories (parent_id, slug, name, path, product_count, sort_order)
select
  case when jsonb_array_length(x->'path') = 1 then null
       else (
         select id from public.categories p
         where p.path = (
           select array_agg(e order by ord)
           from jsonb_array_elements_text(x->'path') with ordinality t(e, ord)
           where ord < jsonb_array_length(x->'path')
         )
       )
  end,
  x->>'slug',
  x->>'name',
  array(select jsonb_array_elements_text(x->'path')),
  coalesce((x->>'product_count')::int, 0),
  coalesce((x->>'sort_order')::int, 0)
from jsonb_array_elements($json$[{"slug":"nautisme","name":"Nautisme","path":["nautisme"],"product_count":56,"sort_order":0},{"slug":"plongee","name":"Plongée","path":["plongee"],"product_count":476,"sort_order":29},{"slug":"peche","name":"Pêche","path":["peche"],"product_count":42,"sort_order":75},{"slug":"montagne","name":"Montagne","path":["montagne"],"product_count":427,"sort_order":95},{"slug":"glisse","name":"Glisse","path":["glisse"],"product_count":13,"sort_order":153},{"slug":"piscine","name":"Piscine","path":["piscine"],"product_count":318,"sort_order":163},{"slug":"textile","name":"Textile","path":["textile"],"product_count":1,"sort_order":208},{"slug":"alimentation","name":"Alimentation","path":["alimentation"],"product_count":247,"sort_order":210}]$json$) as x
on conflict (path) do update set
  name = excluded.name,
  product_count = excluded.product_count,
  sort_order = excluded.sort_order,
  parent_id = excluded.parent_id;
