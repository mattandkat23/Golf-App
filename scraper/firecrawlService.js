import FirecrawlApp from '@mendable/firecrawl-js';

export async function fetchPageContent(url) {
  const app = new FirecrawlApp({ apiKey: process.env.FIRECRAWL_API_KEY });

  try {
    const result = await app.scrape(url, { formats: ['markdown'] });
    return result;
  } catch (error) {
    console.error(`Firecrawl scrape failed for ${url}:`, error.message);
    throw error;
  }
}
