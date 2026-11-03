import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Mode } from "@/data/types";
import { CatalogListingShell } from "@/components/catalog/CatalogListingShell";
import { SubcategoryCard } from "@/components/catalog/SubcategoryCard";
import { SeoJsonLd } from "@/components/shared/SeoJsonLd";
import {
  getCategoryBySlug,
  getCategorySubcategoryBySlug,
  getCatalogue,
  filterProductsByAttributeValue,
  getNextProductAttributeGroup,
  getProductUrl,
  getStaticVehicleAttributeParams,
  getSubcategoryVehicleTypes,
  getVehicleAttributeProducts,
  getVehicleTypeAttributeGroup,
} from "@/lib/dataUtils";
import { buildBreadcrumbListJsonLd } from "@/lib/seoHelpers";
import { isMode } from "@/lib/modeUtils";

type VehicleAttributeRouteParams = {
  mode: string;
  categorySlug: string;
  subcategorySlug: string;
  vehicleTypeSlug: string;
  attributeSlug: string;
  valueSlug: string;
};

type VehicleAttributePageProps = {
  params: Promise<VehicleAttributeRouteParams>;
};

export const dynamicParams = false;

async function resolveVehicleAttributePage(
  params: Promise<VehicleAttributeRouteParams>,
) {
  const {
    mode,
    categorySlug,
    subcategorySlug,
    vehicleTypeSlug,
    attributeSlug,
    valueSlug,
  } = await params;

  if (!isMode(mode)) {
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
  const attributeGroup = vehicleType
    ? getVehicleTypeAttributeGroup(
        validMode,
        categorySlug,
        subcategorySlug,
        vehicleType.slug,
      )
    : null;
  const value = attributeGroup?.values.find(
    (item) => item.slug === valueSlug,
  );

  if (
    !category ||
    !subcategory ||
    !vehicleType ||
    !attributeGroup ||
    attributeGroup.slug !== attributeSlug ||
    !value
  ) {
    notFound();
  }

  const products = getVehicleAttributeProducts(
    validMode,
    category.slug,
    subcategory.slug,
    vehicleType.slug,
    attributeSlug,
    valueSlug,
  );

  return {
    attributeGroup,
    category,
    mode: validMode,
    nextAttributeGroup: getNextProductAttributeGroup(products, [
      "vehicle-type",
      attributeGroup.slug,
    ]),
    products,
    subcategory,
    value,
    vehicleType,
  };
}

export async function generateStaticParams() {
  return getStaticVehicleAttributeParams();
}

export async function generateMetadata({
  params,
}: VehicleAttributePageProps): Promise<Metadata> {
  const {
    attributeGroup,
    category,
    mode,
    subcategory,
    value,
    vehicleType,
  } = await resolveVehicleAttributePage(params);
  const title = `${subcategory.title} ${vehicleType.title} ${attributeGroup.field}: ${value.title}`;

  return {
    title: `${title} | SV Enterprises`,
    description: `Browse ${subcategory.title} for ${vehicleType.title.toLowerCase()}, grouped by ${attributeGroup.field.toLowerCase()} ${value.title}, from SV Enterprises.`,
    alternates: {
      canonical: `/${mode}/${category.slug}/sub/${subcategory.slug}/vehicle/${vehicleType.slug}/by/${attributeGroup.slug}/${value.slug}/`,
    },
  };
}

export default async function VehicleAttributeProductsPage({
  params,
}: VehicleAttributePageProps) {
  const {
    attributeGroup,
    category,
    mode,
    nextAttributeGroup,
    products,
    subcategory,
    value,
    vehicleType,
  } = await resolveVehicleAttributePage(params);
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
  const valuePath = `${vehicleTypePath}by/${attributeGroup.slug}/${value.slug}/`;
  const pageTitle = `${attributeGroup.field}: ${value.title}`;

  return (
    <section className="section compact">
      <div className="container page-shell">
        <div className="category-catalog">
          <div className="category-header-clean">
            <nav className="category-breadcrumb" aria-label="Breadcrumb">
              <Link href="/">Home</Link>
              <span aria-hidden="true">&gt;</span>
              <Link href="/categories">Categories</Link>
              <span aria-hidden="true">&gt;</span>
              <Link href={categoryPath}>{category.title}</Link>
              <span aria-hidden="true">&gt;</span>
              <Link href={subcategoryPath}>{subcategory.title}</Link>
              <span aria-hidden="true">&gt;</span>
              <Link href={vehicleTypePath}>{vehicleType.title}</Link>
              <span aria-hidden="true">&gt;</span>
              <span>{value.title}</span>
            </nav>

            <SeoJsonLd
              data={buildBreadcrumbListJsonLd([
                { name: "Home", path: "/" },
                { name: "Categories", path: "/categories/" },
                { name: category.title, path: categoryPath },
                { name: subcategory.title, path: subcategoryPath },
                { name: vehicleType.title, path: vehicleTypePath },
                { name: pageTitle, path: valuePath },
              ])}
            />

            <div className="catalog-title-clean">
              <h1>{pageTitle}</h1>
              <p>
                {subcategory.title} for {vehicleType.title.toLowerCase()}, grouped by {attributeGroup.field.toLowerCase()}.
              </p>
            </div>
          </div>

          {nextAttributeGroup ? (
            <>
              <h2 className="section-title">
                Browse by {nextAttributeGroup.field.toLowerCase()}
              </h2>
              <div
                aria-label={`${value.title} grouped by ${nextAttributeGroup.field}`}
                className="category-overview-grid"
              >
                {nextAttributeGroup.values.map((nextValue) => (
                  <SubcategoryCard
                    categorySlug={category.slug}
                    href={(() => {
                      const matchingProducts = filterProductsByAttributeValue(
                        products,
                        nextAttributeGroup.slug,
                        nextValue.slug,
                      );
                      return matchingProducts.length === 1
                        ? getProductUrl(matchingProducts[0], mode)
                        : `${valuePath}more/${nextAttributeGroup.slug}/${nextValue.slug}/`;
                    })()}
                    key={nextValue.id}
                    mode={mode}
                    subcategory={nextValue}
                  />
                ))}
              </div>
            </>
          ) : (
            <CatalogListingShell
              brandLabel={brandField.label}
              brandPlaceholder={brandField.placeholder}
              categoryTitle={`${subcategory.title} ${vehicleType.title} ${pageTitle}`}
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
