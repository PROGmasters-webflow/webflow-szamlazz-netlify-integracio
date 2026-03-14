import type { Context } from "@netlify/functions";

// ── Típusok ──────────────────────────────────────────────────────────────────

interface SzamlaItem {
  megnevezes: string;
  azonosito?: string;
  mennyiseg: number;
  mennyisegiEgyseg: string;
  nettoEgysegar: number;
  afakulcs: string;
  nettoErtek: number;
  afaErtek: number;
  bruttoErtek: number;
  megjegyzes?: string;
}

interface SzamlaRequest {
  vezeteknev: string;
  keresztnev: string;
  email: string;
  irsz: string;
  telepules: string;
  cim: string;
  orszag: string;
  cegnev?: string;
  adoszam?: string;
  bankszamlaszam?: string;
  megye?: string;
  telefonszam?: string;
  rendelesSzam?: string;
  szamlaszamElotag?: string;
  items?: SzamlaItem[];
}

// ── Segédfüggvények ──────────────────────────────────────────────────────────

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function addDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function env(key: string, fallback = ""): string {
  return process.env[key] ?? fallback;
}

function getAllowedOrigins(): string[] {
  const raw = env("ALLOWED_ORIGINS");
  if (!raw) return [];
  return raw.split(",").map((s) => s.trim()).filter(Boolean);
}

function getCorsOrigin(requestOrigin: string | null): string | null {
  const allowed = getAllowedOrigins();
  if (allowed.length === 0) return null;
  if (requestOrigin && allowed.includes(requestOrigin)) return requestOrigin;
  return null;
}

function corsHeaders(origin: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
  if (origin) {
    headers["Access-Control-Allow-Origin"] = origin;
  }
  return headers;
}

// ── XML összerakás ───────────────────────────────────────────────────────────

function buildItemsXml(items: SzamlaItem[]): string {
  return items
    .map(
      (item) => `    <tetel>
      <megnevezes>${escapeXml(item.megnevezes)}</megnevezes>${item.azonosito ? `\n      <azonosito>${escapeXml(item.azonosito)}</azonosito>` : ""}
      <mennyiseg>${item.mennyiseg}</mennyiseg>
      <mennyisegiEgyseg>${escapeXml(item.mennyisegiEgyseg)}</mennyisegiEgyseg>
      <nettoEgysegar>${item.nettoEgysegar}</nettoEgysegar>
      <afakulcs>${escapeXml(item.afakulcs)}</afakulcs>
      <nettoErtek>${item.nettoErtek}</nettoErtek>
      <afaErtek>${item.afaErtek}</afaErtek>
      <bruttoErtek>${item.bruttoErtek}</bruttoErtek>${item.megjegyzes ? `\n      <megjegyzes>${escapeXml(item.megjegyzes)}</megjegyzes>` : ""}
    </tetel>`
    )
    .join("\n");
}

function buildXml(data: SzamlaRequest, items: SzamlaItem[]): string {
  const apiKey = env("SZAMLAAGENT_KULCS");
  const fizmod = env("FIZMOD", "Átutalás");
  const penznem = env("PENZNEM", "HUF");
  const nyelv = env("SZAMLA_NYELVE", "hu");
  const elotag = data.szamlaszamElotag || env("SZAMLASZAM_ELOTAG");
  const dueDays = parseInt(env("PAYMENT_DUE_DAYS", "8"), 10);

  const vevoNev = data.cegnev || `${data.vezeteknev} ${data.keresztnev}`;
  const megjegyzes = data.megye ? `Megye: ${data.megye}` : "";
  const rendelesSzam = data.rendelesSzam || "";

  return `<?xml version="1.0" encoding="UTF-8"?>
<xmlszamla xmlns="http://www.szamlazz.hu/xmlszamla" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.szamlazz.hu/xmlszamla https://www.szamlazz.hu/szamla/docs/xsds/agent/xmlszamla.xsd">
  <beallitasok>
    <szamlaagentkulcs>${escapeXml(apiKey)}</szamlaagentkulcs>
    <eszamla>true</eszamla>
    <szamlaLetoltes>false</szamlaLetoltes>
    <valaszVerzio>2</valaszVerzio>
  </beallitasok>
  <fejlec>
    <keltDatum>${today()}</keltDatum>
    <teljesitesDatum>${today()}</teljesitesDatum>
    <fizetesiHataridoDatum>${addDays(dueDays)}</fizetesiHataridoDatum>
    <fizmod>${escapeXml(fizmod)}</fizmod>
    <penznem>${escapeXml(penznem)}</penznem>
    <szamlaNyelve>${escapeXml(nyelv)}</szamlaNyelve>${megjegyzes ? `\n    <megjegyzes>${escapeXml(megjegyzes)}</megjegyzes>` : ""}${rendelesSzam ? `\n    <rendelesSzam>${escapeXml(rendelesSzam)}</rendelesSzam>` : ""}${elotag ? `\n    <szamlaszamElotag>${escapeXml(elotag)}</szamlaszamElotag>` : ""}
  </fejlec>
  <elado>
    <bank>${escapeXml(env("ELADO_BANK", "OTP Bank"))}</bank>
    <bankszamlaszam>${escapeXml(env("ELADO_BANKSZAMLASZAM"))}</bankszamlaszam>
    <emailReplyto>${escapeXml(env("ELADO_EMAIL_REPLYTO"))}</emailReplyto>
    <emailTargy>${escapeXml(env("ELADO_EMAIL_TARGY", "Számla értesítő"))}</emailTargy>
    <emailSzoveg>${escapeXml(env("ELADO_EMAIL_SZOVEG", "Mellékletben találja a számlát."))}</emailSzoveg>
  </elado>
  <vevo>
    <nev>${escapeXml(vevoNev)}</nev>
    <orszag>${escapeXml(data.orszag)}</orszag>
    <irsz>${escapeXml(data.irsz)}</irsz>
    <telepules>${escapeXml(data.telepules)}</telepules>
    <cim>${escapeXml(data.cim)}</cim>
    <email>${escapeXml(data.email)}</email>
    <sendEmail>true</sendEmail>${data.adoszam ? `\n    <adoszam>${escapeXml(data.adoszam)}</adoszam>` : ""}${data.telefonszam ? `\n    <telefonszam>${escapeXml(data.telefonszam)}</telefonszam>` : ""}
  </vevo>
  <tetelek>
${buildItemsXml(items)}
  </tetelek>
</xmlszamla>`;
}

// ── XML válasz parse ─────────────────────────────────────────────────────────

function extractXmlTag(xml: string, tag: string): string {
  const regex = new RegExp(`<${tag}>([^<]*)</${tag}>`);
  const match = xml.match(regex);
  return match ? match[1] : "";
}

// ── Multipart POST builder ───────────────────────────────────────────────────

function buildMultipartBody(xmlContent: string): { body: Uint8Array; contentType: string } {
  const boundary = "----SzamlaAgentBoundary" + Date.now();
  const encoder = new TextEncoder();

  const parts: string[] = [
    `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="action-xmlagentxmlfile"; filename="xmlszamla.xml"\r\n` +
      `Content-Type: text/xml\r\n\r\n` +
      xmlContent +
      `\r\n`,
    `--${boundary}--\r\n`,
  ];

  const body = encoder.encode(parts.join(""));
  const contentType = `multipart/form-data; boundary=${boundary}`;

  return { body, contentType };
}

// ── Fő handler ───────────────────────────────────────────────────────────────

export default async function handler(req: Request, _context: Context): Promise<Response> {
  const origin = req.headers.get("Origin");
  const allowedOrigin = getCorsOrigin(origin);
  const headers = corsHeaders(allowedOrigin);

  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Csak POST metódus engedélyezett" }),
      { status: 405, headers: { ...headers, "Content-Type": "application/json" } }
    );
  }

  // ── JSON parse ───────────────────────────────────────────────────────

  let body: SzamlaRequest;
  try {
    body = (await req.json()) as SzamlaRequest;
  } catch {
    return new Response(
      JSON.stringify({ error: "Érvénytelen JSON a kérésben" }),
      { status: 400, headers: { ...headers, "Content-Type": "application/json" } }
    );
  }

  // ── Kötelező mezők validáció ──────────────────────────────────────────

  const requiredFields: (keyof SzamlaRequest)[] = [
    "vezeteknev",
    "keresztnev",
    "email",
    "irsz",
    "telepules",
    "cim",
    "orszag",
  ];
  const missing = requiredFields.filter(
    (f) => !body[f] || (typeof body[f] === "string" && !(body[f] as string).trim())
  );

  if (missing.length > 0) {
    return new Response(
      JSON.stringify({ error: `Hiányzó kötelező mezők: ${missing.join(", ")}` }),
      { status: 422, headers: { ...headers, "Content-Type": "application/json" } }
    );
  }

  // ── Items (tételek) ──────────────────────────────────────────────────

  let items: SzamlaItem[];

  if (body.items && body.items.length > 0) {
    items = body.items;
  } else {
    // Default items from env
    const defaultItemsRaw = env("NETLIFY_DEFAULT_ITEMS");
    if (defaultItemsRaw) {
      try {
        items = JSON.parse(defaultItemsRaw) as SzamlaItem[];
      } catch {
        return new Response(
          JSON.stringify({ error: "NETLIFY_DEFAULT_ITEMS környezeti változó érvénytelen JSON" }),
          { status: 500, headers: { ...headers, "Content-Type": "application/json" } }
        );
      }
    } else {
      return new Response(
        JSON.stringify({ error: "Nincsenek tételek megadva és NETLIFY_DEFAULT_ITEMS sincs beállítva" }),
        { status: 422, headers: { ...headers, "Content-Type": "application/json" } }
      );
    }
  }

  // ── XML összerakás ───────────────────────────────────────────────────

  const xml = buildXml(body, items);
  console.log("── Kimenő XML ──────────────────────────────────────");
  console.log(xml);

  // ── Multipart POST a Számlázz.hu felé ────────────────────────────────

  const { body: multipartBody, contentType } = buildMultipartBody(xml);

  const requestHeaders = { "Content-Type": contentType };
  console.log("── Request headers ─────────────────────────────────");
  console.log(JSON.stringify(requestHeaders, null, 2));

  let szamlaResponse: Response;
  try {
    szamlaResponse = await fetch("https://www.szamlazz.hu/szamla/", {
      method: "POST",
      headers: requestHeaders,
      body: multipartBody,
    });
  } catch (err) {
    console.error("Számlázz.hu hálózati hiba:", err);
    return new Response(
      JSON.stringify({ error: "Nem sikerült elérni a számlázz.hu szerverét", detail: String(err) }),
      { status: 502, headers: { ...headers, "Content-Type": "application/json" } }
    );
  }

  // ── Válasz feldolgozás ───────────────────────────────────────────────

  const responseText = await szamlaResponse.text();
  console.log("── Response HTTP status ─────────────────────────────");
  console.log(szamlaResponse.status);
  console.log("── Response headers ─────────────────────────────────");
  const respHeaders: Record<string, string> = {};
  szamlaResponse.headers.forEach((value, key) => { respHeaders[key] = value; });
  console.log(JSON.stringify(respHeaders, null, 2));
  console.log("── Response body ────────────────────────────────────");
  console.log(responseText);

  // Headers-ből kiolvasás (elsődleges forrás)
  const headerVevoUrl = szamlaResponse.headers.get("szlahu_vevoifiokurl") ?? "";
  const headerError = szamlaResponse.headers.get("szlahu_error") ?? "";
  const headerErrorCode = szamlaResponse.headers.get("szlahu_error_code") ?? "";

  // XML válaszból kiolvasás (fallback)
  const xmlSikeres = extractXmlTag(responseText, "sikeres");
  const xmlVevoUrl = extractXmlTag(responseText, "vevoifiokurl");
  const xmlHibakod = extractXmlTag(responseText, "hibakod");
  const xmlHibauzenet = extractXmlTag(responseText, "hibauzenet");

  // Sikeres-e?
  const sikeres = xmlSikeres === "true" || (szamlaResponse.ok && !headerError && !xmlHibakod);
  const vevoifiokurl = headerVevoUrl || xmlVevoUrl;

  if (sikeres && vevoifiokurl) {
    return new Response(
      JSON.stringify({ sikeres: true, vevoifiokurl }),
      { status: 200, headers: { ...headers, "Content-Type": "application/json" } }
    );
  }

  // Hiba
  const hibakod = xmlHibakod || headerErrorCode;
  const hibauzenet = xmlHibauzenet || headerError || "Ismeretlen hiba a számlázz.hu-tól";

  console.error("Számlázz.hu hiba:", { hibakod, hibauzenet });

  return new Response(
    JSON.stringify({ sikeres: false, hibakod, hibauzenet }),
    { status: 422, headers: { ...headers, "Content-Type": "application/json" } }
  );
}
