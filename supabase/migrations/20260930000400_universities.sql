-- Asyq League — справочник вузов Казахстана.
insert into public.universities (id, name, city, sort) values
  ('narxoz',  'Narxoz University',                                  'Алматы',      1),
  ('kbtu',    'Kazakh-British Technical University',                'Алматы',      2),
  ('sdu',     'SDU University',                                     'Қаскелең',    3),
  ('aitu',    'Astana IT University',                               'Астана',      4),
  ('kaznu',   'Әл-Фараби атындағы ҚазҰУ',                           'Алматы',      5),
  ('enu',     'Л. Гумилев атындағы ЕҰУ',                            'Астана',      6),
  ('nu',      'Nazarbayev University',                              'Астана',      7),
  ('satbayev','Satbayev University',                                'Алматы',      8),
  ('kimep',   'KIMEP University',                                   'Алматы',      9),
  ('kaztu',   'Қ. Жұбанов атындағы АӨУ',                            'Ақтөбе',     10),
  ('buketov', 'Е. Бөкетов атындағы ҚарУ',                           'Қарағанды',  11),
  ('other',   'Басқа / Другой / Other',                             '—',         999)
on conflict (id) do update
  set name = excluded.name, city = excluded.city, sort = excluded.sort;
