REVOKE ALL ON FUNCTION public.emit_notification(uuid, public.notification_kind, text, text, text, text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_order_payment() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_new_customer() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_subscription_change() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_new_order() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_low_stock() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.emit_notification(uuid, public.notification_kind, text, text, text, text, jsonb) TO service_role;