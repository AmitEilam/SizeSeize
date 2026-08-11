import { APP_VERSION } from "@/lib/version";

export function SiteFooter() {
  return (
    <footer className="ss-site-footer">
      <div className="ss-container">
        <p className="ss-site-footer-version">{APP_VERSION}</p>
      </div>
    </footer>
  );
}
