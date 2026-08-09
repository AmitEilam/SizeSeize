import { detectProductAvailability } from "@/lib/adapters/detect";
import { sendAvailabilityAlert } from "@/lib/email/alert";
import { sendDailySummary, type SummaryProduct } from "@/lib/email/summary";
import {
  canEvaluateMonitorTarget,
  isMonitorTargetAvailable,
} from "@/lib/monitoring/sizeMatch";
import { createAdminClient } from "@/lib/supabase/admin";
import type { MonitoredProduct } from "@/lib/types";

export type JobReport = {
  checked: number;
  alertsSent: number;
  summariesSent: number;
  failures: number;
  unsupported: number;
  details: Array<{
    productId: string;
    ok: boolean;
    alerted?: boolean;
    error?: string;
    adapterId?: string;
  }>;
};

/**
 * Shared monitoring entrypoint.
 * Uses layered detection; never invents sizes when confidence is low.
 */
export async function runMonitoringJob(): Promise<JobReport> {
  const supabase = createAdminClient();

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
    alertsSent: 0,
    summariesSent: 0,
    failures: 0,
    unsupported: 0,
    details: [],
  };

  const summaryByUser = new Map<
    string,
    { email: string; items: SummaryProduct[] }
  >();

  const userIds = [...new Set(rows.map((r) => r.user_id))];
  const emailByUser = new Map<string, string>();

  if (userIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, email")
      .in("id", userIds);

    for (const profile of profiles ?? []) {
      emailByUser.set(profile.id, profile.email);
    }
  }

  for (const product of rows) {
    report.checked += 1;
    const email = emailByUser.get(product.user_id);
    const now = new Date().toISOString();

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
            last_checked_at: now,
            last_check_error: message,
            updated_at: now,
          })
          .eq("id", product.id);

        if (email) {
          const bucket = summaryByUser.get(product.user_id) ?? {
            email,
            items: [],
          };
          bucket.items.push({
            productName: detection.productName ?? product.product_name,
            productUrl: product.product_url,
            desiredSize: product.desired_size,
            desiredSizeAvailable: false,
            availableSizes: [],
            error: message,
          });
          summaryByUser.set(product.user_id, bucket);
        }

        report.details.push({
          productId: product.id,
          ok: false,
          error: message,
          adapterId: detection.adapterId,
        });
        continue;
      }

      const evaluable = canEvaluateMonitorTarget(product.desired_size, detection);
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
            last_checked_at: now,
            last_check_error: evaluable.message,
            updated_at: now,
          })
          .eq("id", product.id);

        if (email) {
          const bucket = summaryByUser.get(product.user_id) ?? {
            email,
            items: [],
          };
          bucket.items.push({
            productName: detection.productName ?? product.product_name,
            productUrl: product.product_url,
            desiredSize: product.desired_size,
            desiredSizeAvailable: false,
            availableSizes: detection.availableSizes,
            error: evaluable.message,
          });
          summaryByUser.set(product.user_id, bucket);
        }

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
      const becameAvailable =
        !product.desired_size_available && desiredAvailable;

      const updates: Record<string, unknown> = {
        product_name: detection.productName ?? product.product_name,
        product_image_url:
          detection.productImageUrl ?? product.product_image_url,
        last_known_available_sizes: detection.availableSizes,
        desired_size_available: desiredAvailable,
        last_checked_at: now,
        last_check_error: null,
        updated_at: now,
      };

      let alerted = false;
      if (becameAvailable && email) {
        await sendAvailabilityAlert({
          to: email,
          productName: detection.productName ?? product.product_name ?? "",
          productUrl: product.product_url,
          desiredSize: product.desired_size,
          availableSizes: detection.availableSizes,
        });
        updates.last_notification_sent_at = now;
        report.alertsSent += 1;
        alerted = true;
      }

      await supabase
        .from("monitored_products")
        .update(updates)
        .eq("id", product.id);

      if (email) {
        const bucket = summaryByUser.get(product.user_id) ?? {
          email,
          items: [],
        };
        bucket.items.push({
          productName: detection.productName ?? product.product_name,
          productUrl: product.product_url,
          desiredSize: product.desired_size,
          desiredSizeAvailable: desiredAvailable,
          availableSizes: detection.availableSizes,
        });
        summaryByUser.set(product.user_id, bucket);
      }

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
          last_checked_at: now,
          last_check_error: message,
          updated_at: now,
        })
        .eq("id", product.id);

      if (email) {
        const bucket = summaryByUser.get(product.user_id) ?? {
          email,
          items: [],
        };
        bucket.items.push({
          productName: product.product_name,
          productUrl: product.product_url,
          desiredSize: product.desired_size,
          desiredSizeAvailable: product.desired_size_available,
          availableSizes: product.last_known_available_sizes ?? [],
          error: message,
        });
        summaryByUser.set(product.user_id, bucket);
      }

      report.details.push({
        productId: product.id,
        ok: false,
        error: message,
      });
    }
  }

  for (const [, bucket] of summaryByUser) {
    if (bucket.items.length === 0) continue;
    try {
      await sendDailySummary(bucket.email, bucket.items);
      report.summariesSent += 1;
    } catch (err) {
      report.failures += 1;
      report.details.push({
        productId: "summary",
        ok: false,
        error:
          err instanceof Error
            ? `Summary to ${bucket.email}: ${err.message}`
            : `Summary to ${bucket.email} failed`,
      });
    }
  }

  return report;
}
