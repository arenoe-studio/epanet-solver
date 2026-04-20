export async function parseJsonResponse(res: Response): Promise<{
  text: string;
  json: Record<string, unknown> | null;
}> {
  const text = await res.text();
  if (!text) {
    return { text: "", json: null };
  }

  try {
    const parsed = JSON.parse(text) as unknown;
    return {
      text,
      json:
        parsed && typeof parsed === "object" && !Array.isArray(parsed)
          ? (parsed as Record<string, unknown>)
          : null
    };
  } catch {
    return { text, json: null };
  }
}
