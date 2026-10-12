import { supabase } from "./supabase-client";

// Free photo search (Pexels) through the pexels-search Edge Function
// (supabase/functions/pexels-search), so the Pexels key stays on the server.

export interface Photo {
  id: number;
  alt: string | null;
  /** The photo's page on Pexels. */
  url: string;
  photographer: string;
  photographerUrl: string;
  src: { medium: string; large2x: string };
}

export async function searchPhotos(
  query: string,
  {
    orientation = "landscape",
    perPage = 18,
  }: {
    orientation?: "landscape" | "portrait" | "square";
    perPage?: number;
  } = {},
): Promise<Photo[]> {
  const q = query.trim();
  if (!q) return [];
  const { data, error } = await supabase.functions.invoke<{
    photos?: Photo[];
    error?: string;
  }>("pexels-search", { body: { query: q, orientation, perPage } });
  if (error) {
    // A non-2xx answer arrives as a generic FunctionsHttpError whose
    // `context` is the Response, with the function's reason ({ error }) in
    // its body. Other failures (FunctionsFetchError: the request never got
    // an answer; FunctionsRelayError) carry no Response.
    const ctx = (error as { context?: unknown }).context;
    let status: number | undefined;
    let reason: string | undefined;
    if (ctx instanceof Response) {
      status = ctx.status;
      const body = (await ctx
        .clone()
        .json()
        .catch(() => null)) as { error?: string } | null;
      reason = body?.error;
    } else if (ctx instanceof Error) {
      reason = ctx.message;
    }
    const message = `${error.name}${status ? ` ${status}` : ""}: ${reason ?? error.message}`;
    console.error("Photo search failed:", message, error);
    throw new Error(message);
  }
  if (data?.error) throw new Error(data.error);
  return data?.photos ?? [];
}
