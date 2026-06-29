import {
  getCatalogBrands,
  getCatalogEngines,
  getCatalogModels,
  getCatalogVariants,
  localizeCatalogFuelType,
  searchCatalogBrands,
  searchCatalogModels,
  vehicleCatalog,
} from "../utils/vehicleCatalog";

describe("multi-stage vehicle catalog", () => {
  it("deduplicates the user-provided catalog", () => {
    expect(vehicleCatalog).toHaveLength(1658);
  });

  it("exposes Audi A1 as model, engine and trim stages", () => {
    expect(getCatalogBrands()).toContain("Audi");
    expect(getCatalogModels("Audi")).toContain("A1 Sportback");

    const engines = getCatalogEngines("Audi", "A1 Sportback");
    expect(engines).toContain("1.0 TFSI · Benzin");
    expect(engines).toContain("1.6 TDI · Dizel");

    const variants = getCatalogVariants(
      "Audi",
      "A1 Sportback",
      "1.0 TFSI · Benzin",
    );
    expect(variants.map((item) => item.trim)).toContain(
      "1.0 TFSI 95 hp Dynamic S tronic",
    );
  });

  it("shows inconsistent or English fuel names in Turkish", () => {
    expect(localizeCatalogFuelType("Gasoline")).toBe("Benzin");
    expect(localizeCatalogFuelType("DizeL")).toBe("Dizel");
    expect(localizeCatalogFuelType("Electric")).toBe("Elektrik");
  });

  it("uses normalized cached catalog lookups for mobile picker search", () => {
    expect(searchCatalogBrands("AUDI")).toContain("Audi");
    expect(searchCatalogBrands("citroen")).toContain("Citroen");
    expect(searchCatalogModels("Audi", "sportback")).toContain("A1 Sportback");
  });
});
