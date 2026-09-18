-- Kiracı (mağaza) izolasyonu: çapraz mağaza referanslarını veritabanında engelle.
CREATE OR REPLACE FUNCTION app_private.enforce_tenant_refs()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, app_private, pg_temp
AS $$
DECLARE
  i int := 0;
  col text;
  ref_table text;
  new_val uuid;
  old_val uuid;
  ref_store uuid;
  new_store uuid;
BEGIN
  EXECUTE format('SELECT ($1).%I', 'store_id') INTO new_store USING NEW;
  IF new_store IS NULL THEN
    RETURN NEW;
  END IF;

  WHILE i < TG_NARGS LOOP
    col := TG_ARGV[i];
    ref_table := TG_ARGV[i + 1];
    i := i + 2;

    EXECUTE format('SELECT ($1).%I', col) INTO new_val USING NEW;
    IF new_val IS NULL THEN
      CONTINUE;
    END IF;

    IF TG_OP = 'UPDATE' THEN
      EXECUTE format('SELECT ($1).%I', col) INTO old_val USING OLD;
      IF old_val IS NOT DISTINCT FROM new_val
         AND (SELECT OLD.store_id) IS NOT DISTINCT FROM new_store THEN
        CONTINUE;
      END IF;
    END IF;

    EXECUTE format('SELECT store_id FROM public.%I WHERE id = $1', ref_table)
      INTO ref_store USING new_val;

    IF ref_store IS NOT NULL AND ref_store IS DISTINCT FROM new_store THEN
      RAISE EXCEPTION
        'Kiracı izolasyonu ihlali: %.% baska bir magazanin kaydina baglanamaz', TG_TABLE_NAME, col
        USING ERRCODE = '42501';
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION app_private.enforce_tenant_refs() FROM PUBLIC;

-- Her mağaza kapsamlı tabloya, mağaza kapsamlı ebeveynlere işaret eden tüm
-- referans kolonları için tek bir tetikleyici kur.
DO $outer$
DECLARE
  rec record;
  args text;
BEGIN
  FOR rec IN
    SELECT child, string_agg(format('%L, %L', col, parent), ', ' ORDER BY col) AS arg_list
    FROM (
      SELECT DISTINCT
             con.conrelid::regclass::text AS child,
             a.attname::text AS col,
             cp.relname::text AS parent
      FROM pg_constraint con
      JOIN pg_namespace n ON n.oid = con.connamespace
      JOIN pg_class cc ON cc.oid = con.conrelid
      JOIN pg_class cp ON cp.oid = con.confrelid
      JOIN unnest(con.conkey) k ON true
      JOIN pg_attribute a ON a.attrelid = con.conrelid AND a.attnum = k
      WHERE con.contype = 'f'
        AND n.nspname = 'public'
        AND array_length(con.conkey, 1) = 1
        AND a.attname <> 'store_id'
        AND EXISTS (
          SELECT 1 FROM pg_attribute sa
          WHERE sa.attrelid = con.conrelid AND sa.attname = 'store_id' AND sa.attnum > 0 AND NOT sa.attisdropped
        )
        AND EXISTS (
          SELECT 1 FROM pg_attribute pa
          WHERE pa.attrelid = con.confrelid AND pa.attname = 'store_id' AND pa.attnum > 0 AND NOT pa.attisdropped
        )
    ) pairs
    GROUP BY child
  LOOP
    args := rec.arg_list;
    EXECUTE format('DROP TRIGGER IF EXISTS enforce_tenant_refs ON %s', rec.child);
    EXECUTE format(
      'CREATE TRIGGER enforce_tenant_refs BEFORE INSERT OR UPDATE ON %s FOR EACH ROW EXECUTE FUNCTION app_private.enforce_tenant_refs(%s)',
      rec.child, args
    );
  END LOOP;
END
$outer$;