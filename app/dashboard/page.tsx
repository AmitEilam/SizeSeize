import { redirect } from "next/navigation";
import { AddProductForm } from "@/app/components/AddProductForm";
import { ProductCard } from "@/app/components/ProductCard";
import {
  getDisplayName,
  getGoogleAvatar,
  SiteHeader,
} from "@/app/components/SiteHeader";
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
      <SiteHeader
        email={user.email}
        avatarUrl={getGoogleAvatar(user)}
        fullName={getDisplayName(user)}
        showAuthActions={false}
      />

      <main className="ss-container mt-7 flex flex-col gap-6 sm:mt-9 sm:gap-7">
        <div>
          <h1 className="ss-page-title">Monitored products</h1>
          <p className="ss-page-lead">
            Add product URLs and the size you want. SizeSeize checks stock daily
            at 12:00 PM and emails you when your size becomes available.
          </p>
        </div>

        <AddProductForm />

        {list.length === 0 ? (
          <div className="ss-card text-[1.05rem] leading-relaxed text-[var(--muted)]">
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
