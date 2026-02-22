export interface SearchResult {
  id: string;
  title: string;
  type: string;
  matchScore: number;
}

export class SearchIndex {
  private index: Map<string, Set<string>>;
  private products: Map<string, any>;

  constructor(products: any[]) {
    this.index = new Map();
    this.products = new Map();
    this.buildIndex(products);
  }

  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(token => token.length > 2); // Ignore short words
  }

  private buildIndex(products: any[]) {
    products.forEach(product => {
      this.products.set(product.id, product);

      const tokens = [
        ...this.tokenize(product.title),
        ...this.tokenize(product.type),
        ...this.tokenize(product.tag || '')
      ];

      tokens.forEach(token => {
        if (!this.index.has(token)) {
          this.index.set(token, new Set());
        }
        this.index.get(token)?.add(product.id);
      });
    });
  }

  search(query: string): any[] {
    const tokens = this.tokenize(query);
    if (tokens.length === 0) return [];

    const matches = new Map<string, number>();

    tokens.forEach(token => {
      // Exact match - O(1)
      const exactMatches = this.index.get(token);
      if (exactMatches) {
        exactMatches.forEach(id => {
          matches.set(id, (matches.get(id) || 0) + 10);
        });
      }

      // Partial match (prefix) - O(K) where K is number of unique tokens
      for (const [key, ids] of this.index.entries()) {
        if (key !== token && key.startsWith(token)) {
          ids.forEach(id => {
            matches.set(id, (matches.get(id) || 0) + 5);
          });
        }
      }
    });

    return Array.from(matches.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([id]) => this.products.get(id));
  }
}
