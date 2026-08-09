import { Resend } from "resend";

export function getResendClient() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("Missing RESEND_API_KEY");
  }
  return new Resend(apiKey);
}

export function getFromAddress() {
  return process.env.EMAIL_FROM ?? "SizeSeize <onboarding@resend.dev>";
}
