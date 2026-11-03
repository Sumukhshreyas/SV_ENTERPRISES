import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Mode } from "@/data/types";
import { CatalogListingShell } from "@/components/catalog/CatalogListingShell";
import { SubcategoryCard } from "@/components/catalog/SubcategoryCard";
import { SeoJsonLd } from "@/components/shared/SeoJsonLd";
import { getCatalogue } from "@/lib/dataUtils";
import {
  getCategoryBySlug,
  getCategorySubcategoryBySlug,
  getProductUrl,
  getStaticSubcategoryParams,
  getSubcategoryProducts,
  getSubcategoryVehicleTypes,
  getVehicleTypeProducts,
} from "@/lib/dataUtils";
import { buildBreadcrumbListJsonLd } from "@/lib/seoHelpers";
import { isMode } from "@/lib/modeUtils";

type SubcategoryRouteParams = {
  mode: string;
  categorySlug: string;
  subcategorySlug: string;
};

type SubcategoryPageProps = {
  params: Promise<SubcategoryRouteParams>;
};

export const dynamicParams = false;

async function resolveSubcategoryPage(
  params: Promise<SubcategoryRouteParams>,
) {
  const { mode, categorySlug, subcategorySlug } = await params;

  if (!isMode(mode)) {
    notFound();
  }

  const validMode = mode as Mode;
  const category = getCategoryBySlug(validMode, categorySlug);

  if (!category) {
    notFound();
  }

  const subcategory = getCategorySubcategoryBySlug(
    validMode,
    category.slug,
    subcategorySlug,
  );

  if (!subcategory) {
    notFound();
  }

  return {
    mode: validMode,
    category,
    products: getSubcategoryProducts(validMode, category.slug, subcategory.slug),
    subcategory,
    vehicleTypes: getSubcategoryVehicleTypes(
      validMode,
      category.slug,
      subcategory.slug,
    ),
  };
}

export async function generateStaticParams() {
  return getStaticSubcategoryParams();
}

export async function generateMetadata({
  params,
}: SubcategoryPageProps): Promise<Metadata> {
  const { category, mode, subcategory } = await resolveSubcategoryPage(params);

  return {
    title: `${subcategory.title} ${category.title} | SV Enterprises`,
    description: `Browse ${subcategory.title} products in ${category.title} from SV Enterprises.`,
    alternates: {
      canonical: `/${mode}/${category.slug}/sub/${subcategory.slug}/`,
    },
  };
}

export default async function SubcategoryProductsPage({
  params,
}: SubcategoryPageProps) {
  const { mode, category, products, subcategory, vehicleTypes } =
    await resolveSubcategoryPage(params);
  const catalogue = getCatalogue();
  const filterPanel = catalogue.modes[mode].filterPanel;
  const brandField = filterPanel.fields[1];
  const compatibilityField = filterPanel.fields[2];

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
              <Link href={`/${mode}/${category.slug}/`}>{category.title}</Link>
              <span aria-hidden="true">&gt;</span>
              <span>{subcategory.title}</span>
            </nav>

            <SeoJsonLd
              data={buildBreadcrumbListJsonLd([
                { name: "Home", path: "/" },
                { name: "Categories", path: "/categories/" },
                { name: category.title, path: `/${mode}/${category.slug}/` },
                {
                  name: subcategory.title,
                  path: `/${mode}/${category.slug}/sub/${subcategory.slug}/`,
                },
              ])}
            />

            <div className="catalog-title-clean">
              <h1>{subcategory.title}</h1>
              <p>{subcategory.description}</p>
            </div>
          </div>

          {vehicleTypes.length > 0 ? (
            <>
              <h2 className="section-title">Browse by vehicle type</h2>
              <div
                aria-label={`${subcategory.title} vehicle types`}
                className="category-overview-grid"
              >
                {vehicleTypes.map((vehicleType) => (
                  <SubcategoryCard
                    categorySlug={category.slug}
                    href={
                      vehicleType.productCount === 1
                        ? getProductUrl(
                            getVehicleTypeProducts(
                              mode,
                              category.slug,
                              subcategory.slug,
                              vehicleType.slug,
                            )[0],
                            mode,
                          )
                        : `/${mode}/${category.slug}/sub/${subcategory.slug}/vehicle/${vehicleType.slug}/`
                    }
                    key={vehicleType.id}
                    mode={mode}
                    subcategory={vehicleType}
                  />
                ))}
              </div>
            </>
          ) : (
            <CatalogListingShell
              brandLabel={brandField.label}
              brandPlaceholder={brandField.placeholder}
              categoryTitle={`${subcategory.title} ${category.title}`}
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
