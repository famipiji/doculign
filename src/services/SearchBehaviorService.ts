import type { SearchResultDoc } from '../models/Search';

type Listener = (docs: SearchResultDoc[], page: number, totalPages: number) => void;

const PAGE_SIZE = 10;

class SearchBehaviorServiceClass {
  private _cachedDocs: SearchResultDoc[] = [];
  private _currentPage = 0;
  private _listeners: Listener[] = [];

  subscribe(listener: Listener): () => void {
    this._listeners.push(listener);
    // emit current state immediately to new subscriber
    this._emit();
    return () => {
      this._listeners = this._listeners.filter(l => l !== listener);
    };
  }

  setCachedSearch(docs: SearchResultDoc[]) {
    this._cachedDocs = docs;
    this._currentPage = 0;
    this._emit();
  }

  goToPage(page: number) {
    const total = Math.ceil(this._cachedDocs.length / PAGE_SIZE);
    this._currentPage = Math.max(0, Math.min(page, total - 1));
    this._emit();
  }

  get pageSize() { return PAGE_SIZE; }
  get totalDocs() { return this._cachedDocs.length; }
  get currentPage() { return this._currentPage; }

  private _emit() {
    const start = this._currentPage * PAGE_SIZE;
    const slice = this._cachedDocs.slice(start, start + PAGE_SIZE);
    const totalPages = Math.ceil(this._cachedDocs.length / PAGE_SIZE);
    this._listeners.forEach(l => l(slice, this._currentPage, totalPages));
  }
}

export const SearchBehaviorService = new SearchBehaviorServiceClass();
