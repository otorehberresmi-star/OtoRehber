-- Generated vehicle_specs import.
-- Review source/source_url before running.
begin;

insert into public.vehicle_specs (
  brand_id,
  model_id,
  year,
  trim,
  engine,
  fuel_type,
  transmission,
  body_type,
  power_hp,
  torque_nm,
  fuel_consumption_l_100km,
  boot_space_l,
  length_mm,
  width_mm,
  height_mm,
  source,
  source_url,
  metadata
) values (
  'e6d6aa6e-cb8b-4b16-a51b-678be344296b'::uuid,
  '4106b146-4e4e-4f88-ad31-8c5b83fbe64f'::uuid,
  '2024',
  '1.5 Vision Multidrive S',
  '1.5',
  'Gasoline',
  'CVT',
  'Sedan',
  125,
  153,
  5.5,
  471,
  4630,
  1780,
  1435,
  'technical_catalog',
  'https://zhytauto.com/wp-content/uploads/2024/09/Toyota-corolla.pdf',
  jsonb_build_object(
    'imported_from', 'data/vehicle_specs_import.csv',
    'brand_name', 'Toyota',
    'model_name', 'Corolla'
  )
)
on conflict (
  model_id,
  coalesce(nullif(btrim(year), ''), 'any'),
  coalesce(nullif(btrim("trim"), ''), 'standard'),
  source
)
do update set
  brand_id = excluded.brand_id,
  engine = excluded.engine,
  fuel_type = excluded.fuel_type,
  transmission = excluded.transmission,
  body_type = excluded.body_type,
  power_hp = excluded.power_hp,
  torque_nm = excluded.torque_nm,
  fuel_consumption_l_100km = excluded.fuel_consumption_l_100km,
  boot_space_l = excluded.boot_space_l,
  length_mm = excluded.length_mm,
  width_mm = excluded.width_mm,
  height_mm = excluded.height_mm,
  source_url = excluded.source_url,
  metadata = excluded.metadata,
  updated_at = now();

insert into public.vehicle_specs (
  brand_id,
  model_id,
  year,
  trim,
  engine,
  fuel_type,
  transmission,
  body_type,
  power_hp,
  torque_nm,
  fuel_consumption_l_100km,
  boot_space_l,
  length_mm,
  width_mm,
  height_mm,
  source,
  source_url,
  metadata
) values (
  '45b7c1c8-be8b-4681-a174-84cdf86e70c3'::uuid,
  '9f613773-6b40-42fc-b0c5-f53c62832a24'::uuid,
  '2024',
  'Easy 1.4 Fire Manual',
  '1.4 Fire',
  'Gasoline',
  'Manual',
  'Sedan',
  95,
  127,
  6.4,
  520,
  4532,
  1792,
  1497,
  'technical_catalog',
  'https://www.cardimension.net/model/2024/fiat/egea/1-4-fire/easy-manual.html',
  jsonb_build_object(
    'imported_from', 'data/vehicle_specs_import.csv',
    'brand_name', 'Fiat',
    'model_name', 'Egea'
  )
)
on conflict (
  model_id,
  coalesce(nullif(btrim(year), ''), 'any'),
  coalesce(nullif(btrim("trim"), ''), 'standard'),
  source
)
do update set
  brand_id = excluded.brand_id,
  engine = excluded.engine,
  fuel_type = excluded.fuel_type,
  transmission = excluded.transmission,
  body_type = excluded.body_type,
  power_hp = excluded.power_hp,
  torque_nm = excluded.torque_nm,
  fuel_consumption_l_100km = excluded.fuel_consumption_l_100km,
  boot_space_l = excluded.boot_space_l,
  length_mm = excluded.length_mm,
  width_mm = excluded.width_mm,
  height_mm = excluded.height_mm,
  source_url = excluded.source_url,
  metadata = excluded.metadata,
  updated_at = now();

insert into public.vehicle_specs (
  brand_id,
  model_id,
  year,
  trim,
  engine,
  fuel_type,
  transmission,
  body_type,
  power_hp,
  torque_nm,
  fuel_consumption_l_100km,
  boot_space_l,
  length_mm,
  width_mm,
  height_mm,
  source,
  source_url,
  metadata
) values (
  '6408d46b-e2bc-4bba-a80e-a626b2108083'::uuid,
  '2c434849-f253-4835-9408-3686fc095b15'::uuid,
  '2023',
  'Touch 1.0 TCe X-Tronic',
  '1.0 TCe',
  'Gasoline',
  'X-Tronic',
  'Hatchback',
  90,
  142,
  5.0,
  391,
  4053,
  1798,
  1440,
  'technical_catalog',
  'https://www.cardimension.net/model/2023/renault/clio/1-0-tce/touch-automatic.html',
  jsonb_build_object(
    'imported_from', 'data/vehicle_specs_import.csv',
    'brand_name', 'Renault',
    'model_name', 'Clio'
  )
)
on conflict (
  model_id,
  coalesce(nullif(btrim(year), ''), 'any'),
  coalesce(nullif(btrim("trim"), ''), 'standard'),
  source
)
do update set
  brand_id = excluded.brand_id,
  engine = excluded.engine,
  fuel_type = excluded.fuel_type,
  transmission = excluded.transmission,
  body_type = excluded.body_type,
  power_hp = excluded.power_hp,
  torque_nm = excluded.torque_nm,
  fuel_consumption_l_100km = excluded.fuel_consumption_l_100km,
  boot_space_l = excluded.boot_space_l,
  length_mm = excluded.length_mm,
  width_mm = excluded.width_mm,
  height_mm = excluded.height_mm,
  source_url = excluded.source_url,
  metadata = excluded.metadata,
  updated_at = now();

insert into public.vehicle_specs (
  brand_id,
  model_id,
  year,
  trim,
  engine,
  fuel_type,
  transmission,
  body_type,
  power_hp,
  torque_nm,
  fuel_consumption_l_100km,
  boot_space_l,
  length_mm,
  width_mm,
  height_mm,
  source,
  source_url,
  metadata
) values (
  '56a63fbe-8ac2-4f55-bef6-f4aeec275dd8'::uuid,
  'dbd4883c-8392-451d-9408-20f734c9fa00'::uuid,
  '2024',
  '1.5 eTSI DSG',
  '1.5 eTSI',
  'Gasoline',
  'DSG',
  'Hatchback',
  150,
  250,
  5.3,
  381,
  4284,
  1789,
  1483,
  'technical_catalog',
  'https://www.auto-data.net/en/volkswagen-golf-viii-facelift-2024-1.5-tsi-150hp-51250',
  jsonb_build_object(
    'imported_from', 'data/vehicle_specs_import.csv',
    'brand_name', 'Volkswagen',
    'model_name', 'Golf'
  )
)
on conflict (
  model_id,
  coalesce(nullif(btrim(year), ''), 'any'),
  coalesce(nullif(btrim("trim"), ''), 'standard'),
  source
)
do update set
  brand_id = excluded.brand_id,
  engine = excluded.engine,
  fuel_type = excluded.fuel_type,
  transmission = excluded.transmission,
  body_type = excluded.body_type,
  power_hp = excluded.power_hp,
  torque_nm = excluded.torque_nm,
  fuel_consumption_l_100km = excluded.fuel_consumption_l_100km,
  boot_space_l = excluded.boot_space_l,
  length_mm = excluded.length_mm,
  width_mm = excluded.width_mm,
  height_mm = excluded.height_mm,
  source_url = excluded.source_url,
  metadata = excluded.metadata,
  updated_at = now();

insert into public.vehicle_specs (
  brand_id,
  model_id,
  year,
  trim,
  engine,
  fuel_type,
  transmission,
  body_type,
  power_hp,
  torque_nm,
  fuel_consumption_l_100km,
  boot_space_l,
  length_mm,
  width_mm,
  height_mm,
  source,
  source_url,
  metadata
) values (
  '3276bcc1-f8e7-4c81-9d24-06f170cb0ebd'::uuid,
  '0b2ad202-f5ad-4873-b49f-763323d722e7'::uuid,
  '2024',
  '1.5 VTEC Turbo CVT',
  '1.5 VTEC Turbo',
  'Gasoline',
  'CVT',
  'Sedan',
  182,
  240,
  6.7,
  519,
  4678,
  1802,
  1415,
  'technical_catalog',
  'https://www.auto-data.net/en/honda-civic-xi-sedan-1.5-turbo-182hp-cvt-46151',
  jsonb_build_object(
    'imported_from', 'data/vehicle_specs_import.csv',
    'brand_name', 'Honda',
    'model_name', 'Civic'
  )
)
on conflict (
  model_id,
  coalesce(nullif(btrim(year), ''), 'any'),
  coalesce(nullif(btrim("trim"), ''), 'standard'),
  source
)
do update set
  brand_id = excluded.brand_id,
  engine = excluded.engine,
  fuel_type = excluded.fuel_type,
  transmission = excluded.transmission,
  body_type = excluded.body_type,
  power_hp = excluded.power_hp,
  torque_nm = excluded.torque_nm,
  fuel_consumption_l_100km = excluded.fuel_consumption_l_100km,
  boot_space_l = excluded.boot_space_l,
  length_mm = excluded.length_mm,
  width_mm = excluded.width_mm,
  height_mm = excluded.height_mm,
  source_url = excluded.source_url,
  metadata = excluded.metadata,
  updated_at = now();

insert into public.vehicle_specs (
  brand_id,
  model_id,
  year,
  trim,
  engine,
  fuel_type,
  transmission,
  body_type,
  power_hp,
  torque_nm,
  fuel_consumption_l_100km,
  boot_space_l,
  length_mm,
  width_mm,
  height_mm,
  source,
  source_url,
  metadata
) values (
  '9fb1e5c1-0349-46c2-b120-957898c3b576'::uuid,
  '3487ad59-c864-4c66-b333-4e964fae3315'::uuid,
  '2022',
  '1.0 EcoBoost 125',
  '1.0 EcoBoost',
  'Gasoline',
  'Manual',
  'Hatchback',
  125,
  170,
  5.4,
  392,
  4382,
  1825,
  1452,
  'technical_catalog',
  'https://www.auto-data.net/en/ford-focus-iv-active-facelift-2022-1.0-ecoboost-125hp-46587',
  jsonb_build_object(
    'imported_from', 'data/vehicle_specs_import.csv',
    'brand_name', 'Ford',
    'model_name', 'Focus'
  )
)
on conflict (
  model_id,
  coalesce(nullif(btrim(year), ''), 'any'),
  coalesce(nullif(btrim("trim"), ''), 'standard'),
  source
)
do update set
  brand_id = excluded.brand_id,
  engine = excluded.engine,
  fuel_type = excluded.fuel_type,
  transmission = excluded.transmission,
  body_type = excluded.body_type,
  power_hp = excluded.power_hp,
  torque_nm = excluded.torque_nm,
  fuel_consumption_l_100km = excluded.fuel_consumption_l_100km,
  boot_space_l = excluded.boot_space_l,
  length_mm = excluded.length_mm,
  width_mm = excluded.width_mm,
  height_mm = excluded.height_mm,
  source_url = excluded.source_url,
  metadata = excluded.metadata,
  updated_at = now();

insert into public.vehicle_specs (
  brand_id,
  model_id,
  year,
  trim,
  engine,
  fuel_type,
  transmission,
  body_type,
  power_hp,
  torque_nm,
  fuel_consumption_l_100km,
  boot_space_l,
  length_mm,
  width_mm,
  height_mm,
  source,
  source_url,
  metadata
) values (
  '405d6329-52c9-4b76-9ac2-27d575fe5402'::uuid,
  'c7fb7076-e8d1-4e1f-9889-c2ba1462ef68'::uuid,
  '2022',
  '1.2 Turbo 130',
  '1.2 Turbo',
  'Gasoline',
  'Manual',
  'Hatchback',
  130,
  230,
  5.5,
  422,
  4374,
  1860,
  1441,
  'technical_catalog',
  'https://www.auto-data.net/en/opel-astra-l-1.2-turbo-130hp-44978',
  jsonb_build_object(
    'imported_from', 'data/vehicle_specs_import.csv',
    'brand_name', 'Opel',
    'model_name', 'Astra'
  )
)
on conflict (
  model_id,
  coalesce(nullif(btrim(year), ''), 'any'),
  coalesce(nullif(btrim("trim"), ''), 'standard'),
  source
)
do update set
  brand_id = excluded.brand_id,
  engine = excluded.engine,
  fuel_type = excluded.fuel_type,
  transmission = excluded.transmission,
  body_type = excluded.body_type,
  power_hp = excluded.power_hp,
  torque_nm = excluded.torque_nm,
  fuel_consumption_l_100km = excluded.fuel_consumption_l_100km,
  boot_space_l = excluded.boot_space_l,
  length_mm = excluded.length_mm,
  width_mm = excluded.width_mm,
  height_mm = excluded.height_mm,
  source_url = excluded.source_url,
  metadata = excluded.metadata,
  updated_at = now();

insert into public.vehicle_specs (
  brand_id,
  model_id,
  year,
  trim,
  engine,
  fuel_type,
  transmission,
  body_type,
  power_hp,
  torque_nm,
  fuel_consumption_l_100km,
  boot_space_l,
  length_mm,
  width_mm,
  height_mm,
  source,
  source_url,
  metadata
) values (
  '7a6d819f-8924-491b-8149-a4fe1a110c9c'::uuid,
  '1c620100-6912-4161-8f6e-ee7ae32a5205'::uuid,
  '2024',
  '1.0 T-GDI 100 DCT',
  '1.0 T-GDI',
  'Gasoline',
  'DCT',
  'Hatchback',
  100,
  172,
  5.3,
  352,
  4065,
  1775,
  1450,
  'technical_catalog',
  'https://www.auto-data.net/en/hyundai-i20-iii-facelift-2023-1.0-t-gdi-100hp-dct-50003',
  jsonb_build_object(
    'imported_from', 'data/vehicle_specs_import.csv',
    'brand_name', 'Hyundai',
    'model_name', 'i20'
  )
)
on conflict (
  model_id,
  coalesce(nullif(btrim(year), ''), 'any'),
  coalesce(nullif(btrim("trim"), ''), 'standard'),
  source
)
do update set
  brand_id = excluded.brand_id,
  engine = excluded.engine,
  fuel_type = excluded.fuel_type,
  transmission = excluded.transmission,
  body_type = excluded.body_type,
  power_hp = excluded.power_hp,
  torque_nm = excluded.torque_nm,
  fuel_consumption_l_100km = excluded.fuel_consumption_l_100km,
  boot_space_l = excluded.boot_space_l,
  length_mm = excluded.length_mm,
  width_mm = excluded.width_mm,
  height_mm = excluded.height_mm,
  source_url = excluded.source_url,
  metadata = excluded.metadata,
  updated_at = now();

insert into public.vehicle_specs (
  brand_id,
  model_id,
  year,
  trim,
  engine,
  fuel_type,
  transmission,
  body_type,
  power_hp,
  torque_nm,
  fuel_consumption_l_100km,
  boot_space_l,
  length_mm,
  width_mm,
  height_mm,
  source,
  source_url,
  metadata
) values (
  '7f331d03-0be6-43a4-ba3b-1bf6454ccb59'::uuid,
  '10d511eb-ab99-4dcc-bca2-40b6882d868d'::uuid,
  '2024',
  '1.2 PureTech 130 EAT8',
  '1.2 PureTech',
  'Gasoline',
  'EAT8',
  'SUV',
  130,
  230,
  6.0,
  520,
  4447,
  1841,
  1624,
  'technical_catalog',
  'https://www.auto-data.net/en/peugeot-3008-ii-facelift-2020-1.2-puretech-130hp-eat8-42180',
  jsonb_build_object(
    'imported_from', 'data/vehicle_specs_import.csv',
    'brand_name', 'Peugeot',
    'model_name', '3008'
  )
)
on conflict (
  model_id,
  coalesce(nullif(btrim(year), ''), 'any'),
  coalesce(nullif(btrim("trim"), ''), 'standard'),
  source
)
do update set
  brand_id = excluded.brand_id,
  engine = excluded.engine,
  fuel_type = excluded.fuel_type,
  transmission = excluded.transmission,
  body_type = excluded.body_type,
  power_hp = excluded.power_hp,
  torque_nm = excluded.torque_nm,
  fuel_consumption_l_100km = excluded.fuel_consumption_l_100km,
  boot_space_l = excluded.boot_space_l,
  length_mm = excluded.length_mm,
  width_mm = excluded.width_mm,
  height_mm = excluded.height_mm,
  source_url = excluded.source_url,
  metadata = excluded.metadata,
  updated_at = now();

insert into public.vehicle_specs (
  brand_id,
  model_id,
  year,
  trim,
  engine,
  fuel_type,
  transmission,
  body_type,
  power_hp,
  torque_nm,
  fuel_consumption_l_100km,
  boot_space_l,
  length_mm,
  width_mm,
  height_mm,
  source,
  source_url,
  metadata
) values (
  'e6495101-a89d-442d-a04a-8440faf046bd'::uuid,
  'c2653cc7-ffaa-4753-9d40-aee7af4a9756'::uuid,
  '2024',
  '320i Sedan',
  '1.6 TwinPower Turbo',
  'Gasoline',
  'Automatic',
  'Sedan',
  170,
  250,
  6.5,
  480,
  4713,
  1827,
  1440,
  'technical_catalog',
  'https://www.auto-data.net/en/bmw-3-series-sedan-g20-lci-2022-320i-184hp-steptronic-46610',
  jsonb_build_object(
    'imported_from', 'data/vehicle_specs_import.csv',
    'brand_name', 'BMW',
    'model_name', '3 Serisi'
  )
)
on conflict (
  model_id,
  coalesce(nullif(btrim(year), ''), 'any'),
  coalesce(nullif(btrim("trim"), ''), 'standard'),
  source
)
do update set
  brand_id = excluded.brand_id,
  engine = excluded.engine,
  fuel_type = excluded.fuel_type,
  transmission = excluded.transmission,
  body_type = excluded.body_type,
  power_hp = excluded.power_hp,
  torque_nm = excluded.torque_nm,
  fuel_consumption_l_100km = excluded.fuel_consumption_l_100km,
  boot_space_l = excluded.boot_space_l,
  length_mm = excluded.length_mm,
  width_mm = excluded.width_mm,
  height_mm = excluded.height_mm,
  source_url = excluded.source_url,
  metadata = excluded.metadata,
  updated_at = now();

commit;
