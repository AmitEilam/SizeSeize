import { getFromAddress, getResendClient } from "@/lib/email/resend";

export type AvailabilityAlertPayload = {
  to: string;
  productName: string;
  productUrl: string;
  desiredSize: string;
  availableSizes: string[];
};

export async function sendAvailabilityAlert(payload: AvailabilityAlertPayload) {
  const resend = getResendClient();
  const name = payload.productName || payload.productUrl;

  const { error } = await resend.emails.send({
    from: getFromAddress(),
    to: payload.to,
    subject: `SizeSeize: ${name} is available in ${payload.desiredSize}`,
    html: `
      <div style="font-family: Georgia, 'Times New Roman', serif; max-width: 560px; color: #1a1a1a;">
        <h1 style="font-size: 22px; margin-bottom: 8px;">Your size is available</h1>
        <p style="margin: 0 0 16px; color: #444;">SizeSeize found a match for a product you are monitoring.</p>
        <table style="width:100%; border-collapse: collapse; font-size: 15px;">
          <tr><td style="padding: 8px 0; color:#666;">Product</td><td style="padding: 8px 0;"><strong>${escapeHtml(name)}</strong></td></tr>
          <tr><td style="padding: 8px 0; color:#666;">Requested size</td><td style="padding: 8px 0;"><strong>${escapeHtml(payload.desiredSize)}</strong></td></tr>
          <tr><td style="padding: 8px 0; color:#666;">Status</td><td style="padding: 8px 0;"><strong>Available</strong></td></tr>
          <tr><td style="padding: 8px 0; color:#666;">Available sizes</td><td style="padding: 8px 0;">${escapeHtml(payload.availableSizes.join(", ") || "-")}</td></tr>
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
