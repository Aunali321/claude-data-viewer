import { json, type RequestHandler } from '@sveltejs/kit';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const { url, cookieString } = await request.json();

		if (!url || !cookieString) {
			return json({ error: 'Missing required parameters' }, { status: 400 });
		}

		const fullUrl = url.startsWith('/') ? `https://claude.ai${url}` : url;

		const response = await fetch(fullUrl, {
			method: 'GET',
			headers: {
				Cookie: cookieString,
				'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
				'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
				'Accept-Language': 'en-US,en;q=0.9',
				'Referer': 'https://claude.ai/',
				'Sec-Fetch-Dest': 'image',
				'Sec-Fetch-Mode': 'no-cors',
				'Sec-Fetch-Site': 'same-origin'
			}
		});

		if (!response.ok) {
			const text = await response.text();
			return json(
				{ error: `Failed to fetch: HTTP ${response.status} - ${text.slice(0, 200)}` },
				{ status: response.status }
			);
		}

		const contentType = response.headers.get('content-type') || 'image/png';
		const arrayBuffer = await response.arrayBuffer();
		const base64 = Buffer.from(arrayBuffer).toString('base64');

		return json({
			data: base64,
			mimeType: contentType
		});
	} catch (error) {
		return json(
			{ error: error instanceof Error ? error.message : 'Unknown error' },
			{ status: 500 }
		);
	}
};
