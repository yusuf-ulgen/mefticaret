/** Klaviyo API istemcisi (yalnız sunucu). Anahtarlar mağaza kurulumundan veya
 *  platform için KLAVIYO_PRIVATE_API_KEY gizli değişkeninden okunur. */

const BASE = "https://a.klaviyo.com/api";
const REVISION = "2024-10-15";

export class KlaviyoError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export async function klaviyoFetch<T = any>(
  apiKey: string,
  path: string,
  init: { method?: string; body?: unknown } = {},
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
  try {
    const res = await fetch(`${BASE}${path}`, {
      method: init.method ?? "GET",
      headers: {
        Authorization: `Klaviyo-API-Key ${apiKey}`,
        revision: REVISION,
        Accept: "application/vnd.api+json",
        ...(init.body ? { "Content-Type": "application/vnd.api+json" } : {}),
      },
      body: init.body ? JSON.stringify(init.body) : null,
      signal: controller.signal,
    });
    const text = await res.text();
    if (!res.ok) {
      let detail = text.slice(0, 300);
      try {
        const json = JSON.parse(text) as { errors?: { detail?: string }[] };
        detail = json.errors?.map((e) => e.detail).filter(Boolean).join("; ") || detail;
      } catch {
        /* düz metin */
      }
      throw new KlaviyoError(res.status, `Klaviyo ${res.status}: ${detail || "ayrıntı yok"}`);
    }
    return (text ? JSON.parse(text) : {}) as T;
  } finally {
    clearTimeout(timeout);
  }
}

/** Anahtarı ve (varsa) listeyi doğrular. */
export async function verifyKlaviyo(apiKey: string, listId?: string) {
  const account = await klaviyoFetch(apiKey, "/accounts/");
  const org = account?.data?.[0]?.attributes?.contact_information?.organization_name as string | undefined;
  let listName: string | null = null;
  if (listId) {
    const list = await klaviyoFetch(apiKey, `/lists/${encodeURIComponent(listId)}/`);
    listName = list?.data?.attributes?.name ?? null;
  }
  return { organization: org ?? null, listName };
}

export async function listKlaviyoLists(apiKey: string) {
  const res = await klaviyoFetch(apiKey, "/lists/?fields[list]=name");
  return ((res?.data ?? []) as { id: string; attributes: { name: string } }[]).map((l) => ({
    id: l.id,
    name: l.attributes.name,
  }));
}

export type KlaviyoProfile = {
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  properties?: Record<string, unknown>;
};

/** E-posta pazarlama izniyle listeye abone eder (1000'lik parçalar). */
export async function subscribeProfiles(apiKey: string, listId: string, profiles: KlaviyoProfile[]) {
  let jobs = 0;
  for (let i = 0; i < profiles.length; i += 1000) {
    const chunk = profiles.slice(i, i + 1000);
    await klaviyoFetch(apiKey, "/profile-subscription-bulk-create-jobs/", {
      method: "POST",
      body: {
        data: {
          type: "profile-subscription-bulk-create-job",
          attributes: {
            custom_source: "Mefticaret",
            profiles: {
              data: chunk.map((p) => ({
                type: "profile",
                attributes: {
                  email: p.email,
                  subscriptions: { email: { marketing: { consent: "SUBSCRIBED" } } },
                },
              })),
            },
          },
          relationships: { list: { data: { type: "list", id: listId } } },
        },
      },
    });
    jobs += 1;
  }
  // Ad/soyad gibi alanlar abonelik işinde taşınmaz; ayrıca profil olarak yazılır.
  const named = profiles.filter((p) => p.firstName || p.lastName || p.properties);
  for (const p of named.slice(0, 200)) {
    await upsertProfile(apiKey, p).catch(() => undefined);
  }
  return { jobs, count: profiles.length };
}

export async function upsertProfile(apiKey: string, p: KlaviyoProfile) {
  return klaviyoFetch(apiKey, "/profile-import/", {
    method: "POST",
    body: {
      data: {
        type: "profile",
        attributes: {
          email: p.email,
          ...(p.firstName ? { first_name: p.firstName } : {}),
          ...(p.lastName ? { last_name: p.lastName } : {}),
          ...(p.properties ? { properties: p.properties } : {}),
        },
      },
    },
  });
}

/** Hazır HTML ile Klaviyo kampanyası oluşturur ve hemen gönderim sırasına alır. */
export async function sendKlaviyoCampaign(
  apiKey: string,
  input: {
    name: string;
    listId: string;
    subject: string;
    previewText: string;
    fromEmail: string;
    fromLabel: string;
    html: string;
    text: string;
  },
) {
  const template = await klaviyoFetch(apiKey, "/templates/", {
    method: "POST",
    body: {
      data: {
        type: "template",
        attributes: { name: input.name, editor_type: "CODE", html: input.html, text: input.text },
      },
    },
  });
  const templateId = template?.data?.id as string;

  const campaign = await klaviyoFetch(apiKey, "/campaigns/", {
    method: "POST",
    body: {
      data: {
        type: "campaign",
        attributes: {
          name: input.name,
          audiences: { included: [input.listId], excluded: [] },
          send_strategy: { method: "immediate" },
          "campaign-messages": {
            data: [
              {
                type: "campaign-message",
                attributes: {
                  channel: "email",
                  label: input.name,
                  content: {
                    subject: input.subject,
                    preview_text: input.previewText,
                    from_email: input.fromEmail,
                    from_label: input.fromLabel,
                  },
                },
              },
            ],
          },
        },
      },
    },
  });
  const campaignId = campaign?.data?.id as string;
  const messageId = campaign?.data?.relationships?.["campaign-messages"]?.data?.[0]?.id as string;
  if (!campaignId || !messageId || !templateId) throw new Error("Klaviyo kampanyası oluşturulamadı");

  await klaviyoFetch(apiKey, "/campaign-message-assign-template/", {
    method: "POST",
    body: {
      data: {
        type: "campaign-message",
        id: messageId,
        relationships: { template: { data: { type: "template", id: templateId } } },
      },
    },
  });
  await klaviyoFetch(apiKey, "/campaign-send-jobs/", {
    method: "POST",
    body: { data: { type: "campaign-send-job", id: campaignId } },
  });
  return { campaignId };
}

export type StoreKlaviyo = {
  apiKey: string;
  listId: string;
  fromEmail: string;
  sendCampaigns: boolean;
};

/** Mağazada kurulu ve hatasız Klaviyo ayarlarını döndürür (yoksa null). */
export async function loadStoreKlaviyo(supabase: any, storeId: string): Promise<StoreKlaviyo | null> {
  const { data } = await supabase
    .from("app_installations")
    .select("status, settings, apps!inner(code)")
    .eq("store_id", storeId)
    .eq("apps.code", "klaviyo")
    .maybeSingle();
  if (!data || data.status !== "installed") return null;
  const s = (data.settings ?? {}) as Record<string, unknown>;
  if (s["_connection_status"] === "error") return null;
  const apiKey = String(s["private_api_key"] ?? "").trim();
  const listId = String(s["list_id"] ?? "").trim();
  if (!apiKey || !listId) return null;
  return {
    apiKey,
    listId,
    fromEmail: String(s["from_email"] ?? "").trim(),
    sendCampaigns: s["send_campaigns"] === true || s["send_campaigns"] === "true",
  };
}
