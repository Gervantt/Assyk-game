-- Asyq League — автор пользовательского испытания проставляется сам.
--
-- Политика custom_levels_insert_own проверяет author_id = auth.uid(), но у
-- колонки не было значения по умолчанию. Клиент вставлял только title и
-- layout, author_id уходил пустым, и создание испытания падало с 403.
-- Значение по умолчанию убирает целый класс таких ошибок: забыть про
-- author_id больше нельзя.
alter table public.custom_levels
  alter column author_id set default auth.uid();
