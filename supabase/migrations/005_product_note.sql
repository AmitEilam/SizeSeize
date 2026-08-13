-- Personal note per monitored product (e.g. coupon code to use when available)
alter table public.monitored_products
  add column if not exists note text;
