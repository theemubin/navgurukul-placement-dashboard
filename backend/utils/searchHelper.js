const axios = require('axios');
const cheerio = require('cheerio');

async function searchWeb(query, limit = 5, customSearch = {}) {
    const hasApiKey = !!(customSearch.apiKey && customSearch.apiKey.trim());
    const hasCseId = !!(customSearch.cseId && customSearch.cseId.trim());
    const maskedKey = hasApiKey ? customSearch.apiKey.slice(0, 6) + '…' : '(none)';
    const maskedCse = hasCseId ? customSearch.cseId.slice(0, 8) + '…' : '(none)';

    console.log(`[searchWeb] ─── query: "${query}"`);
    console.log(`[searchWeb]     mode : ${hasApiKey && hasCseId ? '✅ Google CSE API' : '⚠️  scraping fallback'}`);
    console.log(`[searchWeb]     apiKey: ${maskedKey}  |  cseId: ${maskedCse}`);

    try {
        // if customSearch config is provided, use Google Custom Search API
        if (hasApiKey && hasCseId) {
            const url = `https://www.googleapis.com/customsearch/v1?key=${encodeURIComponent(customSearch.apiKey)}&cx=${encodeURIComponent(customSearch.cseId)}&q=${encodeURIComponent(query)}&num=${limit}`;
            try {
                const response = await axios.get(url);
                const items = response.data.items || [];

                if (items.length > 0) {
                    console.log(`[searchWeb] ✅ CSE SUCCESS: Found ${items.length} items for "${query}"`);
                    return items.map(item => ({
                        title: item.title,
                        link: item.link,
                        snippet: item.snippet || '',
                        method: 'google_cse'
                    }));
                } else {
                    console.warn(`[searchWeb] ⚠️  CSE EMPTY: 0 items for "${query}". Check your CSE 'cx' settings or search terms.`);
                    if (response.data.searchInformation) {
                        console.log(`[searchWeb] DEBUG: Total results reported by Google: ${response.data.searchInformation.totalResults}`);
                    }
                }
            } catch (err) {
                const errorData = err.response?.data?.error;
                console.error(`[searchWeb] ❌ CSE API ERROR:`, {
                    status: err.response?.status,
                    message: errorData?.message || err.message,
                    reason: errorData?.errors?.[0]?.reason
                });
            }
        }

        // scraping fallback
        console.log(`[searchWeb] 🔍 SCRAPING FALLBACK: Searching for "${query}" using direct request...`);
        const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
        const response = await axios.get(searchUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
            },
            timeout: 10000
        });

        const $ = cheerio.load(response.data);
        const results = [];

        // Try multiple selectors as Google search result layout varies
        const containers = $('div.g, div.sr_item, div.MjjYud, .Gx5S9e');

        containers.each((i, element) => {
            if (results.length >= limit) return false;

            const title = $(element).find('h3').first().text();
            let link = $(element).find('a').first().attr('href');

            // Handle Google redirect links and direct links
            if (link && link.startsWith('/url?q=')) {
                try {
                    const urlObj = new URL('https://www.google.com' + link);
                    link = urlObj.searchParams.get('q');
                } catch (e) { }
            }

            // Expanded snippet selectors for modern Google layouts
            const snippet = $(element).find('.VwiC3b, .yU79Yd, .H3uY3, div[style*="-webkit-line-clamp"]').text();

            if (title && link && link.startsWith('http') && !link.includes('google.com')) {
                results.push({ title, link, snippet: (snippet || '').substring(0, 300), method: 'scraping' });
            }
        });

        console.log(`[searchWeb] 🔍 SCRAPE RESULT: Found ${results.length} result(s)`);
        return results;
    } catch (error) {
        console.error('Search error:', error.message);
        return [];
    }
}

module.exports = { searchWeb };
