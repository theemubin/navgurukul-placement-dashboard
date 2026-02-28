const axios = require('axios');
const cheerio = require('cheerio');

async function searchWeb(query, limit = 5) {
    try {
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

        // Google search result selector often changes, this is a common one
        $('div.g').each((i, element) => {
            if (results.length >= limit) return false;

            const title = $(element).find('h3').text();
            const link = $(element).find('a').attr('href');
            const snippet = $(element).find('div.VwiC3b').text() || $(element).find('div[style*="-webkit-line-clamp"]').text();

            if (title && link && link.startsWith('http')) {
                results.push({ title, link, snippet });
            }
        });

        return results;
    } catch (error) {
        console.error('Search error:', error.message);
        return [];
    }
}

module.exports = { searchWeb };
