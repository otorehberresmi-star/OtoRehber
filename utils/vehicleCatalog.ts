export type VehicleCatalogSelection = {
  brand: string;
  model: string;
  engineGroup: string;
  trim: string;
  engineCc: string;
  fuelType: string;
  transmission: string;
  sourceRecordId: string;
};

type RawVehicleCatalogRow = {
  id?: string;
  marka?: string;
  model?: string;
  donanim?: string;
  motor?: string;
  yakit?: string;
  vites?: string;
};

const rawCatalog =
  require("../data/vehicle_variants_catalog.json") as RawVehicleCatalogRow[];

const clean = (value?: string) => String(value || "").trim().replace(/\s+/g, " ");

export const normalizeCatalogText = (value?: string) =>
  clean(value)
    .replace(/İ/g, "i")
    .replace(/I/g, "i")
    .toLocaleLowerCase("tr-TR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

export const localizeCatalogFuelType = (value?: string) => {
  const normalized = normalizeCatalogText(value);

  if (["gasoline", "petrol", "benzin", "benzinli"].includes(normalized)) {
    return "Benzin";
  }
  if (["diesel", "dizel"].includes(normalized)) return "Dizel";
  if (["electric", "elektrik", "elektrikli"].includes(normalized)) {
    return "Elektrik";
  }
  if (["hybrid", "hibrit"].includes(normalized)) return "Hibrit";
  if (normalized === "lpg") return "LPG";

  return clean(value);
};

export const deriveCatalogEngineGroup = (row: RawVehicleCatalogRow) => {
  const trim = clean(row.donanim);
  const match = trim.match(
    /^(\d+(?:[.,]\d+)?L?)\s*([A-Za-zÇĞİÖŞÜçğıöşü0-9+-]+)/,
  );

  if (match) return `${match[1].replace(",", ".")} ${match[2]}`;

  const engineCc = Number.parseInt(String(row.motor || ""), 10);
  if (Number.isFinite(engineCc) && engineCc > 0) {
    return `${(engineCc / 1000).toFixed(1)} ${clean(row.yakit) || "Motor"}`;
  }

  return clean(row.yakit) || "Diğer";
};

const uniqueRows = new Map<string, VehicleCatalogSelection>();

rawCatalog.forEach((row) => {
  const selection: VehicleCatalogSelection = {
    brand: clean(row.marka),
    model: clean(row.model),
    engineGroup: deriveCatalogEngineGroup(row),
    trim: clean(row.donanim),
    engineCc: clean(row.motor),
    fuelType: localizeCatalogFuelType(row.yakit),
    transmission: clean(row.vites),
    sourceRecordId: clean(row.id),
  };

  if (!selection.brand || !selection.model || !selection.trim) return;

  const key = [
    selection.brand,
    selection.model,
    selection.engineGroup,
    selection.trim,
    selection.fuelType,
    selection.transmission,
  ]
    .map(normalizeCatalogText)
    .join("|");

  if (!uniqueRows.has(key)) uniqueRows.set(key, selection);
});

export const vehicleCatalog = [...uniqueRows.values()];

const catalogBrandsCache = [
  ...new Set(vehicleCatalog.map((item) => item.brand)),
].sort((a, b) => a.localeCompare(b, "tr"));

const catalogModelsCache = new Map<string, string[]>();
const catalogEnginesCache = new Map<string, string[]>();
const catalogVariantsCache = new Map<string, VehicleCatalogSelection[]>();

vehicleCatalog.forEach((item) => {
  const brandKey = normalizeCatalogText(item.brand);
  const brandModelKey = `${brandKey}|${normalizeCatalogText(item.model)}`;
  const engineLabel = `${item.engineGroup} · ${item.fuelType}`;
  const variantKey = `${brandModelKey}|${normalizeCatalogText(engineLabel)}`;

  const models = catalogModelsCache.get(brandKey) || [];
  if (
    !models.some(
      (model) => normalizeCatalogText(model) === normalizeCatalogText(item.model),
    )
  ) {
    models.push(item.model);
    catalogModelsCache.set(
      brandKey,
      models.sort((a, b) => a.localeCompare(b, "tr")),
    );
  }

  const engines = catalogEnginesCache.get(brandModelKey) || [];
  if (
    !engines.some(
      (engine) =>
        normalizeCatalogText(engine) === normalizeCatalogText(engineLabel),
    )
  ) {
    engines.push(engineLabel);
    catalogEnginesCache.set(
      brandModelKey,
      engines.sort((a, b) => a.localeCompare(b, "tr")),
    );
  }

  const variants = catalogVariantsCache.get(variantKey) || [];
  variants.push(item);
  catalogVariantsCache.set(variantKey, variants);
});

export const getCatalogBrands = () => catalogBrandsCache;

export const getCatalogModels = (brand: string) =>
  catalogModelsCache.get(normalizeCatalogText(brand)) || [];

export const getCatalogEngines = (brand: string, model: string) =>
  catalogEnginesCache.get(
    `${normalizeCatalogText(brand)}|${normalizeCatalogText(model)}`,
  ) || [];

export const getCatalogVariants = (
  brand: string,
  model: string,
  engineLabel: string,
) =>
  catalogVariantsCache.get(
    [
      normalizeCatalogText(brand),
      normalizeCatalogText(model),
      normalizeCatalogText(engineLabel),
    ].join("|"),
  ) || [];

export const searchCatalogBrands = (query: string) => {
  const normalizedQuery = normalizeCatalogText(query);
  if (!normalizedQuery) return catalogBrandsCache;
  return catalogBrandsCache.filter((brand) =>
    normalizeCatalogText(brand).includes(normalizedQuery),
  );
};

export const searchCatalogModels = (brand: string, query: string) => {
  const normalizedQuery = normalizeCatalogText(query);
  const models = getCatalogModels(brand);
  if (!normalizedQuery) return models;
  return models.filter((model) =>
    normalizeCatalogText(model).includes(normalizedQuery),
  );
};
