import axios from 'axios';
import * as cheerio from 'cheerio';
import { logger } from '../utils/logger';

export interface ScrapedDocument {
  title: string;
  content: string;
  source: string;
  url: string;
  category?: string;
  date?: string;
}

export class WebScraper {
  private userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36';

  /**
   * Scrape KALRO publications
   */
  async scrapeKALROPublications(): Promise<ScrapedDocument[]> {
    const documents: ScrapedDocument[] = [];
    
    try {
      // Scrape main publications page
      const response = await axios.get('https://www.kalro.org/publications', {
        headers: { 'User-Agent': this.userAgent },
        timeout: 15000,
        maxRedirects: 5,
      });

      const $ = cheerio.load(response.data);
      
      // Extract publication links and titles
      $('a[href*="publication"], a[href*="download"], .publication-item, .document-item').each((_, element) => {
        const $el = $(element);
        const title = $el.text().trim() || $el.attr('title') || '';
        const url = $el.attr('href') || '';
        const fullUrl = url.startsWith('http') ? url : `https://www.kalro.org${url}`;

        if (title && url) {
          documents.push({
            title,
            content: title, // Will be expanded when fetching individual pages
            source: 'KALRO',
            url: fullUrl,
            category: 'Publication',
          });
        }
      });

      // Also try to scrape crop-specific pages
      const cropPages = [
        'https://www.kalro.org/crops',
        'https://www.kalro.org/livestock',
        'https://www.kalro.org/soil-and-agronomy',
      ];

      for (const pageUrl of cropPages) {
        try {
          const pageResponse = await axios.get(pageUrl, {
            headers: { 'User-Agent': this.userAgent },
            timeout: 10000,
            maxRedirects: 5,
          });

          const $page = cheerio.load(pageResponse.data);
          
          $page('h1, h2, h3, .content, .article-content').each((_, element) => {
            const text = $page(element).text().trim();
            if (text.length > 50) {
              documents.push({
                title: $page(element).text().substring(0, 100),
                content: text,
                source: 'KALRO',
                url: pageUrl,
                category: pageUrl.includes('crops') ? 'Crops' : 
                         pageUrl.includes('livestock') ? 'Livestock' : 'Soil',
              });
            }
          });
        } catch (error) {
          logger.warn(`Could not scrape ${pageUrl}:`, error);
        }
      }

      logger.info(`Scraped ${documents.length} KALRO documents`);
      return documents;
    } catch (error: any) {
      logger.error('Error scraping KALRO:', error);
      return documents;
    }
  }

  /**
   * Scrape KNBS market prices
   */
  async scrapeKNBSMarketPrices(): Promise<ScrapedDocument[]> {
    const documents: ScrapedDocument[] = [];
    
    try {
      const response = await axios.get('https://statistics.knbs.or.ke', {
        headers: { 'User-Agent': this.userAgent },
        timeout: 15000,
        maxRedirects: 5,
      });

      const $ = cheerio.load(response.data);
      
      // Look for price tables, market data, or agricultural statistics
      $('table, .price-table, .market-data, .agricultural-stats').each((_, element) => {
        const $table = $(element);
        const rows: string[] = [];
        
        $table.find('tr').each((_, row) => {
          const cells = $(row).find('td, th').map((_, cell) => $(cell).text().trim()).get();
          if (cells.length > 0) {
            rows.push(cells.join(' | '));
          }
        });

        if (rows.length > 0) {
          documents.push({
            title: 'KNBS Market Prices',
            content: rows.join('\n'),
            source: 'KNBS',
            url: 'https://statistics.knbs.or.ke',
            category: 'Market Prices',
          });
        }
      });

      // Also extract text content that might contain price information
      $('p, .content, .statistics').each((_, element) => {
        const text = $(element).text().trim();
        if (text.length > 100 && (text.toLowerCase().includes('price') || text.toLowerCase().includes('market'))) {
          documents.push({
            title: 'KNBS Agricultural Statistics',
            content: text,
            source: 'KNBS',
            url: 'https://statistics.knbs.or.ke',
            category: 'Statistics',
          });
        }
      });

      logger.info(`Scraped ${documents.length} KNBS documents`);
      return documents;
    } catch (error: any) {
      logger.error('Error scraping KNBS:', error);
      return documents;
    }
  }

  /**
   * Scrape Ministry of Agriculture data
   */
  async scrapeMOAData(): Promise<ScrapedDocument[]> {
    const documents: ScrapedDocument[] = [];
    
    try {
      const response = await axios.get('https://kilimo.go.ke', {
        headers: { 'User-Agent': this.userAgent },
        timeout: 15000,
        maxRedirects: 5,
        validateStatus: () => true, // Accept any status
      });

      if (response.status === 200) {
        const $ = cheerio.load(response.data);
        
        // Extract main content
        $('article, .content, .main-content, h1, h2, h3').each((_, element) => {
          const text = $(element).text().trim();
          if (text.length > 100) {
            documents.push({
              title: $(element).find('h1, h2, h3').first().text().trim() || 'MOA Information',
              content: text,
              source: 'MOA',
              url: 'https://kilimo.go.ke',
              category: 'General',
            });
          }
        });
      }

      logger.info(`Scraped ${documents.length} MOA documents`);
      return documents;
    } catch (error: any) {
      logger.warn('Error scraping MOA (may have SSL issues):', error);
      return documents;
    }
  }

  /**
   * Scrape all sources
   */
  async scrapeAll(): Promise<ScrapedDocument[]> {
    const allDocuments: ScrapedDocument[] = [];

    logger.info('Starting web scraping for all sources...');

    // Scrape in parallel
    const [kalroDocs, knbsDocs, moaDocs] = await Promise.all([
      this.scrapeKALROPublications(),
      this.scrapeKNBSMarketPrices(),
      this.scrapeMOAData(),
    ]);

    allDocuments.push(...kalroDocs, ...knbsDocs, ...moaDocs);

    logger.info(`Total scraped documents: ${allDocuments.length}`);
    return allDocuments;
  }

  /**
   * Format scraped documents for ingestion
   */
  formatForIngestion(documents: ScrapedDocument[]): string[] {
    return documents.map(doc => {
      return `Title: ${doc.title}\nSource: ${doc.source}\nCategory: ${doc.category || 'General'}\nURL: ${doc.url}\n\nContent:\n${doc.content}`;
    });
  }
}

export const webScraper = new WebScraper();

