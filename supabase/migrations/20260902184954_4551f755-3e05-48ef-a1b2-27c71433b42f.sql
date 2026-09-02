ALTER TABLE public.store_theme_sections DROP CONSTRAINT IF EXISTS store_theme_sections_type_check;

ALTER TABLE public.store_theme_sections ADD CONSTRAINT store_theme_sections_type_check CHECK (type = ANY (ARRAY[
  'announcement_bar','banner','banner_collection','banner_color_grid','banner_masonry','banner_promo','banner_scroll','banner_split',
  'blog','brands','campaign_banner','cart_block','category_cards','category_grid','category_mega','category_slider','countdown',
  'counters','coupon_banner','custom_html','faq','featured_collection','footer','free_shipping_bar','gallery','header','hero',
  'hero_before_after','hero_campaign','hero_center','hero_countdown','hero_fullscreen','hero_product','hero_slider','hero_split',
  'hero_video','icon_boxes','image_text','logo_cloud','map','newsletter','product_bestsellers','product_category',
  'product_comparison','product_discounted','product_featured','product_feed','product_grid','product_new',
  'product_recently_viewed','product_recommended','product_slider','related_products','reviews','rich_text','social_proof',
  'testimonials','trust_badges','video','wishlist'
]::text[]));