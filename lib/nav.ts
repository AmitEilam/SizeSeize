export type NavItem = {
  href: string;
  label: string;
};

export const APP_NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/add-product", label: "Add product" },
  { href: "/settings", label: "Settings" },
];
