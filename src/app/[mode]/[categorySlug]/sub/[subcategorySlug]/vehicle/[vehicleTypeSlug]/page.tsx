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
  getStaticVehicleTypeParams,
  getSubcategoryVehicleTypes,
  getVehicleTypeAttributeGroup,
  getVehicleAttributeProducts,
  getProductUrl,
  getVehicleTypeProducts,
} from "@/lib/dataUtils";
import { buildBreadcrumbListJsonLd } from "@/lib/seoHelpers";
import { isMode } from "@/lib/modeUtils";

type VehicleTypeRouteParams = {
  mode: string;
  categorySlug: string;
  subcategorySlug: string;
  vehicleTypeSlug: string;
};

type VehicleTypePageProps = {
  params: Promise<VehicleTypeRouteParams>;
};

export const dynamicParams = false;

async function resolveVehicleTypePage(params: Promise<VehicleTypeRouteParams>) {
  const { mode, categorySlug, subcategorySlug, vehicleTypeSlug } = await params;

  if (!isMode(mode)) {
    notFound();
  }

  const validMode = mode as Mode;
  const category = getCategoryBySlug(validMode, categorySlug);
  const subcategory = category
    ? getCategorySubcategoryBySlug(validMode, category.slug, subcategorySlug)
    : null;
  const vehicleType = subcategory
    ? getSubcategoryVehicleTypes(validMode, category!.slug, subcategory.slug).find(
        (item) => item.slug === vehicleTypeSlug,
      )
    : null;

  if (!category || !subcategory || !vehicleType) {
    notFound();
  }

  return {
    category,
    mode: validMode,
    products: getVehicleTypeProducts(
      validMode,
      category.slug,
      subcategory.slug,
      vehicleType.slug,
    ),
    subcategory,
    vehicleType,
    attributeGroup: getVehicleTypeAttributeGroup(
      validMode,
      category.slug,
      subcategory.slug,
      vehicleType.slug,
    ),
  };
}

export async function generateStaticParams() {
  return getStaticVehicleTypeParams();
}

export async function generateMetadata({
  params,
}: VehicleTypePageProps): Promise<Metadata> {
  const { category, mode, subcategory, vehicleType } =
    await resolveVehicleTypePage(params);

  return {
    title: `${subcategory.title} for ${vehicleType.title} | SV Enterprises`,
    description: `Browse ${subcategory.title} products for ${vehicleType.title.toLowerCase()} in ${category.title} from SV Enterprises.`,
    alternates: {
      canonical: `/${mode}/${category.slug}/sub/${subcategory.slug}/vehicle/${vehicleType.slug}/`,
    },
  };
}

export default async function VehicleTypeProductsPage({
  params,
}: VehicleTypePageProps) {
  const { category, mode, products, subcategory, vehicleType, attributeGroup } =
    await resolveVehicleTypePage(params);
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
              <span>{vehicleType.title}</span>
            </nav>

            <SeoJsonLd
              data={buildBreadcrumbListJsonLd([
                { name: "Home", path: "/" },
                { name: "Categories", path: "/categories/" },
                { name: category.title, path: categoryPath },
                { name: subcategory.title, path: subcategoryPath },
                { name: vehicleType.title, path: vehicleTypePath },
              ])}
            />

            <div className="catalog-title-clean">
              <h1>{subcategory.title} for {vehicleType.title}</h1>
              <p>{vehicleType.description}</p>
            </div>
          </div>

          {attributeGroup ? (
            <>
              <h2 className="section-title">
                Browse by {attributeGroup.field.toLowerCase()}
              </h2>
              <div
                aria-label={`${vehicleType.title} grouped by ${attributeGroup.field}`}
                className="category-overview-grid"
              >
                {attributeGroup.values.map((value) => (
                  <SubcategoryCard
                    categorySlug={category.slug}
                    href={(() => {
                      const matchingProducts = getVehicleAttributeProducts(
                        mode,
                        category.slug,
                        subcategory.slug,
                        vehicleType.slug,
                        attributeGroup.slug,
                        value.slug,
                      );
                      return matchingProducts.length === 1
                        ? getProductUrl(matchingProducts[0], mode)
                        : `/${mode}/${category.slug}/sub/${subcategory.slug}/vehicle/${vehicleType.slug}/by/${attributeGroup.slug}/${value.slug}/`;
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
              categoryTitle={`${subcategory.title} for ${vehicleType.title}`}
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
