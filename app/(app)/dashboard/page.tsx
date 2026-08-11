import Link from "next/link";
import { redirect } from "next/navigation";
import { CheckAllButton } from "@/app/components/CheckAllButton";
import { ProductCard } from "@/app/components/ProductCard";
import { ProductSortControl } from "@/app/components/ProductSortControl";
import { parseProductSort, sortProducts } from "@/lib/products/sort";
import { createClient } from "@/lib/supabase/server";
import type { MonitoredProduct } from "@/lib/types";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [{ data: products }, params] = await Promise.all([
    supabase
      .from("monitored_products")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
    searchParams,
  ]);

  const sort = parseProductSort(params);
  const list = sortProducts((products ?? []) as MonitoredProduct[], sort);

  return (
    <>
      <div>
        <h1 className="ss-page-title">Monitored products</h1>
        <p className="ss-page-lead">
          Everything you are tracking, in one place. Re-check availability,
          adjust the size you want, or remove products you no longer need.
        </p>
      </div>

      {list.length === 0 ? (
        <div className="ss-card flex flex-col items-start gap-4">
          <p className="m-0 text-[1.05rem] leading-relaxed text-[var(--muted)]">
            No products yet. Add your first product URL to start monitoring.
          </p>
          <Link href="/add-product" className="ss-btn ss-btn-primary">
            Add product
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="ss-toolbar">
            <p className="ss-toolbar-meta">
              {list.length} monitored product{list.length === 1 ? "" : "s"}
            </p>
            <div className="ss-toolbar-controls">
              <ProductSortControl sort={sort} />
              <CheckAllButton productCount={list.length} />
            </div>
          </div>

          {list.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </>
  );
}
