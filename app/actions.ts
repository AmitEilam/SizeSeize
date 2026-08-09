"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { checkProductNow } from "@/lib/monitoring/checkProduct";
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
  const desiredSize = String(formData.get("desired_size") ?? "").trim();

  if (!productUrl || !desiredSize) {
    return { error: "Product URL and desired size are required." };
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

  const { error } = await supabase.from("monitored_products").insert({
    user_id: user.id,
    product_url: productUrl,
    desired_size: desiredSize,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/dashboard");
  return { success: "Product added." };
}

export async function updateProductSize(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const id = String(formData.get("id") ?? "");
  const desiredSize = String(formData.get("desired_size") ?? "").trim();

  if (!id || !desiredSize) {
    return { error: "Size is required." };
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
  return { success: "Size updated." };
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
    return {
      success: result.imageFound
        ? "Checked just now. Product image saved."
        : "Checked just now. No product image found on the page.",
    };
  } catch (err) {
    revalidatePath("/dashboard");
    return {
      error: err instanceof Error ? err.message : "Check failed.",
    };
  }
}
