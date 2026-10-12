// pexels-search: free photo search for the image block and the cover
// picker, without putting the Pexels key in the browser.
//
// POST { "query": "baobab", "orientation"?: "landscape" | "portrait" | "square", "perPage"?: 1–40 }
// → { "photos": [{ id, alt, photographer, photographerUrl, url, src: { medium, large2x } }] }
//
// Secret: PEXELS_API_KEY (supabase secrets set PEXELS_API_KEY=…).

// CORS, so the browser can call this with supabase.functions.invoke().
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const ORIENTATIONS = new Set(["landscape", "portrait", "square"]);

interface PexelsPhoto {
  id: number;
  alt: string | null;
  url: string;
  photographer: string;
  photographer_url: string;
  src: { medium: string; large2x: string };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Use POST" }, 405);

  const key = Deno.env.get("PEXELS_API_KEY");
  if (!key)
    return json({ error: "Photo search isn't set up (PEXELS_API_KEY)" }, 500);

  let query = "";
  let orientation = "landscape";
  let perPage = 18;
  try {
    const body = (await req.json()) as {
      query?: string;
      orientation?: string;
      perPage?: number;
    };
    query = String(body.query ?? "")
      .trim()
      .slice(0, 100);
    if (body.orientation && ORIENTATIONS.has(body.orientation))
      orientation = body.orientation;
    if (typeof body.perPage === "number")
      perPage = Math.min(40, Math.max(1, Math.round(body.perPage)));
  } catch {
    return json({ error: "Send { query }" }, 400);
  }
  if (!query) return json({ photos: [] });

  const url =
    `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}` +
    `&per_page=${perPage}&orientation=${orientation}`;

  try {
    const res = await fetch(url, {
      headers: { Authorization: key },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return json({ error: `Pexels answered ${res.status}` }, 502);
    const data = (await res.json()) as { photos?: PexelsPhoto[] };
    return json({
      photos: (data.photos ?? []).map((p) => ({
        id: p.id,
        alt: p.alt,
        url: p.url,
        photographer: p.photographer,
        photographerUrl: p.photographer_url,
        src: { medium: p.src.medium, large2x: p.src.large2x },
      })),
    });
  } catch {
    return json({ error: "Pexels couldn't be reached" }, 502);
  }
});

// A module, not a global script (keeps the two functions separate for the type-checker).
export {};
