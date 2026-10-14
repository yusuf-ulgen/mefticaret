// Isolated PostgreSQL-compatible QA. Never reads production credentials or connects to Supabase.
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";

const runtime = process.argv[2];
if (!runtime) throw new Error("Pass the local @electric-sql/pglite/dist/index.js path");
const { PGlite } = await import(pathToFileURL(path.resolve(runtime)).href);
const db = new PGlite();
// The connected production project consumes Drizzle's journal, not only supabase/migrations.
const followupSql = (
  await Promise.all(
    [
      "20261014100000_recover_supplier_commission_history.sql",
      "20261014101000_publish_policy_atomically.sql",
    ].map((name) => fs.readFile(path.join("supabase/migrations", name), "utf8")),
  )
).join("\n--> statement-breakpoint\n");
assert.equal(
  (await fs.readFile("drizzle/migrations/0010_report_followup_repairs.sql", "utf8")).replace(/\r\n/g, "\n"),
  followupSql.replace(/\r\n/g, "\n"),
);
const migrationJournal = JSON.parse(
  await fs.readFile("drizzle/migrations/meta/_journal.json", "utf8"),
);
assert.ok(
  migrationJournal.entries.some(
    (entry) => entry.idx === 10 && entry.tag === "0010_report_followup_repairs",
  ),
);
await db.exec(`
CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
CREATE SCHEMA auth; CREATE SCHEMA app_private;
CREATE TYPE public.app_role AS ENUM ('platform_admin');
CREATE TYPE public.payment_status AS ENUM ('pending','paid','partially_refunded','refunded','failed');
CREATE TYPE public.fulfillment_status AS ENUM ('unfulfilled','partially_fulfilled','fulfilled','returned');
CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql AS $$ SELECT COALESCE(NULLIF(current_setting('qa.role',true),''),'service_role') $$;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT NULLIF(current_setting('qa.actor',true),'')::uuid $$;
CREATE TABLE stores(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_id uuid);
CREATE TABLE plans(id uuid PRIMARY KEY DEFAULT gen_random_uuid());
CREATE FUNCTION app_private.can_manage_store(s uuid,a uuid) RETURNS boolean LANGUAGE sql AS $$ SELECT EXISTS(SELECT 1 FROM stores WHERE id=s AND owner_id=a) $$;
CREATE FUNCTION app_private.has_role(a uuid,r public.app_role) RETURNS boolean LANGUAGE sql AS $$ SELECT false $$;
CREATE TABLE products(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),store_id uuid,is_digital boolean DEFAULT false);
CREATE TABLE orders(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),store_id uuid,grand_total numeric DEFAULT 100,currency text DEFAULT 'TRY',payment_status payment_status DEFAULT 'pending',status text DEFAULT 'pending',is_digital boolean DEFAULT false);
CREATE TABLE order_items(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),store_id uuid,order_id uuid,product_id uuid,quantity integer DEFAULT 1);
CREATE TABLE shipments(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),store_id uuid,order_id uuid);
ALTER TABLE shipments ADD COLUMN status text DEFAULT 'pending', ADD COLUMN carrier text, ADD COLUMN tracking_number text, ADD COLUMN created_at timestamptz DEFAULT now();
ALTER TABLE orders ADD COLUMN fulfillment_status public.fulfillment_status DEFAULT 'unfulfilled', ADD COLUMN shipping_carrier text, ADD COLUMN tracking_number text;
CREATE TABLE shipment_items(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),shipment_id uuid,order_item_id uuid,quantity integer);
CREATE TABLE order_events(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),store_id uuid,order_id uuid,actor_id uuid,kind text,message text,meta jsonb);
CREATE TABLE kolay_receipt_checks(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),store_id uuid,order_id uuid,status text DEFAULT 'pending',created_at timestamptz DEFAULT now());
CREATE TABLE policies(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),store_id uuid,policy_key text,current_version_id uuid,is_visible boolean DEFAULT true,acceptance_count int DEFAULT 0);
CREATE TABLE policy_versions(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),policy_id uuid,store_id uuid,version text DEFAULT '1.0',content text DEFAULT 'Published text',is_active boolean DEFAULT true,published_at timestamptz DEFAULT now(),effective_date date DEFAULT CURRENT_DATE);
CREATE TABLE policy_acceptances(policy_id uuid,policy_version_id uuid,store_id uuid,version_label text,user_type text,user_id uuid,subject_email text,order_number text,ip_address text,user_agent text,acceptance_method text);
ALTER TABLE orders ADD COLUMN customer_email text,ADD COLUMN order_number text;
CREATE TABLE platform_posts(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),slug text UNIQUE,is_published boolean DEFAULT true);
CREATE TABLE suppliers(id uuid PRIMARY KEY DEFAULT gen_random_uuid());
CREATE TABLE store_supplier_imports(store_id uuid,product_id uuid,supplier_id uuid);
CREATE TABLE supplier_products(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),supplier_id uuid,product_id uuid,variant_id uuid);
CREATE TABLE supplier_commission_entries(order_item_id uuid,supplier_id uuid,order_id uuid);
CREATE TABLE refunds(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),store_id uuid,order_id uuid,amount numeric DEFAULT 20,currency text DEFAULT 'TRY',status text DEFAULT 'pending',refund_number text,refund_method text DEFAULT 'original_payment',processed_by uuid,processed_at timestamptz,reason text,note text,idempotency_key text,created_by uuid,total_tax numeric);
CREATE TABLE refund_transactions(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),refund_id uuid,status text);
CREATE TABLE refund_line_items(refund_id uuid,order_item_id uuid,restock boolean,quantity int,store_id uuid,subtotal numeric,total_tax numeric);
CREATE TABLE product_variants(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),stock int);
CREATE TABLE customer_store_credits(store_id uuid,customer_id uuid,amount numeric,currency text,refund_id uuid,order_id uuid,note text);
ALTER TABLE orders ADD COLUMN customer_id uuid;
ALTER TABLE order_items ADD COLUMN title text, ADD COLUMN unit_price numeric, ADD COLUMN tax_total numeric, ADD COLUMN variant_id uuid;
CREATE TABLE qnbpay_transactions(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),amount numeric DEFAULT 100,refunded_amount numeric DEFAULT 0,status text DEFAULT 'completed');
CREATE TABLE qnbpay_refunds(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),transaction_id uuid,amount numeric,status text DEFAULT 'pending',ref_no text,response_summary jsonb,webhook_payload jsonb,created_at timestamptz DEFAULT now(),CONSTRAINT qnbpay_refund_status_chk CHECK(status IN('pending','completed','failed')));
`);
for (const name of [
  "20261012090000_order_item_delivery_snapshot.sql",
  "20261012091000_store_order_summary.sql",
  "20261012092000_receipt_manual_review.sql",
  "20261012093000_qnbpay_refund_accounting.sql",
  "20261012094000_refund_claims.sql",
  "20261012095000_order_supplier_snapshot.sql",
  "20261012100000_checkout_policy_evidence.sql",
  "20261012101000_requested_plan_selection.sql",
  "20261012102000_platform_blog_slug_history.sql",
]) {
  await db.exec(await fs.readFile(path.join("supabase/migrations", name), "utf8"));
}
let checks = 0;
await db.exec(
  "CREATE TRIGGER shipments_sync_order AFTER INSERT OR UPDATE OR DELETE ON shipments FOR EACH ROW EXECUTE FUNCTION sync_order_fulfillment()",
);
const row = async (sql, args = []) => (await db.query(sql, args)).rows[0];
const fails = async (sql, args) => {
  await assert.rejects(db.query(sql, args));
  checks++;
};
const actor = "00000000-0000-4000-8000-000000000001";
const store = (await row("INSERT INTO stores(owner_id) VALUES($1) RETURNING id", [actor])).id;
const order = (await row("INSERT INTO orders(store_id) VALUES($1) RETURNING id", [store])).id;
const receipt = (
  await row(
    "INSERT INTO kolay_receipt_checks(store_id,order_id,status,receipt_sha256) VALUES($1,$2,'pending_review','image-one') RETURNING id",
    [store, order],
  )
).id;
await fails("SELECT review_payment_receipt($1,$2,true,'bank-1')", [
  receipt,
  "00000000-0000-4000-8000-000000000002",
]);
await db.query("SELECT review_payment_receipt($1,$2,true,'bank-1')", [receipt, actor]);
await db.query("SELECT review_payment_receipt($1,$2,true,'bank-1')", [receipt, actor]);
assert.equal((await row("SELECT count(*)::int n FROM order_events")).n, 1);
checks++;
await db.query("UPDATE orders SET payment_status='refunded',status='refunded' WHERE id=$1", [
  order,
]);
await db.query("SELECT review_payment_receipt($1,$2,true,'bank-1')", [receipt, actor]);
assert.equal(
  (await row("SELECT payment_status FROM orders WHERE id=$1", [order])).payment_status,
  "refunded",
);
checks++;
const cancelled = (
  await row("INSERT INTO orders(store_id,status) VALUES($1,'cancelled') RETURNING id", [store])
).id;
const cancelledReceipt = (
  await row(
    "INSERT INTO kolay_receipt_checks(store_id,order_id,status) VALUES($1,$2,'pending_review') RETURNING id",
    [store, cancelled],
  )
).id;
await fails("SELECT review_payment_receipt($1,$2,true,'bank-2')", [cancelledReceipt, actor]);
await fails(
  "INSERT INTO kolay_receipt_checks(store_id,order_id,receipt_sha256) VALUES($1,$2,'image-one')",
  [store, order],
);
const tx = (await row("INSERT INTO qnbpay_transactions DEFAULT VALUES RETURNING id")).id;
await db.query("SELECT record_qnbpay_refund($1,'REF-20',20,true,true)", [tx]);
for (let i = 0; i < 10; i++)
  await db.query(
    "SELECT record_qnbpay_refund($1,'REF-20',20,false,true,NULL,'same-signed-event','{}')",
    [tx],
  );
await db.query("SELECT record_qnbpay_refund($1,'REF-20',20,true,true)", [tx]);
assert.equal(
  Number(
    (await row("SELECT refunded_amount FROM qnbpay_transactions WHERE id=$1", [tx]))
      .refunded_amount,
  ),
  20,
);
checks++;
assert.equal(
  (
    await row(
      "SELECT count(*)::int n FROM qnbpay_refunds WHERE transaction_id=$1 AND status='completed'",
      [tx],
    )
  ).n,
  1,
);
checks++;
await fails("SELECT record_qnbpay_refund($1,'REF-20',21,true,true)", [tx]);
await fails("SELECT record_qnbpay_refund($1,'REF-90',90,true,true)", [tx]);
// A callback arriving before the authenticated response cannot move money.
const early = (await row("INSERT INTO qnbpay_transactions DEFAULT VALUES RETURNING id")).id;
await db.query("SELECT record_qnbpay_refund($1,'EARLY',20,false,true,NULL,'early-event','{}')", [
  early,
]);
assert.equal(
  Number(
    (await row("SELECT refunded_amount FROM qnbpay_transactions WHERE id=$1", [early]))
      .refunded_amount,
  ),
  0,
);
checks++;
const request = (
  await row("INSERT INTO qnbpay_refunds(transaction_id,amount) VALUES($1,20) RETURNING id", [early])
).id;
await db.query("SELECT record_qnbpay_refund($1,'EARLY',20,true,true,$2)", [early, request]);
assert.equal(
  Number(
    (await row("SELECT refunded_amount FROM qnbpay_transactions WHERE id=$1", [early]))
      .refunded_amount,
  ),
  20,
);
checks++;
assert.equal(
  (
    await row(
      "SELECT count(*)::int n FROM qnbpay_refunds WHERE transaction_id=$1 AND status='completed'",
      [early],
    )
  ).n,
  1,
);
checks++;
const physicalProduct = (
  await row("INSERT INTO products(store_id) VALUES($1) RETURNING id", [store])
).id;
const digitalProduct = (
  await row("INSERT INTO products(store_id,is_digital) VALUES($1,true) RETURNING id", [store])
).id;
const physical = (
  await row("INSERT INTO order_items(store_id,order_id,product_id) VALUES($1,$2,$3) RETURNING id", [
    store,
    order,
    physicalProduct,
  ])
).id;
const digital = (
  await row("INSERT INTO order_items(store_id,order_id,product_id) VALUES($1,$2,$3) RETURNING id", [
    store,
    order,
    digitalProduct,
  ])
).id;
const shipment = (
  await row("INSERT INTO shipments(store_id,order_id) VALUES($1,$2) RETURNING id", [store, order])
).id;
const mixedOrder = (await row("INSERT INTO orders(store_id) VALUES($1) RETURNING id", [store])).id;
const mixedPhysical = (
  await row("INSERT INTO order_items(store_id,order_id,product_id) VALUES($1,$2,$3) RETURNING id", [
    store,
    mixedOrder,
    physicalProduct,
  ])
).id;
await db.query("INSERT INTO order_items(store_id,order_id,product_id) VALUES($1,$2,$3)", [
  store,
  mixedOrder,
  digitalProduct,
]);
const mixedShipment = (
  await row("INSERT INTO shipments(store_id,order_id) VALUES($1,$2) RETURNING id", [
    store,
    mixedOrder,
  ])
).id;
await db.query("INSERT INTO shipment_items(shipment_id,order_item_id,quantity) VALUES($1,$2,1)", [
  mixedShipment,
  mixedPhysical,
]);
await db.query("UPDATE shipments SET status='delivered' WHERE id=$1", [mixedShipment]);
assert.equal(
  (await row("SELECT fulfillment_status FROM orders WHERE id=$1", [mixedOrder])).fulfillment_status,
  "partially_fulfilled",
);
checks++;
await fails("INSERT INTO shipment_items(shipment_id,order_item_id,quantity) VALUES($1,$2,1)", [
  shipment,
  digital,
]);
await db.query("INSERT INTO shipment_items(shipment_id,order_item_id,quantity) VALUES($1,$2,1)", [
  shipment,
  physical,
]);
checks++;
const refund = (
  await row(
    "INSERT INTO refunds(store_id,order_id,refund_number) VALUES($1,$2,'REF-1') RETURNING id",
    [store, order],
  )
).id;
const claims = await Promise.all([
  db.query("SELECT claim_order_refund($1,$2) result", [refund, actor]),
  db.query("SELECT claim_order_refund($1,$2) result", [refund, actor]),
]);
assert.equal(claims.filter((r) => r.rows[0].result.claimed).length, 1);
checks++;
const providerTx = (await row("INSERT INTO qnbpay_transactions DEFAULT VALUES RETURNING id")).id;
const providerClaims = await Promise.all([
  db.query("SELECT claim_qnbpay_refund($1,20,'request-1') result", [providerTx]),
  db.query("SELECT claim_qnbpay_refund($1,20,'request-1') result", [providerTx]),
]);
assert.equal(providerClaims.filter((r) => r.rows[0].result.claimed).length, 1);
checks++;
const providerId = providerClaims.find((r) => r.rows[0].result.claimed).rows[0].result.id;
await db.query("UPDATE qnbpay_refunds SET status='unknown' WHERE id=$1", [providerId]);
assert.equal(
  (await row("SELECT claim_qnbpay_refund($1,20,'request-1') result", [providerTx])).result.claimed,
  false,
);
checks++;
await fails("SELECT claim_qnbpay_refund($1,90,'request-2')", [providerTx]);
await db.query("SELECT record_qnbpay_refund($1,'CONFIRMED',20,true,true,$2)", [
  providerTx,
  providerId,
]);
assert.equal(
  (await row("SELECT claim_qnbpay_refund($1,20,'request-1') result", [providerTx])).result.status,
  "completed",
);
checks++;
await db.query("SELECT finalize_order_refund($1,true,$2,'recovered')", [refund, actor]);
await db.query("SELECT finalize_order_refund($1,true,$2,'recovered')", [refund, actor]);
assert.equal(
  (
    await row(
      "SELECT count(*)::int n FROM order_events WHERE kind='refund_processed' AND order_id=$1",
      [order],
    )
  ).n,
  1,
);
checks++;
const supplier = (await row("INSERT INTO suppliers DEFAULT VALUES RETURNING id")).id;
await db.query(
  "INSERT INTO store_supplier_imports(store_id,product_id,supplier_id) VALUES($1,$2,$3)",
  [store, physicalProduct, supplier],
);
const snapshotted = (
  await row("INSERT INTO order_items(store_id,order_id,product_id) VALUES($1,$2,$3) RETURNING id", [
    store,
    order,
    physicalProduct,
  ])
).id;
await db.query("UPDATE order_items SET product_id=NULL WHERE id=$1", [snapshotted]);
await db.query("DELETE FROM store_supplier_imports WHERE product_id=$1", [physicalProduct]);
assert.equal(
  (await row("SELECT supplier_id FROM order_item_suppliers WHERE order_item_id=$1", [snapshotted]))
    .supplier_id,
  supplier,
);
checks++;
await fails("DELETE FROM suppliers WHERE id=$1", [supplier]);
const versionIds = [];
for (const key of ["privacy", "refund", "distance_selling"]) {
  const policy = (
    await row("INSERT INTO policies(store_id,policy_key) VALUES($1,$2) RETURNING id", [store, key])
  ).id;
  const version = (
    await row("INSERT INTO policy_versions(policy_id,store_id) VALUES($1,$2) RETURNING id", [
      policy,
      store,
    ])
  ).id;
  await db.query("UPDATE policies SET current_version_id=$1 WHERE id=$2", [version, policy]);
  versionIds.push(version);
}
await fails("INSERT INTO orders(store_id,checkout_policy_version_ids) VALUES($1,$2)", [
  store,
  versionIds.slice(0, 2),
]);
await db.query(
  "INSERT INTO orders(store_id,order_number,customer_email,checkout_policy_version_ids,checkout_acceptance_meta) VALUES($1,'QA-CHECKOUT','qa@example.test',$2,'{}')",
  [store, versionIds],
);
assert.equal(
  (await row("SELECT count(*)::int n FROM policy_acceptances WHERE order_number='QA-CHECKOUT'")).n,
  3,
);
checks++;
await db.query("UPDATE policy_versions SET is_active=false WHERE id=$1", [versionIds[0]]);
await fails("INSERT INTO orders(store_id,checkout_policy_version_ids) VALUES($1,$2)", [
  store,
  versionIds,
]);
await fails("INSERT INTO orders(store_id,checkout_policy_version_ids) VALUES($1,$2)", [
  store,
  [versionIds[1], versionIds[1], versionIds[2]],
]);
const article = (await row("INSERT INTO platform_posts(slug) VALUES('old-blog') RETURNING id")).id;
await db.query("UPDATE platform_posts SET slug='new-blog' WHERE id=$1", [article]);
await db.query("UPDATE platform_posts SET slug='latest-blog' WHERE id=$1", [article]);
assert.equal(
  (
    await row(
      "SELECT p.slug FROM platform_post_redirects r JOIN platform_posts p ON p.id=r.post_id WHERE old_slug='old-blog'",
    )
  ).slug,
  "latest-blog",
);
checks++;
const summaryBefore = (await row("SELECT store_order_summary($1) result", [store])).result;
await db.query(
  "INSERT INTO orders(store_id,order_number,payment_status,currency,grand_total) SELECT $1,'QA-SUM-'||n,'paid'::payment_status,CASE WHEN n%2=0 THEN 'EUR' ELSE 'TRY' END,CASE WHEN n%2=0 THEN 20 ELSE 10 END FROM generate_series(1,250) n",
  [store],
);
await db.query("UPDATE orders SET status='cancelled' WHERE order_number='QA-SUM-1'");
const aggregate = (await row("SELECT store_order_summary($1) result", [store])).result;
assert.equal(aggregate.total, summaryBefore.total + 250);
checks++;
assert.equal(aggregate.paidRevenue.TRY, (summaryBefore.paidRevenue.TRY ?? 0) + 1240);
checks++;
assert.equal(aggregate.paidRevenue.EUR, (summaryBefore.paidRevenue.EUR ?? 0) + 2500);
checks++;
await db.query(
  "INSERT INTO orders(store_id,grand_total,payment_status) VALUES(gen_random_uuid(),900000,'paid')",
);
assert.deepEqual((await row("SELECT store_order_summary($1) result", [store])).result, aggregate);
checks++;
// Follow-up: restore only certain legacy commission ownership.
const recoverySupplier = (await row("INSERT INTO suppliers DEFAULT VALUES RETURNING id")).id;
const legacyItems = [];
for (let n = 0; n < 2; n++) {
  const item = (
    await row("INSERT INTO order_items(store_id,order_id) VALUES($1,$2) RETURNING id", [
      store,
      order,
    ])
  ).id;
  await db.query(
    "INSERT INTO supplier_commission_entries(order_item_id,supplier_id,order_id) VALUES($1,$2,$3)",
    [item, supplier, order],
  );
  if (n === 1)
    await db.query(
      "INSERT INTO supplier_commission_entries(order_item_id,supplier_id,order_id) VALUES($1,$2,$3)",
      [item, recoverySupplier, order],
    );
  await db.query("DELETE FROM order_item_suppliers WHERE order_item_id=$1", [item]);
  legacyItems.push(item);
}
const recoverySql = await fs.readFile(
  "supabase/migrations/20261014100000_recover_supplier_commission_history.sql",
  "utf8",
);
await db.exec(recoverySql);
assert.equal(
  (
    await row("SELECT supplier_id FROM order_item_suppliers WHERE order_item_id=$1", [
      legacyItems[0],
    ])
  ).supplier_id,
  supplier,
);
checks++;
assert.equal(
  (
    await row("SELECT count(*)::int n FROM order_item_suppliers WHERE order_item_id=$1", [
      legacyItems[1],
    ])
  ).n,
  0,
);
checks++;
await db.exec(recoverySql);
assert.equal(
  (
    await row("SELECT count(*)::int n FROM order_item_suppliers WHERE order_item_id=$1", [
      legacyItems[0],
    ])
  ).n,
  1,
);
checks++;

// Follow-up: publication is one transaction and respects actor/store/draft scope.
await db.exec(`
ALTER TABLE policies ADD COLUMN title text DEFAULT 'QA policy', ADD COLUMN version text DEFAULT '1.0',
  ADD COLUMN updated_at timestamptz DEFAULT now(), ADD COLUMN effective_date date,
  ADD COLUMN change_summary text, ADD COLUMN requires_acceptance boolean,
  ADD COLUMN last_reviewed_at timestamptz, ADD COLUMN last_reviewed_by uuid;
ALTER TABLE policy_versions ADD COLUMN title text, ADD COLUMN change_summary text,
  ADD COLUMN requires_acceptance boolean, ADD COLUMN created_by uuid;
ALTER TABLE policy_versions ADD CONSTRAINT qa_policy_version_unique UNIQUE(policy_id,version);
`);
await db.exec(
  await fs.readFile("supabase/migrations/20261014101000_publish_policy_atomically.sql", "utf8"),
);
const publication = await row(
  "INSERT INTO policies(store_id,policy_key,is_visible) VALUES($1,'cookie',false) RETURNING id,updated_at",
  [store],
);
const publishSql = "SELECT publish_policy_version($1,$2,$3,'minor',CURRENT_DATE,$4,true,$5) result";
const publishArgs = [
  publication.id,
  store,
  "<p>Reviewed store policy</p>",
  "QA publication",
  publication.updated_at,
];
await fails(publishSql, publishArgs); // No authenticated actor.
await db.query("SELECT set_config('qa.actor',$1,false)", [actor]);
await fails(publishSql, [
  publication.id,
  store,
  "<p></p>",
  "QA empty text",
  publication.updated_at,
]);
await fails(publishSql, [
  publication.id,
  store,
  publishArgs[2],
  "QA stale draft",
  "2020-01-01T00:00:00Z",
]);
const foreignStore = (
  await row("INSERT INTO stores(owner_id) VALUES(gen_random_uuid()) RETURNING id")
).id;
await fails(publishSql, [
  publication.id,
  foreignStore,
  publishArgs[2],
  "QA wrong scope",
  publication.updated_at,
]);
assert.equal((await row(publishSql, publishArgs)).result.version, "1.0");
checks++;
assert.equal(
  (await row("SELECT is_visible FROM policies WHERE id=$1", [publication.id])).is_visible,
  true,
);
checks++;
assert.equal((await row(publishSql, publishArgs)).result.version, "1.1");
checks++;
assert.equal(
  (
    await row("SELECT count(*)::int n FROM policy_versions WHERE policy_id=$1 AND is_active", [
      publication.id,
    ])
  ).n,
  1,
);
checks++;
await db.exec(`CREATE FUNCTION qa_fail_publication() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN IF NEW.change_summary = 'QA force rollback' THEN RAISE EXCEPTION 'QA write failure'; END IF; RETURN NEW; END $$;
CREATE TRIGGER qa_fail_publication BEFORE UPDATE ON policies FOR EACH ROW EXECUTE FUNCTION qa_fail_publication();`);
await fails(publishSql, [
  publication.id,
  store,
  publishArgs[2],
  "QA force rollback",
  publication.updated_at,
]);
assert.equal(
  (await row("SELECT version FROM policies WHERE id=$1", [publication.id])).version,
  "1.1",
);
assert.equal(
  (await row("SELECT count(*)::int n FROM policy_versions WHERE policy_id=$1", [publication.id])).n,
  2,
);
assert.equal(
  (
    await row("SELECT version FROM policy_versions WHERE policy_id=$1 AND is_active", [
      publication.id,
    ])
  ).version,
  "1.1",
);
checks++;
const orphanPolicy = await row(
  "INSERT INTO policies(store_id,policy_key) VALUES($1,'qa_orphan') RETURNING id,updated_at",
  [store],
);
await db.query(
  "INSERT INTO policy_versions(policy_id,store_id,version,is_active) VALUES($1,$2,'1.0',false)",
  [orphanPolicy.id, store],
);
assert.equal(
  (
    await row(publishSql, [
      orphanPolicy.id,
      store,
      publishArgs[2],
      "QA recover orphan",
      orphanPolicy.updated_at,
    ])
  ).result.version,
  "1.1",
);
checks++;
console.log(`SQL QA passed: ${checks} checks, isolated database only`);
await db.close();
