import catalogJson from "@/data/catalog.json";
import type {
  ApplicationType,
  Catalogue,
  Category,
  Mode,
  Product,
  VehicleEntity,
  VehicleType,
} from "@/data/types";
import { getStableCategoryImage } from "@/data/categoryProductImages";
import { DEFAULT_MODE, getValidMode } from "@/lib/modeUtils";
import {
  findBySlug,
  getProductSlug,
  slugsMatch,
  slugify,
} from "@/lib/slugUtils";

export type ProductSort =
  | "popularity"
  | "name-ascending"
  | "name-descending"
  | "brand-ascending"
  | "oem-ascending";

export interface ProductFilters {
  categorySlug?: string;
  brand?: string;
  stockStatus?: Product["stockStatus"];
  compatibleWith?: string;
  toolType?: string;
  query?: string;
  vehicleManufacturer?: string;
  vehicleModel?: string;
  vehicleType?: string;
}

export interface StaticCategoryParam {
  mode: Mode;
  categorySlug: string;
}

export interface StaticProductParam extends StaticCategoryParam {
  productSlug: string;
}

export interface ProductSubcategory {
  id: string;
  title: string;
  slug: string;
  description: string;
  count: string;
  productCount: number;
  imageUrl?: string;
}

export interface ProductAttributeGroup {
  field: string;
  slug: string;
  values: ProductSubcategory[];
}

export interface ProductFacetSelection {
  facetSlug: string;
  valueSlug: string;
}

const PRODUCT_SPEC_EXCLUSIONS = new Set([
  "sku",
  "sub category",
  "vehicle type",
  "original category",
  "standard packaging",
  "standard packing",
  "oem numbers",
  "hsn code",
  "hsn description",
  "mrp",
]);

const PRODUCT_FACET_PRIORITY = [
  "Vehicle Manufacturer",
  "Compatible Vehicle Model",
  "Compatible Application",
  "Position",
  "Side",
  "Fuel Type",
  "Voltage",
  "Wattage",
  "Base Socket",
  "Diameter Mm",
  "Available Size",
  "Brand",
];

function withStableProductImages(source: Catalogue): Catalogue {
  return {
    ...source,
    products: {
      automobile: Object.fromEntries(
        Object.entries(source.products.automobile).map(([categorySlug, products]) => [
          categorySlug,
          products.map((product, index) => ({
            ...product,
            image: getStableCategoryImage(product, index),
          })),
        ]),
      ),
      industrial: Object.fromEntries(
        Object.entries(source.products.industrial).map(([categorySlug, products]) => [
          categorySlug,
          products.map((product, index) => ({
            ...product,
            image: getStableCategoryImage(product, index),
          })),
        ]),
      ),
    },
  };
}

export const catalogue = withStableProductImages(
  catalogJson as unknown as Catalogue,
);

export function getCatalogue(): Catalogue {
  return catalogue;
}

export function getModes(): Mode[] {
  return ["automobile", "industrial"];
}

export function getCategories(mode: Mode = DEFAULT_MODE): Category[] {
  return [...catalogue.categories[getValidMode(mode)]];
}

export function getCategoryBySlug(
  mode: Mode,
  categorySlug: string,
): Category | null {
  return findBySlug(getCategories(mode), categorySlug);
}

export function getProductsByMode(mode: Mode = DEFAULT_MODE): Product[] {
  const modeProducts = catalogue.products[getValidMode(mode)];

  return Object.values(modeProducts).flat();
}

export const getProducts = getProductsByMode;

export function getCategoryProducts(
  mode: Mode,
  categorySlug: string,
): Product[] {
  const category = getCategoryBySlug(mode, categorySlug);

  if (!category) {
    return [];
  }

  return [...(catalogue.products[mode][category.slug] || [])];
}

export function getProductBySlug(
  mode: Mode,
  categorySlug: string,
  productSlug: string,
): Product | null {
  return (
    getCategoryProducts(mode, categorySlug).find((product) =>
      slugsMatch(product, productSlug),
    ) || null
  );
}

export function getCategorySubcategories(
  mode: Mode,
  categorySlug: string,
): ProductSubcategory[] {
  const products = getCategoryProducts(mode, categorySlug);
  const grouped = new Map<string, Product[]>();

  products.forEach((product) => {
    const key =
      product.technicalSpecs?.["Sub Category"] || product.brand || "General";
    grouped.set(key, [...(grouped.get(key) || []), product]);
  });

  return Array.from(grouped.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([brand, brandProducts]) => {
      const firstProduct = brandProducts[0];
      const count = brandProducts.length;

      return {
        id: `${firstProduct.categorySlug}-${slugify(brand)}`,
        title: brand,
        slug: slugify(brand),
        description: `${count} ${count === 1 ? "product" : "products"} available in ${firstProduct.category}.`,
        count: `${count} ${count === 1 ? "item" : "items"}`,
        productCount: count,
        imageUrl: firstProduct.image || firstProduct.imageUrl,
      };
    });
}

export function getCategorySubcategoryBySlug(
  mode: Mode,
  categorySlug: string,
  subcategorySlug: string,
): ProductSubcategory | null {
  return (
    getCategorySubcategories(mode, categorySlug).find(
      (subcategory) => subcategory.slug === subcategorySlug,
    ) || null
  );
}

export function getSubcategoryProducts(
  mode: Mode,
  categorySlug: string,
  subcategorySlug: string,
): Product[] {
  const subcategory = getCategorySubcategoryBySlug(
    mode,
    categorySlug,
    subcategorySlug,
  );

  if (!subcategory) {
    return [];
  }

  return getCategoryProducts(mode, categorySlug).filter(
    (product) =>
      slugify(
        product.technicalSpecs?.["Sub Category"] || product.brand || "General",
      ) === subcategory.slug,
  );
}

export function getSubcategoryVehicleTypes(
  mode: Mode,
  categorySlug: string,
  subcategorySlug: string,
): ProductSubcategory[] {
  const products = getSubcategoryProducts(mode, categorySlug, subcategorySlug);
  const grouped = new Map<string, Product[]>();

  products.forEach((product) => {
    const vehicleType = product.technicalSpecs?.["Vehicle Type"] || "Other Applications";
    grouped.set(vehicleType, [...(grouped.get(vehicleType) || []), product]);
  });

  // A singleton product is already the leaf; don't insert a one-product page.
  if (products.length < 2) {
    return [];
  }

  return Array.from(grouped.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([vehicleType, vehicleProducts]) => {
      const firstProduct = vehicleProducts[0];
      const count = vehicleProducts.length;

      return {
        id: `${subcategorySlug}-${slugify(vehicleType)}`,
        title: vehicleType,
        slug: slugify(vehicleType),
        description: `${count} ${count === 1 ? "product" : "products"} available for ${vehicleType.toLowerCase()}.`,
        count: `${count} ${count === 1 ? "item" : "items"}`,
        productCount: count,
        imageUrl: firstProduct.image || firstProduct.imageUrl,
      };
    });
}

export function getVehicleTypeProducts(
  mode: Mode,
  categorySlug: string,
  subcategorySlug: string,
  vehicleTypeSlug: string,
): Product[] {
  return getSubcategoryProducts(mode, categorySlug, subcategorySlug).filter(
    (product) =>
      slugify(product.technicalSpecs?.["Vehicle Type"] || "Other Applications") ===
      vehicleTypeSlug,
  );
}

export function getVehicleTypeAttributeGroup(
  mode: Mode,
  categorySlug: string,
  subcategorySlug: string,
  vehicleTypeSlug: string,
): ProductAttributeGroup | null {
  return getNextProductAttributeGroup(
    getVehicleTypeProducts(mode, categorySlug, subcategorySlug, vehicleTypeSlug),
    ["vehicle-type"],
  );
}

function valuesForProductFacet(product: Product, facetSlug: string): string[] {
  switch (facetSlug) {
    case "vehicle-manufacturer":
      return [product.technicalSpecs?.["Vehicle Manufacturer"] || ""];
    case "compatible-vehicle-model":
      return product.compatibleVehicles || [];
    case "compatible-application":
      return product.compatibleApplications || [];
    case "position":
      return [product.technicalSpecs?.Position || ""];
    case "side":
      return [product.technicalSpecs?.Side || ""];
    case "fuel-type":
      return [product.technicalSpecs?.["Fuel Type"] || ""];
    case "voltage":
      return [product.technicalSpecs?.Voltage || ""];
    case "wattage":
      return [product.technicalSpecs?.Wattage || ""];
    case "base-socket":
      return [product.technicalSpecs?.["Base Socket"] || ""];
    case "diameter-mm":
      return [product.technicalSpecs?.["Diameter Mm"] || ""];
    case "brand":
      return [product.brand || ""];
    case "available-size":
      return product.availableSizes || [];
    default: {
      if (!facetSlug.startsWith("spec-")) {
        return [];
      }
      const specKeySlug = facetSlug.slice("spec-".length);
      const matchingKey = Object.keys(product.technicalSpecs || {}).find(
        (key) => slugify(key) === specKeySlug,
      );
      return matchingKey ? [product.technicalSpecs?.[matchingKey] || ""] : [];
    }
  }
}

function productFacetDefinitions(products: readonly Product[]) {
  const definitions = PRODUCT_FACET_PRIORITY.map((field) => ({
    field: field === "Compatible Vehicle Model" ? "Vehicle Model" : field,
    slug: slugify(field),
  }));
  const specKeys = Array.from(
    new Set(
      products.flatMap((product) => Object.keys(product.technicalSpecs || {})),
    ),
  )
    .filter((key) => !PRODUCT_SPEC_EXCLUSIONS.has(key.toLowerCase()))
    .filter((key) => !PRODUCT_FACET_PRIORITY.includes(key))
    .sort((a, b) => a.localeCompare(b));

  return [
    ...definitions,
    ...specKeys.map((key) => ({ field: key, slug: `spec-${slugify(key)}` })),
  ];
}

export function getNextProductAttributeGroup(
  products: readonly Product[],
  usedFacetSlugs: readonly string[] = [],
): ProductAttributeGroup | null {
  const used = new Set(usedFacetSlugs);

  for (const facet of productFacetDefinitions(products)) {
    if (used.has(facet.slug)) {
      continue;
    }

    const grouped = new Map<string, { title: string; products: Product[] }>();
    let missing: Product[] = [];

    products.forEach((product) => {
      const rawValues = valuesForProductFacet(product, facet.slug)
        .map((value) => value.trim())
        .filter(Boolean);
      const values = rawValues.length > 0 ? rawValues : [];

      if (values.length === 0) {
        missing.push(product);
        return;
      }

      values.forEach((value) => {
        const valueSlug = slugify(value);
        if (!valueSlug) {
          missing.push(product);
          return;
        }
        const bucket = grouped.get(valueSlug) || { title: value, products: [] };
        if (!bucket.products.some((item) => item.id === product.id)) {
          bucket.products.push(product);
        }
        grouped.set(valueSlug, bucket);
      });
    });

    if (grouped.size < 2) {
      continue;
    }

    if (missing.length > 0) {
      grouped.set("not-specified", {
        title: "Not specified",
        products: missing,
      });
    }

    return {
      field: facet.field,
      slug: facet.slug,
      values: Array.from(grouped.entries())
        .sort(([, a], [, b]) => a.title.localeCompare(b.title))
        .map(([valueSlug, bucket]) => {
          const firstProduct = bucket.products[0];
          const count = bucket.products.length;
          return {
            id: `${facet.slug}-${valueSlug}`,
            title: bucket.title,
            slug: valueSlug,
            description: `${count} ${count === 1 ? "product" : "products"} in ${facet.field.toLowerCase()}.`,
            count: `${count} ${count === 1 ? "item" : "items"}`,
            productCount: count,
            imageUrl: firstProduct.image || firstProduct.imageUrl,
          };
        }),
    };
  }

  return null;
}

export function filterProductsByAttributeValue(
  products: readonly Product[],
  facetSlug: string,
  valueSlug: string,
): Product[] {
  return products.filter((product) => {
    const values = valuesForProductFacet(product, facetSlug).filter(Boolean);
    if (valueSlug === "not-specified" && values.length === 0) {
      return true;
    }
    return values.some((value) => slugify(value) === valueSlug);
  });
}

export function applyProductAttributeSelections(
  initialProducts: readonly Product[],
  selections: readonly ProductFacetSelection[],
  initialUsedFacetSlugs: readonly string[] = [],
): {
  products: Product[];
  usedFacetSlugs: string[];
  trail: Array<{ facet: string; value: string }>;
} | null {
  let products = [...initialProducts];
  const usedFacetSlugs = [...initialUsedFacetSlugs];
  const trail: Array<{ facet: string; value: string }> = [];

  for (const selection of selections) {
    const nextGroup = getNextProductAttributeGroup(products, usedFacetSlugs);
    if (!nextGroup || nextGroup.slug !== selection.facetSlug) {
      return null;
    }

    const value = nextGroup.values.find((item) => item.slug === selection.valueSlug);
    if (!value) {
      return null;
    }

    trail.push({ facet: nextGroup.field, value: value.title });

    products = filterProductsByAttributeValue(
      products,
      selection.facetSlug,
      selection.valueSlug,
    );
    usedFacetSlugs.push(selection.facetSlug);
  }

  return { products, usedFacetSlugs, trail };
}

export function getVehicleAttributeProducts(
  mode: Mode,
  categorySlug: string,
  subcategorySlug: string,
  vehicleTypeSlug: string,
  attributeSlug: string,
  valueSlug: string,
): Product[] {
  const products = getVehicleTypeProducts(
    mode,
    categorySlug,
    subcategorySlug,
    vehicleTypeSlug,
  );
  const grouping = getNextProductAttributeGroup(products, ["vehicle-type"]);

  if (!grouping || grouping.slug !== attributeSlug) {
    return [];
  }

  const selectedValue = grouping.values.find((value) => value.slug === valueSlug);
  if (!selectedValue) {
    return [];
  }

  return filterProductsByAttributeValue(
    products,
    grouping.slug,
    selectedValue.slug,
  );
}

export function filterProducts(
  products: readonly Product[],
  filters: ProductFilters = {},
): Product[] {
  const normalizedQuery = filters.query?.trim().toLowerCase();
  const normalizedCompatible = filters.compatibleWith?.trim().toLowerCase();

  return products.filter((product) => {
    if (filters.categorySlug && product.categorySlug !== filters.categorySlug) {
      return false;
    }

    if (filters.brand && product.brand !== filters.brand) {
      return false;
    }

    if (filters.stockStatus && product.stockStatus !== filters.stockStatus) {
      return false;
    }

    if (
      filters.vehicleManufacturer &&
      product.technicalSpecs?.["Vehicle Manufacturer"] !== filters.vehicleManufacturer
    ) {
      return false;
    }

    if (
      filters.vehicleType &&
      product.technicalSpecs?.["Vehicle Type"] !== filters.vehicleType
    ) {
      return false;
    }

    if (
      filters.toolType &&
      product.technicalSpecs?.["Sub Category"] !== filters.toolType
    ) {
      return false;
    }

    if (filters.vehicleModel) {
      const models = [
        ...(product.compatibleVehicles || []),
        ...(product.compatibleApplications || []),
      ];

      if (!models.includes(filters.vehicleModel)) {
        return false;
      }
    }

    if (normalizedCompatible) {
      const compatibility = [
        ...(product.compatibleVehicles || []),
        ...(product.compatibleApplications || []),
      ].map((item) => item.toLowerCase());

      if (!compatibility.some((item) => item.includes(normalizedCompatible))) {
        return false;
      }
    }

    if (normalizedQuery) {
      const searchable = [
        product.name,
        product.oemNumber,
        product.shortDescription,
        product.fullDescription,
        product.brand,
        product.category,
        ...(product.compatibleVehicles || []),
        ...(product.compatibleApplications || []),
        ...Object.values(product.technicalSpecs || {}),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchable.includes(normalizedQuery);
    }

    return true;
  });
}

export function sortProducts(
  products: readonly Product[],
  sort: ProductSort = "popularity",
): Product[] {
  const sortedProducts = [...products];

  switch (sort) {
    case "name-ascending":
      return sortedProducts.sort((a, b) => a.name.localeCompare(b.name));
    case "name-descending":
      return sortedProducts.sort((a, b) => b.name.localeCompare(a.name));
    case "brand-ascending":
      return sortedProducts.sort((a, b) => a.brand.localeCompare(b.brand));
    case "oem-ascending":
      return sortedProducts.sort((a, b) =>
        a.oemNumber.localeCompare(b.oemNumber, undefined, {
          numeric: true,
          sensitivity: "base",
        }),
      );
    case "popularity":
    default:
      return sortedProducts.sort((a, b) => a.popularityRank - b.popularityRank);
  }
}

export function searchProducts(query: string, mode?: Mode): Product[] {
  const products = mode
    ? getProductsByMode(mode)
    : getModes().flatMap(getProductsByMode);

  return filterProducts(products, { query });
}

export function getStaticCategoryParams(): StaticCategoryParam[] {
  return getModes().flatMap((mode) =>
    getCategories(mode).map((category) => ({
      mode,
      categorySlug: category.slug,
    })),
  );
}

export function getStaticProductParams(): StaticProductParam[] {
  return getModes().flatMap((mode) =>
    getProductsByMode(mode).map((product) => ({
      mode,
      categorySlug: product.categorySlug,
      productSlug: getProductSlug(product),
    })),
  );
}

export function getStaticSubcategoryParams(): Array<
  StaticCategoryParam & { subcategorySlug: string }
> {
  return getStaticCategoryParams().flatMap(({ mode, categorySlug }) =>
    getCategorySubcategories(mode, categorySlug)
      .filter((subcategory) => subcategory.productCount > 1)
      .map((subcategory) => ({
        mode,
        categorySlug,
        subcategorySlug: subcategory.slug,
      })),
  );
}

export function getStaticVehicleTypeParams(): Array<
  StaticCategoryParam & { subcategorySlug: string; vehicleTypeSlug: string }
> {
  return getStaticSubcategoryParams().flatMap(
    ({ mode, categorySlug, subcategorySlug }) =>
      getSubcategoryVehicleTypes(mode, categorySlug, subcategorySlug)
        .filter((vehicleType) => vehicleType.productCount > 1)
        .map((vehicleType) => ({
          mode,
          categorySlug,
          subcategorySlug,
          vehicleTypeSlug: vehicleType.slug,
        })),
  );
}

export function getStaticVehicleAttributeParams(): Array<
  StaticCategoryParam & {
    subcategorySlug: string;
    vehicleTypeSlug: string;
    attributeSlug: string;
    valueSlug: string;
  }
> {
  return getStaticVehicleTypeParams().flatMap(
    ({ mode, categorySlug, subcategorySlug, vehicleTypeSlug }) => {
      const grouping = getVehicleTypeAttributeGroup(
        mode,
        categorySlug,
        subcategorySlug,
        vehicleTypeSlug,
      );

      return grouping
        ? grouping.values
            .filter((value) => value.productCount > 1)
            .map((value) => ({
              mode,
              categorySlug,
              subcategorySlug,
              vehicleTypeSlug,
              attributeSlug: grouping.slug,
              valueSlug: value.slug,
            }))
        : [];
    },
  );
}

export function getProductUrl(product: Product, mode: Mode): string {
  return `/${mode}/${product.categorySlug}/${getProductSlug(product)}/`;
}

export function getCategoryUrl(category: Category, mode: Mode): string {
  return `/${mode}/${category.slug}/`;
}

export function getBrands(mode: Mode) {
  return [...catalogue.brands[getValidMode(mode)]];
}

export function getVehicles() {
  return [...catalogue.vehicles];
}

export function getApplications() {
  return [...catalogue.applications];
}

export function getVehiclesForMode(mode: Mode): VehicleEntity[] {
  return mode === "industrial" ? getApplications() : getVehicles();
}

export function getVehicleBySlug(slug: string): VehicleType | null {
  return findBySlug(getVehicles(), slug);
}

export function getApplicationBySlug(slug: string): ApplicationType | null {
  return findBySlug(getApplications(), slug);
}

export function getVehicleEntityBySlug(slug: string): VehicleEntity | null {
  return getVehicleBySlug(slug) || getApplicationBySlug(slug);
}

export function getStaticVehicleParams(): Array<{ type: string }> {
  return [
    ...getVehicles().map((entity) => ({ type: entity.slug })),
    ...getApplications().map((entity) => ({ type: entity.slug })),
  ];
}

export function getVehicleEntityUrl(entity: VehicleEntity): string {
  return `/vehicle/${entity.slug}/`;
}

export function normalizeSearchQuery(query: string): string {
  return slugify(query).replace(/-/g, " ");
}

export function getCompatibleProductsForVehicle(entity: VehicleEntity): Array<{ product: Product; mode: Mode }> {
  const allProducts = getModes().flatMap((mode) => 
    getProductsByMode(mode).map((product) => ({ product, mode }))
  );
  
  const matched = new Set<string>();
  const results: Array<{ product: Product; mode: Mode }> = [];

  for (const part of entity.parts) {
    const partLower = part.toLowerCase();
    // Simple fuzzy match by part name in product name or category
    for (const item of allProducts) {
      if (!matched.has(item.product.id)) {
        const prodName = item.product.name.toLowerCase();
        const prodCat = item.product.category.toLowerCase();
        if (prodName.includes(partLower) || partLower.includes(prodCat) || prodCat.includes(partLower)) {
          results.push(item);
          matched.add(item.product.id);
        }
      }
    }
  }

  // Fallback to top products for the vehicle's mode if no direct match found
  if (results.length === 0) {
    const mode = "badge" in entity ? "industrial" : "automobile";
    return allProducts.filter(p => p.mode === mode).slice(0, 8);
  }

  return results.slice(0, 8);
}

export interface VehiclePartProductLink {
  part: string;
  product: Product;
  mode: Mode;
  href: string;
}

const PART_CATEGORY_KEYWORDS: Array<{
  pattern: RegExp;
  mode: Mode;
  categorySlug: string;
}> = [
  { pattern: /clutch|pressure plate|drive belt|chain|coupling|gear|cv joint/i, mode: "automobile", categorySlug: "transmission" },
  { pattern: /fuel filter|oil filter|air filter|filter assembly|air cleaner/i, mode: "automobile", categorySlug: "filters" },
  { pattern: /radiator|coolant|cooling|hose/i, mode: "automobile", categorySlug: "cooling" },
  { pattern: /hydraulic|pump|valve|seal kit/i, mode: "industrial", categorySlug: "hydraulic-hoses" },
  { pattern: /lamp|light|relay|starter|alternator|sensor|switch|battery|indicator/i, mode: "automobile", categorySlug: "electrical" },
  { pattern: /brake|disc pad|pad set|shoe|drum|caliper|master cylinder/i, mode: "automobile", categorySlug: "brake-parts" },
  { pattern: /steering|joint|mount|shock|spring|bush|bearing/i, mode: "automobile", categorySlug: "suspension" },
  { pattern: /head lamp|tail lamp|mirror|body|handle/i, mode: "automobile", categorySlug: "body-parts" },
  { pattern: /bearing|roller/i, mode: "industrial", categorySlug: "bearings" },
  { pattern: /motor|fan/i, mode: "industrial", categorySlug: "motors" },
];

function tokenizePartName(value: string): string[] {
  return slugify(value)
    .split("-")
    .filter((token) => token.length > 2 && !["and", "set", "kit", "assy", "unit"].includes(token));
}

function scoreProductForPart(part: string, product: Product, preferredCategory?: string) {
  const partTokens = tokenizePartName(part);
  const productTokens = tokenizePartName(
    `${product.name} ${product.category} ${product.shortDescription}`,
  );
  const productText = productTokens.join(" ");
  const matchedTokens = partTokens.filter((token) => productText.includes(token));
  let score = matchedTokens.length * 10;

  if (product.name.toLowerCase().includes(part.toLowerCase())) {
    score += 60;
  }

  if (preferredCategory && product.categorySlug === preferredCategory) {
    score += 35;
  }

  score -= product.popularityRank / 100;

  return score;
}

export function getVehiclePartProductLinks(
  entity: VehicleEntity,
): VehiclePartProductLink[] {
  const defaultMode: Mode = "badge" in entity ? "industrial" : "automobile";
  const allProducts = getModes().flatMap((mode) =>
    getProductsByMode(mode).map((product) => ({ product, mode })),
  );

  return entity.parts.map((part) => {
    const categoryHint = PART_CATEGORY_KEYWORDS.find((entry) =>
      entry.pattern.test(part),
    );
    const preferredMode = categoryHint?.mode || defaultMode;
    const preferredCategory = categoryHint?.categorySlug;
    const candidates = allProducts.filter(({ product, mode }) => {
      if (preferredCategory) {
        return mode === preferredMode && product.categorySlug === preferredCategory;
      }

      return mode === preferredMode;
    });
    const pool = candidates.length > 0 ? candidates : allProducts.filter(({ mode }) => mode === preferredMode);
    const best = [...pool].sort(
      (a, b) =>
        scoreProductForPart(part, b.product, preferredCategory) -
        scoreProductForPart(part, a.product, preferredCategory),
    )[0];

    return {
      part,
      product: best.product,
      mode: best.mode,
      href: getProductUrl(best.product, best.mode),
    };
  });
}
