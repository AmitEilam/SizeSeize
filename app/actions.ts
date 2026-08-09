"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { checkProductNow } from "@/lib/monitoring/checkProduct";
import { cleanSizeLabel } from "@/lib/sizes";
import { createClient } from "@/lib/supabase/server";

export type ActionState = {
  error?: string;
  success?: string;
};

export async function signInWithGoogle() {
  const supabase = await createClient();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${appUrl}/auth/callback`,
      queryParams: {
        access_type: "offline",
        prompt: "consent",
      },
    },
  });

  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}`);
  }

  if (data.url) {
    redirect(data.url);
  }
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}

export async function addProduct(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const productUrl = String(formData.get("product_url") ?? "").trim();
  const desiredSizeRaw = String(formData.get("desired_size") ?? "").trim();
  const desiredSize =
    desiredSizeRaw.length > 0 ? cleanSizeLabel(desiredSizeRaw) || null : null;

  if (!productUrl) {
    return { error: "Product URL is required." };
  }

  try {
    // Basic URL validation
    // eslint-disable-next-line no-new
    new URL(productUrl);
  } catch {
    return { error: "Enter a valid product URL (including https://)." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be signed in." };
  }

  const { data: inserted, error } = await supabase
    .from("monitored_products")
    .insert({
      user_id: user.id,
      product_url: productUrl,
      desired_size: desiredSize,
    })
    .select("id")
    .single();

  if (error || !inserted) {
    return { error: error?.message ?? "Failed to add product." };
  }

  try {
    const result = await checkProductNow(inserted.id);
    revalidatePath("/dashboard");

    if (result.detectionStatus === "ok") {
      return {
        success: desiredSize
          ? "Product added and checked."
          : "Product added and checked. Monitoring overall availability.",
      };
    }

    if (result.detectionStatus === "blocked") {
      return {
        success:
          "Product added, but the site blocked the first check. Try Check now later.",
      };
    }

    if (result.detectionStatus === "unsupported") {
      return {
        success:
          "Product added, but availability could not be detected yet. Try Check now later.",
      };
    }

    return {
      success:
        "Product added, but the first check failed. Try Check now later.",
    };
  } catch (err) {
    revalidatePath("/dashboard");
    return {
      success: `Product added, but the first check failed${
        err instanceof Error ? `: ${err.message}` : "."
      }`,
    };
  }
}

export async function updateProductSize(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const id = String(formData.get("id") ?? "");
  const desiredSizeRaw = String(formData.get("desired_size") ?? "").trim();
  const desiredSize =
    desiredSizeRaw.length > 0 ? cleanSizeLabel(desiredSizeRaw) || null : null;

  if (!id) {
    return { error: "Missing product id." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be signed in." };
  }

  const { error } = await supabase
    .from("monitored_products")
    .update({
      desired_size: desiredSize,
      // Reset availability flag so a new transition can alert after size change
      desired_size_available: false,
    })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/dashboard");
  return {
    success: desiredSize
      ? "Size updated."
      : "Now monitoring overall availability.",
  };
}

export async function deleteProduct(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase
    .from("monitored_products")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  revalidatePath("/dashboard");
}

export async function runCheckNow(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Missing product id." };

  try {
    const result = await checkProductNow(id);
    revalidatePath("/dashboard");

    if (result.detectionStatus === "unsupported") {
      return {
        error:
          "Unable to confidently detect availability for this product page. No guess was made.",
      };
    }
    if (result.detectionStatus === "blocked") {
      return {
        error: "The product site blocked automated access.",
      };
    }
    if (result.detectionStatus !== "ok") {
      return {
        error: "Detection failed for this product page.",
      };
    }

    return {
      success: result.imageFound
        ? `Checked via ${result.adapterId}. Product image saved.`
        : `Checked via ${result.adapterId}.`,
    };
  } catch (err) {
    revalidatePath("/dashboard");
    return {
      error: err instanceof Error ? err.message : "Check failed.",
    };
  }
}

export async function runCheckAll(
  _prev: ActionState,
  _formData: FormData,
): Promise<ActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be signed in." };
  }

  const { data: products, error } = await supabase
    .from("monitored_products")
    .select("id")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  if (error) {
    return { error: error.message };
  }

  if (!products?.length) {
    return { error: "No products to check." };
  }

  let ok = 0;
  let failed = 0;

  for (const product of products) {
    try {
      const result = await checkProductNow(product.id);
      if (result.detectionStatus === "ok") ok += 1;
      else failed += 1;
    } catch {
      failed += 1;
    }
  }

  revalidatePath("/dashboard");

  const total = products.length;
  return {
    success: `Checked ${total} product${total === 1 ? "" : "s"}: ${ok} ok${
      failed > 0 ? `, ${failed} with issues` : ""
    }.`,
  };
}
