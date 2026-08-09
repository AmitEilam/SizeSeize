import { getFromAddress, getResendClient } from "@/lib/email/resend";

export type SummaryProduct = {
  productName: string | null;
  productUrl: string;
  desiredSize: string;
  desiredSizeAvailable: boolean;
  availableSizes: string[];
  error?: string | null;
};

export async function sendDailySummary(to: string, products: SummaryProduct[]) {
  const resend = getResendClient();

  const rows = products
    .map((p) => {
      const name = p.productName || p.productUrl;
      const status = p.error
        ? `Check failed: ${p.error}`
        : p.desiredSizeAvailable
          ? "Available"
          : "Unavailable";
      return `
        <div style="padding: 14px 0; border-bottom: 1px solid #e6e2da;">
          <div style="font-size: 16px; font-weight: 700;">${escapeHtml(name)}</div>
          <div style="color:#555; margin-top: 6px; font-size: 14px; line-height: 1.5;">
            <div>Desired size: <strong>${escapeHtml(p.desiredSize)}</strong></div>
            <div>Status: <strong>${escapeHtml(status)}</strong></div>
            <div>Available sizes: ${escapeHtml(p.availableSizes.join(", ") || "-")}</div>
            <div><a href="${escapeAttr(p.productUrl)}">${escapeHtml(p.productUrl)}</a></div>
          </div>
        </div>
      `;
    })
    .join("");

  const { error } = await resend.emails.send({
    from: getFromAddress(),
    to,
    subject: `SizeSeize daily summary - ${products.length} product${products.length === 1 ? "" : "s"}`,
    html: `
      <div style="font-family: Georgia, 'Times New Roman', serif; max-width: 600px; color: #1a1a1a;">
        <h1 style="font-size: 22px; margin-bottom: 4px;">Daily stock summary</h1>
        <p style="color:#555; margin-top: 0;">Overview of every product you are monitoring.</p>
        ${rows || "<p>You have no monitored products.</p>"}
        <p style="margin-top: 24px; color:#888; font-size: 12px;">Sent by SizeSeize</p>
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
