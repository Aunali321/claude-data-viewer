import { json, type RequestHandler } from "@sveltejs/kit";

function getResponseErrorMessage(status: number, body: unknown): string {
  if (
    status === 403 &&
    typeof body === "object" &&
    body !== null &&
    "error" in body &&
    typeof (body as { error?: unknown }).error === "object" &&
    (body as { error: { message?: unknown } }).error !== null
  ) {
    const message = (body as { error: { message?: unknown } }).error.message;
    if (
      typeof message === "string" &&
      message.includes("Free users can only access their 5 most recently updated projects")
    ) {
      return "Claude returned a permission error: free accounts can only access the 5 most recently updated projects when fetching conversation details.";
    }
  }

  if (
    typeof body === "object" &&
    body !== null &&
    "error" in body &&
    typeof (body as { error?: unknown }).error === "object" &&
    (body as { error: { message?: unknown } }).error !== null
  ) {
    const message = (body as { error: { message?: unknown } }).error.message;
    if (typeof message === "string" && message.trim()) {
      return message;
    }
  }

  if (typeof body === "string" && body.trim()) {
    return body.slice(0, 200);
  }

  return `HTTP ${status}`;
}

export const POST: RequestHandler = async ({ request }) => {
  try {
    const { conversationUuid, organizationId, cookieString } =
      await request.json();

    if (!conversationUuid || !organizationId || !cookieString) {
      return json({ error: "Missing required parameters" }, { status: 400 });
    }

    const url = `https://claude.ai/api/organizations/${organizationId}/chat_conversations/${conversationUuid}?tree=True&rendering_mode=messages&render_all_tools=true&consistency=eventual`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Cookie": cookieString,
        "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "application/json",
        "Accept-Language": "en-US,en;q=0.9",
        "Referer": "https://claude.ai/",
        "Sec-Fetch-Dest": "empty",
        "Sec-Fetch-Mode": "cors",
        "Sec-Fetch-Site": "same-origin"
      },
    });

    if (!response.ok) {
      const contentType = response.headers.get("content-type") || "";
      const responseBody = contentType.includes("application/json")
        ? await response.json()
        : await response.text();
      const message = getResponseErrorMessage(response.status, responseBody);

      return json(
        { error: `Failed to fetch conversation: ${message}` },
        { status: response.status },
      );
    }

    const data = await response.json();
    return json(data);
  } catch (error) {
    return json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
};
