"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { checkProductNow } from "@/lib/monitoring/checkProduct";
import { buildScheduleUpdate, isValidTimezone, DEFAULT_TIMEZONE } from "@/lib/monitoring/schedule";
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
          result.product?.last_check_error ||
          "Unable to confidently detect availability for this product page.",
      };
    }
    if (result.detectionStatus === "blocked") {
      return {
        error:
          result.product?.last_check_error ||
          "The product site blocked automated access.",
      };
    }
    if (result.detectionStatus !== "ok") {
      return {
        error: result.product?.last_check_error || "Detection failed for this product page.",
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

export async function updateNotificationSettings(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be signed in." };
  }

  const notifyAlerts = formData.get("notify_availability_alerts") === "on";
  const notifySummary = formData.get("notify_daily_summary") === "on";
  const timezoneRaw = String(formData.get("timezone") ?? "").trim();
  const hourRaw = Number(formData.get("preferred_check_hour"));
  const minuteRaw = Number(formData.get("preferred_check_minute"));

  if (!Number.isInteger(hourRaw) || hourRaw < 0 || hourRaw > 23) {
    return { error: "Choose a valid hour (0-23)." };
  }
  if (![0, 15, 30, 45].includes(minuteRaw)) {
    return { error: "Choose a valid minute (00, 15, 30, or 45)." };
  }

  const timezone =
    timezoneRaw && isValidTimezone(timezoneRaw)
      ? timezoneRaw
      : DEFAULT_TIMEZONE;

  const { data: existing, error: loadError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (loadError) {
    return { error: loadError.message };
  }

  if (!existing) {
    const { error: insertError } = await supabase.from("profiles").insert({
      id: user.id,
      email: user.email ?? "",
      notify_availability_alerts: notifyAlerts,
      notify_daily_summary: notifySummary,
      timezone,
      preferred_check_hour: hourRaw,
      preferred_check_minute: minuteRaw,
    });
    if (insertError) {
      return { error: insertError.message };
    }
    revalidatePath("/dashboard");
    return { success: "Notification settings saved." };
  }

  const currentHour =
    existing.pending_check_hour ?? existing.preferred_check_hour ?? 12;
  const currentMinute =
    existing.pending_check_minute ?? existing.preferred_check_minute ?? 0;
  const scheduleUnchanged =
    currentHour === hourRaw && currentMinute === minuteRaw;

  const schedule = scheduleUnchanged
    ? null
    : buildScheduleUpdate({
        profile: {
          timezone: existing.timezone || timezone,
          preferred_check_hour: existing.preferred_check_hour ?? 12,
          preferred_check_minute: existing.preferred_check_minute ?? 0,
          pending_check_hour: existing.pending_check_hour ?? null,
          pending_check_minute: existing.pending_check_minute ?? null,
          pending_schedule_effective_on:
            existing.pending_schedule_effective_on ?? null,
          last_scheduled_run_on: existing.last_scheduled_run_on ?? null,
        },
        nextHour: hourRaw,
        nextMinute: minuteRaw,
      });

  const { error: updateError } = await supabase
    .from("profiles")
    .update({
      email: user.email ?? existing.email,
      notify_availability_alerts: notifyAlerts,
      notify_daily_summary: notifySummary,
      timezone,
      ...(schedule?.updates ?? {}),
    })
    .eq("id", user.id);

  if (updateError) {
    return { error: updateError.message };
  }

  revalidatePath("/dashboard");

  if (!schedule) {
    return { success: "Notification settings saved." };
  }

  return { success: schedule.message };
}
