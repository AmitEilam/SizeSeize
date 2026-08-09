-- Add product image URL for card previews
alter table public.monitored_products
  add column if not exists product_image_url text;
