import { fetchProductAvailability } from "@/lib/adapters/registry";
import { isDesiredSizeAvailable } from "@/lib/monitoring/sizeMatch";
import { createClient } from "@/lib/supabase/server";

/**
 * On-demand check for a single product owned by the current user.
 * Useful for validating adapters before relying on the daily cron.
 */
export async function checkProductNow(productId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Not authenticated");
  }

  const { data: product, error } = await supabase
    .from("monitored_products")
    .select("*")
    .eq("id", productId)
    .eq("user_id", user.id)
    .single();

  if (error || !product) {
    throw new Error("Product not found");
  }

  try {
    const availability = await fetchProductAvailability(product.product_url);
    const desiredAvailable = isDesiredSizeAvailable(
      product.desired_size,
      availability.availableSizes,
    );
    const now = new Date().toISOString();

    const { data: updated, error: updateError } = await supabase
      .from("monitored_products")
      .update({
        product_name: availability.productName ?? product.product_name,
        last_known_available_sizes: availability.availableSizes,
        desired_size_available: desiredAvailable,
        last_checked_at: now,
        last_check_error: null,
        updated_at: now,
      })
      .eq("id", productId)
      .select()
      .single();

    if (updateError) {
      throw new Error(updateError.message);
    }

    return updated;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Check failed";
    const now = new Date().toISOString();
    await supabase
      .from("monitored_products")
      .update({
        last_checked_at: now,
        last_check_error: message,
        updated_at: now,
      })
      .eq("id", productId);
    throw new Error(message);
  }
}
