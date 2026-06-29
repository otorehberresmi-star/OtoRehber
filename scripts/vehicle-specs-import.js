#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const DEFAULT_INPUT = "data/vehicle_specs_import.csv";
const DEFAULT_OUTPUT = "supabase/vehicle_specs_import.generated.sql";
const DEFAULT_MISSING_OUTPUT = "supabase/vehicle_specs_missing_catalog.generated.sql";

const REQUIRED_COLUMNS = ["brand", "model", "source"];
const COLUMNS = [
  "brand",
  "model",
  "year",
  "trim",
  "engine",
  "fuel_type",
  "transmission",
  "body_type",
  "power_hp",
  "torque_nm",
  "fuel_consumption_l_100km",
  "boot_space_l",
  "length_mm",
  "width_mm",
  "height_mm",
  "source",
  "source_url",
];

const NUMERIC_COLUMNS = new Set([
  "power_hp",
  "torque_nm",
  "fuel_consumption_l_100km",
  "boot_space_l",
  "length_mm",
  "width_mm",
  "height_mm",
]);

const INTEGER_COLUMNS = new Set([
  "power_hp",
  "torque_nm",
  "boot_space_l",
  "length_mm",
  "width_mm",
  "height_mm",
]);

const BRAND_ALIASES = new Map([
  ["mercedes benz", "mercedes-benz"],
  ["mercedes", "mercedes-benz"],
  ["vw", "volkswagen"],
]);

const parseArgs = () => {
  const args = process.argv.slice(2);
  const options = {
    input: DEFAULT_INPUT,
    out: DEFAULT_OUTPUT,
    missingOut: DEFAULT_MISSING_OUTPUT,
    checkOnly: false,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--input") options.input = args[++index];
    else if (arg === "--out") options.out = args[++index];
    else if (arg === "--missing-out") options.missingOut = args[++index];
    else if (arg === "--check-only") options.checkOnly = true;
    else {
      throw new Error(`Bilinmeyen argüman: ${arg}`);
    }
  }

  return options;
};

const loadEnv = () => {
  const envPath = path.resolve(".env");
  if (!fs.existsSync(envPath)) return {};

  return Object.fromEntries(
    fs
      .readFileSync(envPath, "utf8")
      .split(/\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#") && line.includes("="))
      .map((line) => {
        const index = line.indexOf("=");
        const key = line.slice(0, index).trim();
        const value = line.slice(index + 1).trim().replace(/^['"]|['"]$/g, "");
        return [key, value];
      }),
  );
};

const normalize = (value) => {
  const normalized = String(value || "")
    .trim()
    .toLocaleLowerCase("tr-TR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ı/g, "i")
    .replace(/İ/g, "i")
    .replace(/\s+/g, " ");

  return BRAND_ALIASES.get(normalized) || normalized;
};

const parseCsv = (text) => {
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"' && inQuotes && next === '"') {
      cell += '"';
      index += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      row.push(cell);
      cell = "";
    } else if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(cell);
      if (row.some((item) => item.trim().length > 0)) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }

  row.push(cell);
  if (row.some((item) => item.trim().length > 0)) rows.push(row);

  if (rows.length === 0) return [];

  const headers = rows[0].map((item) => item.trim());
  return rows.slice(1).map((values, index) => {
    const record = { __line: index + 2 };
    headers.forEach((header, headerIndex) => {
      record[header] = (values[headerIndex] || "").trim();
    });
    return record;
  });
};

const sqlString = (value) => {
  if (value === undefined || value === null || String(value).trim() === "") {
    return "null";
  }
  return `'${String(value).replace(/'/g, "''")}'`;
};

const sqlNumber = (value) => {
  if (value === undefined || value === null || String(value).trim() === "") {
    return "null";
  }
  return String(value).replace(",", ".");
};

const validateNumber = (record, column, errors) => {
  const raw = record[column];
  if (!raw) return;

  const normalized = raw.replace(",", ".");
  const value = Number(normalized);
  if (!Number.isFinite(value)) {
    errors.push(`Satır ${record.__line}: ${column} sayısal olmalı.`);
    return;
  }

  if (INTEGER_COLUMNS.has(column) && !Number.isInteger(value)) {
    errors.push(`Satır ${record.__line}: ${column} tam sayı olmalı.`);
  }

  record[column] = normalized;
};

const fetchAll = async (supabaseUrl, anonKey, table, select) => {
  const url = `${supabaseUrl.replace(/\/$/, "")}/rest/v1/${table}?select=${encodeURIComponent(
    select,
  )}&limit=10000`;
  const response = await fetch(url, {
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
    },
  });

  if (!response.ok) {
    throw new Error(`${table} okunamadı: ${response.status} ${await response.text()}`);
  }

  return response.json();
};

const buildCatalog = async () => {
  const env = { ...process.env, ...loadEnv() };
  const supabaseUrl = env.EXPO_PUBLIC_SUPABASE_URL;
  const anonKey = env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !anonKey) {
    throw new Error(".env içinde EXPO_PUBLIC_SUPABASE_URL ve EXPO_PUBLIC_SUPABASE_ANON_KEY gerekli.");
  }

  const [brands, models] = await Promise.all([
    fetchAll(supabaseUrl, anonKey, "brands", "id,name"),
    fetchAll(supabaseUrl, anonKey, "models", "id,name,brand_id"),
  ]);

  const brandByName = new Map();
  brands.forEach((brand) => {
    brandByName.set(normalize(brand.name), brand);
  });

  const modelByBrandAndName = new Map();
  models.forEach((model) => {
    modelByBrandAndName.set(`${model.brand_id}:${normalize(model.name)}`, model);
  });

  return { brandByName, modelByBrandAndName };
};

const validateRecords = (records, catalog) => {
  const errors = [];
  const missing = new Map();

  records.forEach((record) => {
    REQUIRED_COLUMNS.forEach((column) => {
      if (!record[column]) errors.push(`Satır ${record.__line}: ${column} zorunlu.`);
    });

    Object.keys(record).forEach((column) => {
      if (column !== "__line" && !COLUMNS.includes(column)) {
        errors.push(`Satır ${record.__line}: bilinmeyen kolon ${column}.`);
      }
    });

    NUMERIC_COLUMNS.forEach((column) => validateNumber(record, column, errors));

    const brand = catalog.brandByName.get(normalize(record.brand));
    if (!brand) {
      missing.set(`${record.brand}||${record.model}`, {
        brand: record.brand,
        model: record.model,
      });
      return;
    }

    const model = catalog.modelByBrandAndName.get(`${brand.id}:${normalize(record.model)}`);
    if (!model) {
      missing.set(`${record.brand}||${record.model}`, {
        brand: record.brand,
        model: record.model,
      });
      return;
    }

    record.__brandId = brand.id;
    record.__modelId = model.id;
  });

  return { errors, missing: Array.from(missing.values()) };
};

const buildMissingCatalogSql = (missing) => {
  const lines = [
    "-- Generated missing brand/model catalog rows for vehicle specs import.",
    "-- Review before running.",
    "",
  ];

  if (missing.length === 0) {
    lines.push("-- No missing catalog rows.");
    return `${lines.join("\n")}\n`;
  }

  lines.push(`create or replace function public.seed_vehicle_model(p_brand_name text, p_model_name text)
returns void
language plpgsql
as $$
declare
  v_brand_id uuid;
begin
  select id into v_brand_id
  from public.brands
  where lower(trim(name)) = lower(trim(p_brand_name))
  limit 1;

  if v_brand_id is null then
    insert into public.brands(name) values (trim(p_brand_name))
    returning id into v_brand_id;
  end if;

  if not exists (
    select 1 from public.models
    where brand_id = v_brand_id
      and lower(trim(name)) = lower(trim(p_model_name))
  ) then
    insert into public.models(brand_id, name)
    values (v_brand_id, trim(p_model_name));
  end if;
end;
$$;
`);

  missing.forEach((item) => {
    lines.push(`select public.seed_vehicle_model(${sqlString(item.brand)}, ${sqlString(item.model)});`);
  });

  lines.push("", "drop function if exists public.seed_vehicle_model(text, text);");
  return `${lines.join("\n")}\n`;
};

const buildImportSql = (records) => {
  const importable = records.filter((record) => record.__brandId && record.__modelId);
  const lines = [
    "-- Generated vehicle_specs import.",
    "-- Review source/source_url before running.",
    "begin;",
    "",
  ];

  if (importable.length === 0) {
    lines.push("-- No importable rows.");
    lines.push("commit;");
    return `${lines.join("\n")}\n`;
  }

  importable.forEach((record) => {
    lines.push(`insert into public.vehicle_specs (
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
  ${sqlString(record.__brandId)}::uuid,
  ${sqlString(record.__modelId)}::uuid,
  ${sqlString(record.year)},
  ${sqlString(record.trim)},
  ${sqlString(record.engine)},
  ${sqlString(record.fuel_type)},
  ${sqlString(record.transmission)},
  ${sqlString(record.body_type)},
  ${sqlNumber(record.power_hp)},
  ${sqlNumber(record.torque_nm)},
  ${sqlNumber(record.fuel_consumption_l_100km)},
  ${sqlNumber(record.boot_space_l)},
  ${sqlNumber(record.length_mm)},
  ${sqlNumber(record.width_mm)},
  ${sqlNumber(record.height_mm)},
  ${sqlString(record.source)},
  ${sqlString(record.source_url)},
  jsonb_build_object(
    'imported_from', 'data/vehicle_specs_import.csv',
    'brand_name', ${sqlString(record.brand)},
    'model_name', ${sqlString(record.model)}
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
`);
  });

  lines.push("commit;");
  return `${lines.join("\n")}\n`;
};

const main = async () => {
  const options = parseArgs();
  const inputPath = path.resolve(options.input);

  if (!fs.existsSync(inputPath)) {
    throw new Error(`CSV bulunamadı: ${options.input}`);
  }

  const records = parseCsv(fs.readFileSync(inputPath, "utf8"));
  const catalog = await buildCatalog();
  const { errors, missing } = validateRecords(records, catalog);

  fs.writeFileSync(path.resolve(options.missingOut), buildMissingCatalogSql(missing));

  if (errors.length > 0) {
    errors.forEach((error) => console.error(error));
    process.exitCode = 1;
    return;
  }

  if (!options.checkOnly) {
    fs.writeFileSync(path.resolve(options.out), buildImportSql(records));
  }

  const importableCount = records.filter((record) => record.__modelId).length;
  console.log(`CSV satırı: ${records.length}`);
  console.log(`Import edilebilir: ${importableCount}`);
  console.log(`Eksik katalog: ${missing.length}`);
  console.log(`Eksik katalog SQL: ${options.missingOut}`);
  if (!options.checkOnly) console.log(`Import SQL: ${options.out}`);
};

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
