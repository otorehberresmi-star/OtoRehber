#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const INPUT = path.resolve("data/vehicle_variants_catalog.json");
const OUTPUT = path.resolve(
  "supabase/vehicle_variants_catalog_import.generated.sql",
);

const normalize = (value) =>
  String(value || "")
    .trim()
    .replace(/\s+/g, " ");

const keyPart = (value) =>
  normalize(value).toLocaleLowerCase("tr-TR").normalize("NFD").replace(
    /[\u0300-\u036f]/g,
    "",
  );

const sqlText = (value) =>
  value === null || value === undefined || normalize(value) === ""
    ? "null"
    : `'${normalize(value).replace(/'/g, "''")}'`;

const sqlJson = (value) =>
  `'${JSON.stringify(value).replace(/'/g, "''")}'::jsonb`;

const deriveEngineGroup = (row) => {
  const trim = normalize(row.donanim);
  const match = trim.match(
    /^(\d+(?:[.,]\d+)?L?)\s*([A-Za-zÇĞİÖŞÜçğıöşü0-9+-]+)/,
  );

  if (match) {
    return `${match[1].replace(",", ".")} ${match[2]}`;
  }

  const engineCc = Number.parseInt(String(row.motor || ""), 10);
  if (Number.isFinite(engineCc) && engineCc > 0) {
    const liters = (engineCc / 1000).toFixed(1);
    return `${liters} ${normalize(row.yakit) || "Motor"}`;
  }

  return normalize(row.yakit) || "Diğer";
};

if (!fs.existsSync(INPUT)) {
  throw new Error(`Katalog dosyası bulunamadı: ${INPUT}`);
}

const rawRows = JSON.parse(fs.readFileSync(INPUT, "utf8"));
if (!Array.isArray(rawRows)) {
  throw new Error("Araç kataloğu bir JSON dizisi olmalıdır.");
}

const rowsByKey = new Map();

for (const raw of rawRows) {
  const row = {
    id: normalize(raw.id),
    brand: normalize(raw.marka),
    model: normalize(raw.model),
    trim: normalize(raw.donanim),
    engineCc: normalize(raw.motor),
    fuelType: normalize(raw.yakit),
    transmission: normalize(raw.vites),
    historicalPrice: normalize(raw.fiyat),
    sourceUrl: normalize(raw.websitesi),
  };

  if (!row.brand || !row.model || !row.trim) continue;

  const key = [
    row.brand,
    row.model,
    row.trim,
    row.engineCc,
    row.fuelType,
    row.transmission,
  ]
    .map(keyPart)
    .join("|");

  if (!rowsByKey.has(key)) {
    rowsByKey.set(key, {
      ...row,
      engineGroup: deriveEngineGroup(raw),
    });
  }
}

const rows = [...rowsByKey.values()].sort((a, b) =>
  `${a.brand}|${a.model}|${a.engineGroup}|${a.trim}`.localeCompare(
    `${b.brand}|${b.model}|${b.engineGroup}|${b.trim}`,
    "tr",
  ),
);

const models = [
  ...new Map(
    rows.map((row) => [
      `${keyPart(row.brand)}|${keyPart(row.model)}`,
      { brand: row.brand, model: row.model },
    ]),
  ).values(),
].sort((a, b) =>
  `${a.brand}|${a.model}`.localeCompare(`${b.brand}|${b.model}`, "tr"),
);

const lines = [
  "-- Generated from data/vehicle_variants_catalog.json.",
  "-- User-provided vehicle catalog; historical prices are metadata only.",
  "begin;",
  "",
  "create or replace function public.seed_vehicle_catalog_model(",
  "  p_brand_name text,",
  "  p_model_name text",
  ") returns void",
  "language plpgsql",
  "as $$",
  "declare",
  "  v_brand_id uuid;",
  "begin",
  "  select id into v_brand_id",
  "  from public.brands",
  "  where lower(trim(name)) = lower(trim(p_brand_name))",
  "  limit 1;",
  "",
  "  if v_brand_id is null then",
  "    insert into public.brands(name)",
  "    values (trim(p_brand_name))",
  "    returning id into v_brand_id;",
  "  end if;",
  "",
  "  if not exists (",
  "    select 1 from public.models",
  "    where brand_id = v_brand_id",
  "      and lower(trim(name)) = lower(trim(p_model_name))",
  "  ) then",
  "    insert into public.models(brand_id, name)",
  "    values (v_brand_id, trim(p_model_name));",
  "  end if;",
  "end;",
  "$$;",
  "",
];

for (const item of models) {
  lines.push(
    `select public.seed_vehicle_catalog_model(${sqlText(item.brand)}, ${sqlText(
      item.model,
    )});`,
  );
}

lines.push(
  "",
  "drop function if exists public.seed_vehicle_catalog_model(text, text);",
  "",
);

for (const row of rows) {
  const engineCc = Number.parseInt(row.engineCc, 10);
  const metadata = {
    catalog_record_id: row.id || null,
    engine_group: row.engineGroup,
    engine_cc: Number.isFinite(engineCc) ? engineCc : null,
    historical_list_price_try: row.historicalPrice
      ? Number.parseInt(row.historicalPrice, 10) || null
      : null,
    imported_from: "data/vehicle_variants_catalog.json",
  };

  lines.push(
    [
      "insert into public.vehicle_specs (",
      "  brand_id, model_id, trim, engine, fuel_type, transmission,",
      "  source, source_url, metadata",
      ")",
      "select",
      "  b.id,",
      "  m.id,",
      `  ${sqlText(row.trim)},`,
      `  ${sqlText(row.engineGroup)},`,
      `  ${sqlText(row.fuelType)},`,
      `  ${sqlText(row.transmission)},`,
      "  'user_provided_catalog',",
      `  ${sqlText(row.sourceUrl)},`,
      `  ${sqlJson(metadata)}`,
      "from public.brands b",
      "join public.models m on m.brand_id = b.id",
      `where lower(trim(b.name)) = lower(trim(${sqlText(row.brand)}))`,
      `  and lower(trim(m.name)) = lower(trim(${sqlText(row.model)}))`,
      "on conflict (",
      "  model_id,",
      "  coalesce(nullif(btrim(year), ''), 'any'),",
      '  coalesce(nullif(btrim("trim"), \'\'), \'standard\'),',
      "  source",
      ") do update set",
      "  brand_id = excluded.brand_id,",
      "  engine = excluded.engine,",
      "  fuel_type = excluded.fuel_type,",
      "  transmission = excluded.transmission,",
      "  source_url = excluded.source_url,",
      "  metadata = excluded.metadata,",
      "  updated_at = now();",
      "",
    ].join("\n"),
  );
}

lines.push("commit;", "");
fs.writeFileSync(OUTPUT, lines.join("\n"));

console.log(`Ham kayıt: ${rawRows.length}`);
console.log(`Benzersiz varyant: ${rows.length}`);
console.log(`Marka/model çifti: ${models.length}`);
console.log(`SQL: ${path.relative(process.cwd(), OUTPUT)}`);
