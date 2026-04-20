import type { SearchDataObject, SortOption, ContentSearchResult, SearchResultDoc } from '../models/Search';

const KIND_MAP = { all: 1, any: 0, none: -1 } as const;

export interface SearchApiResponse {
  documents: SearchResultDoc[];
  count: number;
}

export const SearchService = {
  async search(
    searchDataObject: SearchDataObject,
    skip: number,
    take: number,
    sortOptions: SortOption[] = []
  ): Promise<SearchApiResponse> {
    const body = {
      searchTerm: searchDataObject.searchTerm,
      skip,
      take,
      kind: KIND_MAP[searchDataObject.advancedSearchOption],
      items: searchDataObject.criteria.map(c => ({
        value: c.value,
        operator: c.comparisonType,
        propertyDefinitionId: c.propertyDefinitionId,
      })),
      sortOptions,
    };

    const res = await fetch('/api/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) throw new Error('Search request failed');
    return res.json();
  },

  async searchContent(q: string): Promise<ContentSearchResult[]> {
    const res = await fetch(`/api/search-content?q=${encodeURIComponent(q)}`);
    if (!res.ok) return [];
    return res.json();
  },
};
