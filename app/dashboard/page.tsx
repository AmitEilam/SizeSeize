import Link from "next/link";
import { redirect } from "next/navigation";
import { signOut } from "@/app/actions";
import { AddProductForm } from "@/app/components/AddProductForm";
import { ProductCard } from "@/app/components/ProductCard";
import { createClient } from "@/lib/supabase/server";
import type { MonitoredProduct } from "@/lib/types";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: products } = await supabase
    .from("monitored_products")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const list = (products ?? []) as MonitoredProduct[];

  return (
    <div className="flex flex-1 flex-col pb-16">
      <header className="border-b border-[var(--line)] bg-[rgba(247,251,248,0.75)] backdrop-blur">
        <div className="ss-container flex flex-wrap items-center justify-between gap-3 py-4">
          <Link href="/" className="ss-brand text-xl text-[var(--brand)]">
            SizeSeize
          </Link>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <span className="max-w-[200px] truncate text-sm text-[var(--muted)] sm:max-w-none">
              {user.email}
            </span>
            <form action={signOut}>
              <button type="submit" className="ss-btn ss-btn-secondary">
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="ss-container mt-6 flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-semibold sm:text-3xl">
            Monitored products
          </h1>
          <p className="mt-1 text-[var(--muted)]">
            Add product URLs and the size you want. SizeSeize checks stock daily at
            12:00 PM and emails you when your size becomes available.
          </p>
        </div>

        <AddProductForm />

        {list.length === 0 ? (
          <div className="ss-card text-[var(--muted)]">
            No products yet. Add your first URL above to start monitoring.
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {list.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
