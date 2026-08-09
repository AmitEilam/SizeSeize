import { getFromAddress, getResendClient } from "@/lib/email/resend";
import { formatDesiredSizeLabel, hasDesiredSize } from "@/lib/monitoring/sizeMatch";

export type AvailabilityAlertPayload = {
  to: string;
  productName: string;
  productUrl: string;
  desiredSize: string | null;
  availableSizes: string[];
};

export async function sendAvailabilityAlert(payload: AvailabilityAlertPayload) {
  const resend = getResendClient();
  const name = payload.productName || payload.productUrl;
  const sizeAware = hasDesiredSize(payload.desiredSize);
  const sizeLabel = formatDesiredSizeLabel(payload.desiredSize);

  const subject = sizeAware
    ? `SizeSeize: ${name} is available in ${sizeLabel}`
    : `SizeSeize: ${name} is back in stock`;

  const headline = sizeAware
    ? "Your size is available"
    : "Your product is available";

  const bodyIntro = sizeAware
    ? "SizeSeize found a match for a product you are monitoring."
    : "SizeSeize detected that a product you are monitoring is available again.";

  const sizeRowLabel = sizeAware ? "Requested size" : "Monitor mode";

  const { error } = await resend.emails.send({
    from: getFromAddress(),
    to: payload.to,
    subject,
    html: `
      <div style="font-family: Georgia, 'Times New Roman', serif; max-width: 560px; color: #1a1a1a;">
        <h1 style="font-size: 22px; margin-bottom: 8px;">${headline}</h1>
        <p style="margin: 0 0 16px; color: #444;">${bodyIntro}</p>
        <table style="width:100%; border-collapse: collapse; font-size: 15px;">
          <tr><td style="padding: 8px 0; color:#666;">Product</td><td style="padding: 8px 0;"><strong>${escapeHtml(name)}</strong></td></tr>
          <tr><td style="padding: 8px 0; color:#666;">${sizeRowLabel}</td><td style="padding: 8px 0;"><strong>${escapeHtml(sizeLabel)}</strong></td></tr>
          <tr><td style="padding: 8px 0; color:#666;">Status</td><td style="padding: 8px 0;"><strong>Available</strong></td></tr>
          ${
            sizeAware
              ? `<tr><td style="padding: 8px 0; color:#666;">Available sizes</td><td style="padding: 8px 0;">${escapeHtml(payload.availableSizes.join(", ") || "-")}</td></tr>`
              : ""
          }
        </table>
        <p style="margin-top: 20px;">
          <a href="${escapeAttr(payload.productUrl)}" style="display:inline-block;background:#0f3d2e;color:#fff;padding:12px 18px;text-decoration:none;border-radius:8px;">
            Open product
          </a>
        </p>
      </div>
    `,
  });

  if (error) {
    throw new Error(error.message);
  }
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function escapeAttr(value: string) {
  return escapeHtml(value).replaceAll("'", "&#39;");
}
