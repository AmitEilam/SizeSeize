import { detectProductAvailability } from "@/lib/adapters/detect";
import {
  canEvaluateMonitorTarget,
  isMonitorTargetAvailable,
} from "@/lib/monitoring/sizeMatch";
import { createClient } from "@/lib/supabase/server";

/**
 * On-demand check for a single product owned by the current user.
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

  const detection = await detectProductAvailability(product.product_url);
  const now = new Date().toISOString();

  if (detection.status !== "ok") {
    const message =
      detection.message ||
      (detection.status === "unsupported"
        ? "Unable to confidently detect availability for this product page."
        : detection.status === "blocked"
          ? "The product site blocked automated access."
          : "Detection failed.");

    const { data: updated, error: updateError } = await supabase
      .from("monitored_products")
      .update({
        product_name: detection.productName ?? product.product_name,
        product_image_url:
          detection.productImageUrl ?? product.product_image_url,
        last_known_available_sizes: [],
        desired_size_available: false,
        last_checked_at: now,
        last_check_error: message,
        updated_at: now,
      })
      .eq("id", productId)
      .select()
      .single();

    if (updateError) {
      throw new Error(updateError.message);
    }

    return {
      product: updated,
      imageFound: Boolean(detection.productImageUrl),
      detectionStatus: detection.status,
      adapterId: detection.adapterId,
    };
  }

  const evaluable = canEvaluateMonitorTarget(product.desired_size, detection);
  if (!evaluable.ok) {
    const { data: updated, error: updateError } = await supabase
      .from("monitored_products")
      .update({
        product_name: detection.productName ?? product.product_name,
        product_image_url:
          detection.productImageUrl ?? product.product_image_url,
        last_known_available_sizes: detection.availableSizes,
        desired_size_available: false,
        last_checked_at: now,
        last_check_error: evaluable.message,
        updated_at: now,
      })
      .eq("id", productId)
      .select()
      .single();

    if (updateError) {
      throw new Error(updateError.message);
    }

    return {
      product: updated,
      imageFound: Boolean(detection.productImageUrl),
      detectionStatus: "unsupported" as const,
      adapterId: detection.adapterId,
    };
  }

  const desiredAvailable = isMonitorTargetAvailable(
    product.desired_size,
    detection,
  );

  const { data: updated, error: updateError } = await supabase
    .from("monitored_products")
    .update({
      product_name: detection.productName ?? product.product_name,
      product_image_url:
        detection.productImageUrl ?? product.product_image_url ?? null,
      last_known_available_sizes: detection.availableSizes,
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

  return {
    product: updated,
    imageFound: Boolean(detection.productImageUrl),
    detectionStatus: detection.status,
    adapterId: detection.adapterId,
  };
}
