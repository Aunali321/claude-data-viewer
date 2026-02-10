import { json, type RequestHandler } from "@sveltejs/kit";

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
      const text = await response.text();
      return json(
        { error: `Failed to fetch conversation: HTTP ${response.status} - ${text.slice(0, 200)}` },
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
