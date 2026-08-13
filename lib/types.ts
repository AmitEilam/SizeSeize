export type MonitoredProduct = {
  id: string;
  user_id: string;
  product_url: string;
  product_name: string | null;
  product_image_url: string | null;
  desired_size: string | null;
  last_known_available_sizes: string[];
  desired_size_available: boolean;
  last_checked_at: string | null;
  last_notification_sent_at: string | null;
  last_check_error: string | null;
  note: string | null;
  created_at: string;
  updated_at: string;
};

export type Profile = {
  id: string;
  email: string;
  created_at: string;
  notify_availability_alerts: boolean;
  notify_daily_summary: boolean;
  timezone: string;
  preferred_check_hour: number;
  preferred_check_minute: number;
  pending_check_hour: number | null;
  pending_check_minute: number | null;
  pending_schedule_effective_on: string | null;
  last_scheduled_run_on: string | null;
};
