/**
 * Minimal `Reflect.metadata` polyfill.
 *
 * WebAuthn doğrulaması için kullanılan `@simplewebauthn/server` → `@peculiar/x509`
 * → `tsyringe` zinciri, modül yüklenirken `Reflect.getMetadata` arar. Edge
 * worker'da bu polyfill olmadan paket yüklenirken hata atıyor ve tüm sayfalar
 * 500 dönüyordu. Bu dosya sunucu giriş noktasında ilk sırada import edilir.
 */

const target = Reflect as unknown as Record<string, unknown>;

if (typeof target["getMetadata"] !== "function") {
  const store = new WeakMap<object, Map<unknown, unknown>>();
  const bag = (obj: object) => {
    let map = store.get(obj);
    if (!map) {
      map = new Map();
      store.set(obj, map);
    }
    return map;
  };

  target["defineMetadata"] = (key: unknown, value: unknown, obj: object) => {
    bag(obj).set(key, value);
  };
  target["getMetadata"] = (key: unknown, obj: object) => bag(obj).get(key);
  target["getOwnMetadata"] = target["getMetadata"];
  target["hasMetadata"] = (key: unknown, obj: object) => bag(obj).has(key);
  target["hasOwnMetadata"] = target["hasMetadata"];
  target["deleteMetadata"] = (key: unknown, obj: object) => bag(obj).delete(key);
  target["getMetadataKeys"] = (obj: object) => Array.from(bag(obj).keys());
  target["getOwnMetadataKeys"] = target["getMetadataKeys"];
  target["metadata"] =
    (key: unknown, value: unknown) =>
    (obj: object) => {
      bag(obj).set(key, value);
    };
}

export {};
