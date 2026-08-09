export type MonitoredProduct = {
  id: string;
  user_id: string;
  product_url: string;
  product_name: string | null;
  desired_size: string;
  last_known_available_sizes: string[];
  desired_size_available: boolean;
  last_checked_at: string | null;
  last_notification_sent_at: string | null;
  last_check_error: string | null;
  created_at: string;
  updated_at: string;
};

export type Profile = {
  id: string;
  email: string;
  created_at: string;
};
