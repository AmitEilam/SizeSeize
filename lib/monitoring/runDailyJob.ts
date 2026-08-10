import { detectProductAvailability } from "@/lib/adapters/detect";
import { sendAvailabilityAlert } from "@/lib/email/alert";
import { sendDailySummary, type SummaryProduct } from "@/lib/email/summary";
import {
  localDateString,
  promotePendingScheduleIfDue,
  shouldRunScheduledCheck,
} from "@/lib/monitoring/schedule";
import {
  canEvaluateMonitorTarget,
  isMonitorTargetAvailable,
} from "@/lib/monitoring/sizeMatch";
import { createAdminClient } from "@/lib/supabase/admin";
import type { MonitoredProduct, Profile } from "@/lib/types";

export type JobReport = {
  checked: number;
  skippedUsers: number;
  alertsSent: number;
  summariesSent: number;
  failures: number;
  unsupported: number;
  details: Array<{
    productId: string;
    ok: boolean;
    alerted?: boolean;
    skipped?: boolean;
    error?: string;
    adapterId?: string;
  }>;
};

type UserBucket = {
  profile: Profile;
  products: MonitoredProduct[];
};

/**
 * Shared monitoring entrypoint.
 * Respects per-user schedule + email preferences.
 * Availability alerts fire only on unavailable → available transitions.
 */
export async function runMonitoringJob(): Promise<JobReport> {
  const supabase = createAdminClient();
  const now = new Date();
  const nowIso = now.toISOString();

  const { data: products, error } = await supabase
    .from("monitored_products")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`Failed to load monitored products: ${error.message}`);
  }

  const rows = (products ?? []) as MonitoredProduct[];
  const report: JobReport = {
    checked: 0,
    skippedUsers: 0,
    alertsSent: 0,
    summariesSent: 0,
    failures: 0,
    unsupported: 0,
    details: [],
  };

  const userIds = [...new Set(rows.map((r) => r.user_id))];
  if (userIds.length === 0) {
    return report;
  }

  const { data: profiles, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .in("id", userIds);

  if (profileError) {
    throw new Error(`Failed to load profiles: ${profileError.message}`);
  }

  const profileById = new Map<string, Profile>();
  for (const profile of (profiles ?? []) as Profile[]) {
    profileById.set(profile.id, normalizeProfile(profile));
  }

  const buckets = new Map<string, UserBucket>();
  for (const product of rows) {
    const profile = profileById.get(product.user_id);
    if (!profile) continue;
    const bucket = buckets.get(product.user_id) ?? {
      profile,
      products: [],
    };
    bucket.products.push(product);
    buckets.set(product.user_id, bucket);
  }

  for (const [userId, bucket] of buckets) {
    let profile = bucket.profile;
    const tz = profile.timezone || "Asia/Jerusalem";
    const localToday = localDateString(now, tz);

    const promote = promotePendingScheduleIfDue(profile, localToday);
    if (promote) {
      await supabase.from("profiles").update(promote).eq("id", userId);
      profile = { ...profile, ...promote } as Profile;
      bucket.profile = profile;
    }

    if (!shouldRunScheduledCheck(profile, now)) {
      report.skippedUsers += 1;
      report.details.push({
        productId: userId,
        ok: true,
        skipped: true,
        error: "Skipped: already ran today or preferred hour not reached",
      });
      continue;
    }

    const summaryItems: SummaryProduct[] = [];
    const alertsEnabled = profile.notify_availability_alerts !== false;
    const summaryEnabled = profile.notify_daily_summary !== false;

    for (const product of bucket.products) {
      report.checked += 1;

      try {
        const detection = await detectProductAvailability(product.product_url);

        if (detection.status !== "ok") {
          if (detection.status === "unsupported") report.unsupported += 1;
          else report.failures += 1;

          const message =
            detection.message ||
            "Unable to confidently detect availability for this product page.";

          await supabase
            .from("monitored_products")
            .update({
              product_name: detection.productName ?? product.product_name,
              product_image_url:
                detection.productImageUrl ?? product.product_image_url,
              last_known_available_sizes: [],
              desired_size_available: false,
              last_checked_at: nowIso,
              last_check_error: message,
              updated_at: nowIso,
            })
            .eq("id", product.id);

          summaryItems.push({
            productName: detection.productName ?? product.product_name,
            productUrl: product.product_url,
            desiredSize: product.desired_size,
            desiredSizeAvailable: false,
            availableSizes: [],
            error: message,
          });

          report.details.push({
            productId: product.id,
            ok: false,
            error: message,
            adapterId: detection.adapterId,
          });
          continue;
        }

        const evaluable = canEvaluateMonitorTarget(
          product.desired_size,
          detection,
        );
        if (!evaluable.ok) {
          report.unsupported += 1;

          await supabase
            .from("monitored_products")
            .update({
              product_name: detection.productName ?? product.product_name,
              product_image_url:
                detection.productImageUrl ?? product.product_image_url,
              last_known_available_sizes: detection.availableSizes,
              desired_size_available: false,
              last_checked_at: nowIso,
              last_check_error: evaluable.message,
              updated_at: nowIso,
            })
            .eq("id", product.id);

          summaryItems.push({
            productName: detection.productName ?? product.product_name,
            productUrl: product.product_url,
            desiredSize: product.desired_size,
            desiredSizeAvailable: false,
            availableSizes: detection.availableSizes,
            error: evaluable.message,
          });

          report.details.push({
            productId: product.id,
            ok: false,
            error: evaluable.message,
            adapterId: detection.adapterId,
          });
          continue;
        }

        const desiredAvailable = isMonitorTargetAvailable(
          product.desired_size,
          detection,
        );
        // Real transition only: previously unavailable → now available
        const becameAvailable =
          !product.desired_size_available && desiredAvailable;

        const updates: Record<string, unknown> = {
          product_name: detection.productName ?? product.product_name,
          product_image_url:
            detection.productImageUrl ?? product.product_image_url,
          last_known_available_sizes: detection.availableSizes,
          desired_size_available: desiredAvailable,
          last_checked_at: nowIso,
          last_check_error: null,
          updated_at: nowIso,
        };

        let alerted = false;
        if (becameAvailable && alertsEnabled && profile.email) {
          await sendAvailabilityAlert({
            to: profile.email,
            productName: detection.productName ?? product.product_name ?? "",
            productUrl: product.product_url,
            desiredSize: product.desired_size,
            availableSizes: detection.availableSizes,
          });
          updates.last_notification_sent_at = nowIso;
          report.alertsSent += 1;
          alerted = true;
        }

        await supabase
          .from("monitored_products")
          .update(updates)
          .eq("id", product.id);

        summaryItems.push({
          productName: detection.productName ?? product.product_name,
          productUrl: product.product_url,
          desiredSize: product.desired_size,
          desiredSizeAvailable: desiredAvailable,
          availableSizes: detection.availableSizes,
        });

        report.details.push({
          productId: product.id,
          ok: true,
          alerted,
          adapterId: detection.adapterId,
        });
      } catch (err) {
        report.failures += 1;
        const message = err instanceof Error ? err.message : "Unknown error";

        await supabase
          .from("monitored_products")
          .update({
            last_checked_at: nowIso,
            last_check_error: message,
            updated_at: nowIso,
          })
          .eq("id", product.id);

        summaryItems.push({
          productName: product.product_name,
          productUrl: product.product_url,
          desiredSize: product.desired_size,
          desiredSizeAvailable: product.desired_size_available,
          availableSizes: product.last_known_available_sizes ?? [],
          error: message,
        });

        report.details.push({
          productId: product.id,
          ok: false,
          error: message,
        });
      }
    }

    if (summaryEnabled && profile.email && summaryItems.length > 0) {
      try {
        await sendDailySummary(profile.email, summaryItems);
        report.summariesSent += 1;
      } catch (err) {
        report.failures += 1;
        report.details.push({
          productId: "summary",
          ok: false,
          error:
            err instanceof Error
              ? `Summary to ${profile.email}: ${err.message}`
              : `Summary to ${profile.email} failed`,
        });
      }
    }

    await supabase
      .from("profiles")
      .update({ last_scheduled_run_on: localToday })
      .eq("id", userId);
  }

  return report;
}

function normalizeProfile(profile: Profile): Profile {
  return {
    ...profile,
    notify_availability_alerts: profile.notify_availability_alerts ?? true,
    notify_daily_summary: profile.notify_daily_summary ?? true,
    timezone: profile.timezone || "Asia/Jerusalem",
    preferred_check_hour: profile.preferred_check_hour ?? 12,
    preferred_check_minute: profile.preferred_check_minute ?? 0,
    pending_check_hour: profile.pending_check_hour ?? null,
    pending_check_minute: profile.pending_check_minute ?? null,
    pending_schedule_effective_on: profile.pending_schedule_effective_on ?? null,
    last_scheduled_run_on: profile.last_scheduled_run_on ?? null,
  };
}
