-- Allow monitoring products without a desired size (overall in-stock tracking)
alter table public.monitored_products
  alter column desired_size drop not null;

alter table public.monitored_products
  alter column desired_size set default null;
