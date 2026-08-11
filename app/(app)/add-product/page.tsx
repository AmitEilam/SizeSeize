import { AddProductForm } from "@/app/components/AddProductForm";

export default function AddProductPage() {
  return (
    <>
      <div>
        <h1 className="ss-page-title">Add product</h1>
        <p className="ss-page-lead">
          Paste a product URL and the size you want. SizeSeize uses layered
          detection (site-specific → Shopify → structured data → DOM) and only
          records sizes when confidence is clear.
        </p>
      </div>

      <AddProductForm />
    </>
  );
}
