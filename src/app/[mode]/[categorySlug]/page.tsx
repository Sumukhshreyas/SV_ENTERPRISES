import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Mode } from "@/data/types";
import { SubcategoryCard } from "@/components/catalog/SubcategoryCard";
import { SeoJsonLd } from "@/components/shared/SeoJsonLd";
import {
  getCategoryBySlug,
  getCategorySubcategories,
  getProductUrl,
  getSubcategoryProducts,
  getStaticCategoryParams,
} from "@/lib/dataUtils";
import {
  buildBreadcrumbListJsonLd,
  buildCategoryMetadata,
} from "@/lib/seoHelpers";
import { isMode } from "@/lib/modeUtils";

type CategoryRouteParams = {
  mode: string;
  categorySlug: string;
};

type CategoryPageProps = {
  params: Promise<CategoryRouteParams>;
};

export const dynamicParams = false;

async function resolveCategoryPage(params: Promise<CategoryRouteParams>) {
  const { mode, categorySlug } = await params;

  if (!isMode(mode)) {
    notFound();
  }

  const validMode = mode as Mode;
  const category = getCategoryBySlug(validMode, categorySlug);

  if (!category) {
    notFound();
  }

  return {
    mode: validMode,
    category,
    subcategories: getCategorySubcategories(validMode, category.slug),
  };
}

export async function generateStaticParams() {
  return getStaticCategoryParams();
}

export async function generateMetadata({
  params,
}: CategoryPageProps): Promise<Metadata> {
  const { category, mode } = await resolveCategoryPage(params);

  return buildCategoryMetadata(mode, category);
}

export default async function CategorySubcategoriesPage({
  params,
}: CategoryPageProps) {
  const { mode, category, subcategories } = await resolveCategoryPage(params);

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
              <span>{category.title}</span>
            </nav>

            <SeoJsonLd
              data={buildBreadcrumbListJsonLd([
                { name: "Home", path: "/" },
                { name: "Categories", path: "/categories/" },
                { name: category.title, path: `/${mode}/${category.slug}/` },
              ])}
            />

            <div className="catalog-title-clean">
              <h1>{category.title}</h1>
              <p>{category.catalogueCopy}</p>
            </div>
          </div>

          <div
            className="category-overview-grid"
            aria-label={`${category.title} sub categories`}
          >
            {subcategories.map((subcategory) => (
              <SubcategoryCard
                categorySlug={category.slug}
                href={
                  subcategory.productCount === 1
                    ? getProductUrl(
                        getSubcategoryProducts(
                          mode,
                          category.slug,
                          subcategory.slug,
                        )[0],
                        mode,
                      )
                    : undefined
                }
                key={subcategory.id}
                mode={mode}
                subcategory={subcategory}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
