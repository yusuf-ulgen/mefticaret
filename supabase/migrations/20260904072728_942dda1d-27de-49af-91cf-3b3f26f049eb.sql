INSERT INTO public.store_pages (
  store_id, title, slug, excerpt, body, seo_description, page_kind,
  is_published, status, published_at, cover_url, show_in_footer, sort_order
)
SELECT
  '11111111-1111-1111-1111-111111111111'::uuid,
  'Sonbahar Koleksiyonu: 5 Kombin Önerisi',
  'sonbahar-kombin-onerileri',
  'Yeni sezon parçalarıyla hazırladığımız beş kolay kombin: sabah kahvesinden akşam yemeğine kadar tek çantayla.',
  E'Sonbahar geldiğinde gardırobu sıfırlamak gerekmiyor. Doğru katmanlama ile mevcut parçalarınızı yeni sezona taşıyabilirsiniz.\n\n1. Triko + gömlek katmanı\nGömleğin yakasını trikonun üzerinden çıkarmak, tek hareketle ofis şıklığı sağlıyor.\n\n2. Klasik denim ve bot\nDüz kesim denim pantolonu bilekte kıvırıp kısa bot ile tamamlayın.\n\n3. Uzun trençkot\nNötr tonlu bir trençkot, altına giydiğiniz her şeyi toparlar.\n\n4. Tek renk kombin\nAynı rengin farklı tonlarını üst üste kullanmak boyu uzun gösterir.\n\n5. Aksesuar dengesi\nBir saat ve bir çanta yeterli; geri kalanı sadelikte bırakın.\n\nKoleksiyonun tamamını mağaza sayfamızdan inceleyebilirsiniz.',
  'Sonbahar sezonunda kolayca uygulayabileceğiniz beş kombin önerisi ve katmanlama ipuçları.',
  'blog',
  true,
  'published',
  now() - interval '2 days',
  '/themes/wokiee/hero-fashion.jpg',
  false,
  0
WHERE NOT EXISTS (
  SELECT 1 FROM public.store_pages
  WHERE store_id = '11111111-1111-1111-1111-111111111111'::uuid
    AND slug = 'sonbahar-kombin-onerileri'
);