import { json, type RequestHandler } from '@sveltejs/kit';

function bytesToBase64(bytes: Uint8Array): string {
	const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
	let output = '';

	for (let i = 0; i < bytes.length; i += 3) {
		const a = bytes[i] ?? 0;
		const b = bytes[i + 1] ?? 0;
		const c = bytes[i + 2] ?? 0;

		const triple = (a << 16) | (b << 8) | c;

		output += alphabet[(triple >> 18) & 0x3f];
		output += alphabet[(triple >> 12) & 0x3f];
		output += i + 1 < bytes.length ? alphabet[(triple >> 6) & 0x3f] : '=';
		output += i + 2 < bytes.length ? alphabet[triple & 0x3f] : '=';
	}

	return output;
}

function validateCookieHeader(cookieString: unknown): { cookie?: string; error?: string } {
	if (typeof cookieString !== 'string') {
		return { error: 'Cookie string is required' };
	}

	const trimmed = cookieString.trim();
	if (!trimmed) {
		return { error: 'Cookie string is required' };
	}

	if (trimmed.includes('\u2026')) {
		return {
			error:
				'Cookie string appears truncated (contains an ellipsis). Copy the full cookie from DevTools -> Network -> Request Headers.'
		};
	}

	if (/\r|\n/.test(trimmed)) {
		return { error: 'Cookie string must be a single line' };
	}

	for (let i = 0; i < trimmed.length; i++) {
		if (trimmed.charCodeAt(i) > 255) {
			return {
				error:
					'Cookie string contains unsupported Unicode characters. Copy it again from DevTools -> Network -> Request Headers.'
			};
		}
	}

	return { cookie: trimmed };
}

export const POST: RequestHandler = async ({ request }) => {
	try {
		const { url, cookieString } = await request.json();
		const cookieValidation = validateCookieHeader(cookieString);

		if (!url) {
			return json({ error: 'Missing required parameters' }, { status: 400 });
		}

		if (cookieValidation.error) {
			return json({ error: cookieValidation.error }, { status: 400 });
		}

		if (!cookieValidation.cookie) {
			return json({ error: 'Missing required parameters' }, { status: 400 });
		}

		const fullUrl = url.startsWith('/') ? `https://claude.ai${url}` : url;

		const response = await fetch(fullUrl, {
			method: 'GET',
			headers: {
				Cookie: cookieValidation.cookie,
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
		const base64 = bytesToBase64(new Uint8Array(arrayBuffer));

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
