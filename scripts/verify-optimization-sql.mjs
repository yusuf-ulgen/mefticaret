import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";

if (!process.argv[2]) throw new Error("Pass the local PGlite runtime path");
const { PGlite } = await import(pathToFileURL(path.resolve(process.argv[2])).href);
const db = new PGlite();
await db.exec(`
CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT NULLIF(current_setting('qa.user',true),'')::uuid $$;
CREATE TABLE stores(id uuid PRIMARY KEY,owner_id uuid,currency text);
CREATE TABLE customers(id uuid PRIMARY KEY,store_id uuid,phone text,email text);
CREATE TABLE orders(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),store_id uuid,customer_phone text,customer_email text,grand_total numeric,currency text,payment_status text,status text,placed_at timestamptz);
ALTER TABLE stores ENABLE ROW LEVEL SECURITY; ALTER TABLE customers ENABLE ROW LEVEL SECURITY; ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY stores_read ON stores TO authenticated USING(owner_id=auth.uid());
CREATE POLICY customers_read ON customers TO authenticated USING(EXISTS(SELECT 1 FROM stores s WHERE s.id=store_id));
CREATE POLICY orders_read ON orders TO authenticated USING(EXISTS(SELECT 1 FROM stores s WHERE s.id=store_id));
GRANT USAGE ON SCHEMA public,auth TO authenticated; GRANT SELECT ON stores,customers,orders TO authenticated;
INSERT INTO stores VALUES ('10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','TRY'),('10000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000002','TRY');
INSERT INTO customers VALUES ('30000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','0531 123 45 67','Own@Example.test'),('30000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000002','0531 123 45 67','Own@Example.test');
INSERT INTO orders(store_id,customer_phone,customer_email,grand_total,currency,payment_status,status,placed_at) VALUES
('10000000-0000-0000-0000-000000000001','+90 531 123 4567','own@example.test',50,'TRY','paid','fulfilled','2026-10-13'),
('10000000-0000-0000-0000-000000000001','05311234567',NULL,90,'USD','paid','fulfilled','2026-10-13'),
('10000000-0000-0000-0000-000000000001','05311234567',NULL,100,'TRY','paid','cancelled','2026-10-13'),
('10000000-0000-0000-0000-000000000001',NULL,'own@example.test',10,'TRY','pending','pending','2026-10-13'),
('10000000-0000-0000-0000-000000000002','05311234567',NULL,777,'TRY','paid','fulfilled','2026-10-13');
INSERT INTO orders(store_id,customer_phone,grand_total,currency,payment_status,status,placed_at) SELECT '10000000-0000-0000-0000-000000000001','05311234567',1,'TRY','paid','fulfilled','2026-10-13' FROM generate_series(1,2001);
`);
await db.exec(await fs.readFile("supabase/migrations/20261013100000_customer_page_summaries.sql", "utf8"));
await db.exec("SET ROLE authenticated; SELECT set_config('qa.user','20000000-0000-0000-0000-000000000001',false)");
const query = (store, customer) => db.query("SELECT * FROM customer_page_summaries($1::uuid,ARRAY[$2::uuid])", [store, customer]);
const own = await query("10000000-0000-0000-0000-000000000001", "30000000-0000-0000-0000-000000000001");
assert.equal(own.rows.length, 1);
assert.equal(Number(own.rows[0].orders_count), 2004);
assert.equal(Number(own.rows[0].total_spent), 2051);
assert.equal(own.rows[0].currency, "TRY");
assert.equal((await query("10000000-0000-0000-0000-000000000002", "30000000-0000-0000-0000-000000000002")).rows.length, 0);
await db.exec("SELECT set_config('qa.user','20000000-0000-0000-0000-000000000002',false)");
assert.equal((await query("10000000-0000-0000-0000-000000000001", "30000000-0000-0000-0000-000000000001")).rows.length, 0);
assert.equal(Number((await query("10000000-0000-0000-0000-000000000002", "30000000-0000-0000-0000-000000000002")).rows[0].total_spent), 777);
await db.close();
console.log("Optimization SQL QA passed: 7 checks, RLS tenant isolation and >2000 orders; isolated database only");
