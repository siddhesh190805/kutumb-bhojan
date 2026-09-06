-- Supplemental Phase 2 catalog entries used by legacy recipe normalization.
insert into public.ingredients(canonical_key,name,marathi_name,aliases,category,default_unit) values
('turmeric','Turmeric','हळद','["turmeric","haldi","हळद"]','Spices','g'),
('cumin','Cumin','जिरे','["cumin","jeera","जिरे"]','Spices','g'),
('coriander','Coriander','कोथिंबीर','["coriander","cilantro","कोथिंबीर"]','Vegetables','g'),
('lemon','Lemon','लिंबू','["lemon","lemons","लिंबू"]','Fruits','piece'),
('salt','Salt','मीठ','["salt","मीठ"]','Other','g')
on conflict (canonical_key) do update set name=excluded.name,marathi_name=excluded.marathi_name,aliases=excluded.aliases,category=excluded.category,default_unit=excluded.default_unit,active=true,updated_at=now();
