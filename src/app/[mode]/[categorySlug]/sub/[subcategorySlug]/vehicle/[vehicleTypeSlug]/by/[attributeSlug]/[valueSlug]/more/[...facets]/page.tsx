import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Mode } from "@/data/types";
import { CatalogListingShell } from "@/components/catalog/CatalogListingShell";
import { SubcategoryCard } from "@/components/catalog/SubcategoryCard";
import { SeoJsonLd } from "@/components/shared/SeoJsonLd";
import {
  applyProductAttributeSelections,
  filterProductsByAttributeValue,
  getCategoryBySlug,
  getCategorySubcategoryBySlug,
  getCatalogue,
  getNextProductAttributeGroup,
  getProductUrl,
  getSubcategoryVehicleTypes,
  getVehicleAttributeProducts,
  getVehicleTypeAttributeGroup,
} from "@/lib/dataUtils";
import { buildBreadcrumbListJsonLd } from "@/lib/seoHelpers";
import { isMode } from "@/lib/modeUtils";

type DeepBrowseRouteParams = {
  mode: string;
  categorySlug: string;
  subcategorySlug: string;
  vehicleTypeSlug: string;
  attributeSlug: string;
  valueSlug: string;
  facets: string[];
};

type DeepBrowsePageProps = {
  params: Promise<DeepBrowseRouteParams>;
};

export const dynamicParams = true;

async function resolveDeepBrowsePage(params: Promise<DeepBrowseRouteParams>) {
  const {
    mode,
    categorySlug,
    subcategorySlug,
    vehicleTypeSlug,
    attributeSlug,
    valueSlug,
    facets,
  } = await params;

  if (!isMode(mode) || facets.length % 2 !== 0) {
    notFound();
  }

  const validMode = mode as Mode;
  const category = getCategoryBySlug(validMode, categorySlug);
  const subcategory = category
    ? getCategorySubcategoryBySlug(validMode, category.slug, subcategorySlug)
    : null;
  const vehicleType = subcategory
    ? getSubcategoryVehicleTypes(validMode, categorySlug, subcategory.slug).find(
        (item) => item.slug === vehicleTypeSlug,
      )
    : null;
  const initialGroup = vehicleType
    ? getVehicleTypeAttributeGroup(
        validMode,
        categorySlug,
        subcategorySlug,
        vehicleType.slug,
      )
    : null;
  const initialValue = initialGroup?.values.find(
    (item) => item.slug === valueSlug,
  );

  if (
    !category ||
    !subcategory ||
    !vehicleType ||
    !initialGroup ||
    initialGroup.slug !== attributeSlug ||
    !initialValue
  ) {
    notFound();
  }

  const initialProducts = getVehicleAttributeProducts(
    validMode,
    category.slug,
    subcategory.slug,
    vehicleType.slug,
    attributeSlug,
    valueSlug,
  );
  const selections = [];
  for (let index = 0; index < facets.length; index += 2) {
    selections.push({ facetSlug: facets[index], valueSlug: facets[index + 1] });
  }
  const selected = applyProductAttributeSelections(
    initialProducts,
    selections,
    ["vehicle-type", initialGroup.slug],
  );

  if (!selected || selected.products.length === 0) {
    notFound();
  }

  return {
    category,
    initialGroup,
    initialValue,
    mode: validMode,
    nextGroup: getNextProductAttributeGroup(
      selected.products,
      selected.usedFacetSlugs,
    ),
    products: selected.products,
    selectionTrail: [
      { facet: initialGroup.field, value: initialValue.title },
      ...selected.trail,
    ],
    subcategory,
    vehicleType,
    facets,
  };
}

export async function generateMetadata({
  params,
}: DeepBrowsePageProps): Promise<Metadata> {
  const {
    category,
    initialGroup,
    initialValue,
    mode,
    selectionTrail,
    subcategory,
    vehicleType,
    facets,
  } = await resolveDeepBrowsePage(params);
  const title = selectionTrail.map(({ value }) => value).join(" · ");
  const canonical = `/${mode}/${category.slug}/sub/${subcategory.slug}/vehicle/${vehicleType.slug}/by/${initialGroup.slug}/${initialValue.slug}/more/${facets.join("/")}/`;

  return {
    title: `${title} | ${subcategory.title} | SV Enterprises`,
    description: `Browse ${subcategory.title} for ${vehicleType.title.toLowerCase()} with matching product details from SV Enterprises.`,
    alternates: { canonical },
  };
}

export default async function DeepBrowsePage({
  params,
}: DeepBrowsePageProps) {
  const {
    category,
    initialGroup,
    initialValue,
    mode,
    nextGroup,
    products,
    selectionTrail,
    subcategory,
    vehicleType,
    facets,
  } = await resolveDeepBrowsePage(params);

  if (products.length === 1) {
    redirect(getProductUrl(products[0], mode));
  }

  const catalogue = getCatalogue();
  const filterPanel = catalogue.modes[mode].filterPanel;
  const brandField = filterPanel.fields[1];
  const compatibilityField = filterPanel.fields[2];
  const categoryPath = `/${mode}/${category.slug}/`;
  const subcategoryPath = `${categoryPath}sub/${subcategory.slug}/`;
  const vehicleTypePath = `${subcategoryPath}vehicle/${vehicleType.slug}/`;
  const initialValuePath = `${vehicleTypePath}by/${initialGroup.slug}/${initialValue.slug}/`;
  const browsePath = `${initialValuePath}more/${facets.join("/")}/`;
  const pageTitle = selectionTrail.map(({ value }) => value).join(" · ");
  const breadcrumbs = [
    { name: "Home", path: "/" },
    { name: "Categories", path: "/categories/" },
    { name: category.title, path: categoryPath },
    { name: subcategory.title, path: subcategoryPath },
    { name: vehicleType.title, path: vehicleTypePath },
    ...selectionTrail.map((item, index) => ({
      name: item.value,
      path:
        index === 0
          ? initialValuePath
          : `${initialValuePath}more/${facets.slice(0, index * 2).join("/")}/`,
    })),
  ];

  return (
    <section className="section compact">
      <div className="container page-shell">
        <div className="category-catalog">
          <div className="category-header-clean">
            <nav className="category-breadcrumb" aria-label="Breadcrumb">
              {breadcrumbs.map((item, index) => (
                <span className="category-breadcrumb-step" key={`${item.path}-${index}`}>
                  {index > 0 ? <span aria-hidden="true">&gt;</span> : null}
                  {index === breadcrumbs.length - 1 ? (
                    <span>{item.name}</span>
                  ) : (
                    <Link href={item.path}>{item.name}</Link>
                  )}
                </span>
              ))}
            </nav>

            <SeoJsonLd data={buildBreadcrumbListJsonLd(breadcrumbs)} />

            <div className="catalog-title-clean">
              <h1>{pageTitle}</h1>
              <p>
                Browse {subcategory.title} for {vehicleType.title.toLowerCase()}.
              </p>
            </div>
          </div>

          {nextGroup ? (
            <>
              <h2 className="section-title">
                Browse by {nextGroup.field.toLowerCase()}
              </h2>
              <div
                aria-label={`${pageTitle} grouped by ${nextGroup.field}`}
                className="category-overview-grid"
              >
                {nextGroup.values.map((value) => (
                  <SubcategoryCard
                    categorySlug={category.slug}
                    href={(() => {
                      const matchingProducts = filterProductsByAttributeValue(
                        products,
                        nextGroup.slug,
                        value.slug,
                      );
                      return matchingProducts.length === 1
                        ? getProductUrl(matchingProducts[0], mode)
                        : `${browsePath}${nextGroup.slug}/${value.slug}/`;
                    })()}
                    key={value.id}
                    mode={mode}
                    subcategory={value}
                  />
                ))}
              </div>
            </>
          ) : (
            <CatalogListingShell
              brandLabel={brandField.label}
              brandPlaceholder={brandField.placeholder}
              categoryTitle={`${subcategory.title} ${pageTitle}`}
              compatibilityLabel={compatibilityField.label}
              compatibilityPlaceholder={compatibilityField.placeholder}
              filterPanelCopy={filterPanel.copy}
              filterPanelTitle={filterPanel.title}
              mode={mode}
              products={products}
            />
          )}
        </div>
      </div>
    </section>
  );
}
