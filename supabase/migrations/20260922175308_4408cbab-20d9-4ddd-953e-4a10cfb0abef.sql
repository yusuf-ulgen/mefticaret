ALTER TABLE public.xml_feeds
ADD COLUMN IF NOT EXISTS pricing_rules jsonb NOT NULL DEFAULT '{
  "margin_type": "flat",
  "flat_margin_percent": 0.0,
  "flat_add_amount": 0.0,
  "vat_action": "none",
  "vat_rate": 20.0,
  "rounding_type": "none",
  "tiered_margins": [],
  "marketplace_fees": {
    "commission_percent": 0.0,
    "shipping_fee": 0.0
  }
}'::jsonb;