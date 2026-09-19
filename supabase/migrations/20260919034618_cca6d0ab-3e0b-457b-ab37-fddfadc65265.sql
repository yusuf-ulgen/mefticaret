CREATE TRIGGER country_prices_tenant_guard BEFORE INSERT OR UPDATE ON public.country_prices
  FOR EACH ROW EXECUTE FUNCTION app_private.enforce_tenant_refs('product_id','products');
CREATE TRIGGER customs_profiles_tenant_guard BEFORE INSERT OR UPDATE ON public.customs_profiles
  FOR EACH ROW EXECUTE FUNCTION app_private.enforce_tenant_refs('product_id','products');
CREATE TRIGGER export_documents_tenant_guard BEFORE INSERT OR UPDATE ON public.export_documents
  FOR EACH ROW EXECUTE FUNCTION app_private.enforce_tenant_refs('order_id','orders');
CREATE TRIGGER global_shipments_tenant_guard BEFORE INSERT OR UPDATE ON public.global_shipments
  FOR EACH ROW EXECUTE FUNCTION app_private.enforce_tenant_refs('order_id','orders');