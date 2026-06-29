-- Vehicle catalog seed for brands/models used by filters and post/review forms.
-- This does not delete existing rows. It only inserts missing brands/models.

create or replace function public.seed_vehicle_model(p_brand_name text, p_model_name text)
returns void
language plpgsql
as $$
declare
  v_brand_id uuid;
begin
  select id
  into v_brand_id
  from public.brands
  where lower(trim(name)) = lower(trim(p_brand_name))
  limit 1;

  if v_brand_id is null then
    insert into public.brands(name)
    values (trim(p_brand_name))
    returning id into v_brand_id;
  end if;

  if not exists (
    select 1
    from public.models
    where brand_id = v_brand_id
      and lower(trim(name)) = lower(trim(p_model_name))
  ) then
    insert into public.models(brand_id, name)
    values (v_brand_id, trim(p_model_name));
  end if;
end;
$$;

select public.seed_vehicle_model('Abarth', model_name)
from unnest(array['500', '595', '695', 'Punto Evo']) as model_name;

select public.seed_vehicle_model('Alfa Romeo', model_name)
from unnest(array['145', '146', '147', '155', '156', '159', '166', 'Giulia', 'Giulietta', 'GT', 'MiTo', 'Stelvio', 'Tonale']) as model_name;

select public.seed_vehicle_model('Audi', model_name)
from unnest(array['A1', 'A3', 'A4', 'A5', 'A6', 'A7', 'A8', 'Q2', 'Q3', 'Q4 e-tron', 'Q5', 'Q7', 'Q8', 'R8', 'RS3', 'RS4', 'RS5', 'RS6', 'RS7', 'S3', 'S4', 'S5', 'S6', 'S7', 'TT', 'e-tron', 'e-tron GT']) as model_name;

select public.seed_vehicle_model('BMW', model_name)
from unnest(array['1 Serisi', '2 Serisi', '3 Serisi', '4 Serisi', '5 Serisi', '6 Serisi', '7 Serisi', '8 Serisi', 'i3', 'i4', 'i5', 'i7', 'i8', 'iX', 'iX1', 'iX2', 'iX3', 'M2', 'M3', 'M4', 'M5', 'M8', 'X1', 'X2', 'X3', 'X4', 'X5', 'X6', 'X7', 'Z3', 'Z4']) as model_name;

select public.seed_vehicle_model('Chery', model_name)
from unnest(array['Arrizo 5', 'Arrizo 8', 'Omoda 5', 'Tiggo 4 Pro', 'Tiggo 7 Pro', 'Tiggo 8 Pro', 'Tiggo 8 Pro Max']) as model_name;

select public.seed_vehicle_model('Citroën', model_name)
from unnest(array['AMI', 'Berlingo', 'C-Elysee', 'C1', 'C2', 'C3', 'C3 Aircross', 'C3 Picasso', 'C4', 'C4 Cactus', 'C4 Picasso', 'C4 X', 'C5', 'C5 Aircross', 'C5 X', 'DS3', 'DS4', 'DS5', 'Jumpy', 'Saxo', 'Xantia', 'Xsara']) as model_name;

select public.seed_vehicle_model('Cupra', model_name)
from unnest(array['Ateca', 'Born', 'Formentor', 'Leon', 'Tavascan', 'Terramar']) as model_name;

select public.seed_vehicle_model('Dacia', model_name)
from unnest(array['Dokker', 'Duster', 'Jogger', 'Lodgy', 'Logan', 'Logan MCV', 'Sandero', 'Sandero Stepway', 'Spring']) as model_name;

select public.seed_vehicle_model('Fiat', model_name)
from unnest(array['124 Spider', '500', '500L', '500X', 'Albea', 'Bravo', 'Brava', 'Doblo', 'Egea', 'Fiorino', 'Freemont', 'Grande Punto', 'Linea', 'Marea', 'Palio', 'Panda', 'Punto', 'Punto Evo', 'Scudo', 'Sedici', 'Siena', 'Stilo', 'Tipo', 'Ulysse']) as model_name;

select public.seed_vehicle_model('Ford', model_name)
from unnest(array['B-Max', 'C-Max', 'Connect', 'Courier', 'EcoSport', 'Edge', 'Escort', 'Explorer', 'Fiesta', 'Focus', 'Fusion', 'Galaxy', 'Kuga', 'Maverick', 'Mondeo', 'Mustang', 'Puma', 'Ranger', 'S-Max', 'Tourneo Connect', 'Tourneo Courier', 'Transit', 'Transit Custom']) as model_name;

select public.seed_vehicle_model('Honda', model_name)
from unnest(array['Accord', 'City', 'Civic', 'CR-V', 'CR-Z', 'e:Ny1', 'HR-V', 'Jazz', 'Legend', 'S2000']) as model_name;

select public.seed_vehicle_model('Hyundai', model_name)
from unnest(array['Accent', 'Accent Blue', 'Atos', 'Bayon', 'Coupe', 'Elantra', 'Getz', 'i10', 'i20', 'i20 Active', 'i30', 'i40', 'Ioniq', 'Ioniq 5', 'Ioniq 6', 'ix20', 'ix35', 'Kona', 'Matrix', 'Santa Fe', 'Sonata', 'Staria', 'Tucson']) as model_name;

select public.seed_vehicle_model('Kia', model_name)
from unnest(array['Carens', 'Carnival', 'Ceed', 'Cerato', 'EV3', 'EV6', 'EV9', 'Niro', 'Optima', 'Picanto', 'ProCeed', 'Rio', 'Sorento', 'Soul', 'Sportage', 'Stonic', 'XCeed']) as model_name;

select public.seed_vehicle_model('Mercedes-Benz', model_name)
from unnest(array[
  'A Serisi', 'AMG GT', 'B Serisi', 'C Serisi', 'CLA', 'CLC', 'CLK', 'CLS',
  'E Serisi', 'EQA', 'EQB', 'EQC', 'EQE', 'EQS', 'EQV', 'G Serisi', 'GL',
  'GLA', 'GLB', 'GLC', 'GLE', 'GLK', 'GLS', 'M Serisi', 'R Serisi',
  'S Serisi', 'SL', 'SLC', 'SLK', 'SLS AMG', 'V Serisi', 'Viano', 'Vito',
  'X Serisi'
]) as model_name;

select public.seed_vehicle_model('MINI', model_name)
from unnest(array['Cabrio', 'Clubman', 'Cooper', 'Cooper 3 Kapı', 'Cooper 5 Kapı', 'Countryman', 'Coupe', 'Paceman', 'Roadster']) as model_name;

select public.seed_vehicle_model('Nissan', model_name)
from unnest(array['Almera', 'Ariya', 'Juke', 'Micra', 'Murano', 'Navara', 'Note', 'Pathfinder', 'Primera', 'Qashqai', 'Qashqai+2', 'Skyline', 'Sunny', 'Terrano', 'X-Trail']) as model_name;

select public.seed_vehicle_model('Opel', model_name)
from unnest(array['Adam', 'Antara', 'Astra', 'Corsa', 'Crossland', 'Frontera', 'Grandland', 'Insignia', 'Karl', 'Meriva', 'Mokka', 'Omega', 'Signum', 'Tigra', 'Vectra', 'Vivaro', 'Zafira']) as model_name;

select public.seed_vehicle_model('Peugeot', model_name)
from unnest(array['106', '107', '108', '2008', '206', '206+', '207', '208', '3008', '301', '306', '307', '308', '4007', '407', '408', '5008', '508', '607', 'Bipper', 'Expert', 'Partner', 'RCZ', 'Rifter']) as model_name;

select public.seed_vehicle_model('Renault', model_name)
from unnest(array['Austral', 'Captur', 'Clio', 'Espace', 'Fluence', 'Kadjar', 'Kangoo', 'Koleos', 'Laguna', 'Latitude', 'Megane', 'Modus', 'Rafale', 'Scenic', 'Symbol', 'Taliant', 'Talisman', 'Trafic', 'Twizy', 'Zoe']) as model_name;

select public.seed_vehicle_model('Seat', model_name)
from unnest(array['Alhambra', 'Altea', 'Arona', 'Ateca', 'Cordoba', 'Exeo', 'Ibiza', 'Leon', 'Mii', 'Tarraco', 'Toledo']) as model_name;

select public.seed_vehicle_model('Skoda', model_name)
from unnest(array['Citigo', 'Fabia', 'Favorit', 'Felicia', 'Kamiq', 'Karoq', 'Kodiaq', 'Octavia', 'Rapid', 'Roomster', 'Scala', 'Superb', 'Yeti']) as model_name;

select public.seed_vehicle_model('Tesla', model_name)
from unnest(array['Model 3', 'Model S', 'Model X', 'Model Y']) as model_name;

select public.seed_vehicle_model('Toyota', model_name)
from unnest(array['Auris', 'Avensis', 'Aygo', 'C-HR', 'Camry', 'Carina', 'Celica', 'Corolla', 'Corolla Cross', 'Hilux', 'Land Cruiser', 'Prius', 'Proace City', 'RAV4', 'Supra', 'Urban Cruiser', 'Verso', 'Yaris', 'Yaris Cross']) as model_name;

select public.seed_vehicle_model('Volkswagen', model_name)
from unnest(array['Amarok', 'Arteon', 'Beetle', 'Bora', 'Caddy', 'California', 'Caravelle', 'CC', 'Crafter', 'Eos', 'Golf', 'ID.3', 'ID.4', 'ID.5', 'ID.7', 'Jetta', 'Multivan', 'Passat', 'Passat Variant', 'Phaeton', 'Polo', 'Scirocco', 'Sharan', 'T-Cross', 'T-Roc', 'Taigo', 'Tiguan', 'Touareg', 'Touran', 'Transporter', 'Up']) as model_name;

select public.seed_vehicle_model('Volvo', model_name)
from unnest(array['C30', 'C40', 'C70', 'EX30', 'EX40', 'EX90', 'S40', 'S60', 'S80', 'S90', 'V40', 'V50', 'V60', 'V70', 'V90', 'XC40', 'XC60', 'XC70', 'XC90']) as model_name;

drop function if exists public.seed_vehicle_model(text, text);
