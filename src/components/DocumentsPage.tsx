import React, { useState } from 'react';
import { Plus, ChevronRight, Search, X, SlidersHorizontal, Filter } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { SearchService } from '../services/SearchService';
import { SearchBehaviorService } from '../services/SearchBehaviorService';
import { ResultTable } from './ResultTable';
import {
  PROPERTY_DEFINITIONS,
  OPERATORS_BY_TYPE,
  type ICriteria,
  type AdvancedSearchOption,
  type ComparisonType,
} from '../models/Search';

let _criteriaId = 0;

interface CriteriaRow extends ICriteria {
  _id: number;
}

export const DocumentsPage: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [criteria, setCriteria] = useState<CriteriaRow[]>([]);
  const [searchOption, setSearchOption] = useState<AdvancedSearchOption>('all');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const addCriteria = () => {
    const first = PROPERTY_DEFINITIONS[0];
    const firstOp = OPERATORS_BY_TYPE[first.valueType][0];
    setCriteria(prev => [...prev, {
      _id: _criteriaId++,
      propertyDefinitionId: first.id,
      comparisonType: firstOp.value,
      value: '',
      valueType: first.valueType,
    }]);
  };

  const removeCriteria = (id: number) =>
    setCriteria(prev => prev.filter(c => c._id !== id));

  const updateCriteria = (id: number, changes: Partial<CriteriaRow>) =>
    setCriteria(prev => prev.map(c => c._id === id ? { ...c, ...changes } : c));

  const onPropertyChange = (id: number, propertyId: string) => {
    const prop = PROPERTY_DEFINITIONS.find(p => p.id === propertyId)!;
    const firstOp = OPERATORS_BY_TYPE[prop.valueType][0];
    updateCriteria(id, {
      propertyDefinitionId: propertyId,
      valueType: prop.valueType,
      comparisonType: firstOp.value,
      value: '',
    });
  };

  const handleSearch = async () => {
    if (!searchTerm.trim() && criteria.length === 0) return;
    setLoading(true);
    setError(null);

    try {
      const searchDataObject = { searchTerm, criteria, advancedSearchOption: searchOption };

      // Run both in parallel — forkJoin equivalent
      const [structuredRes, contentRes] = await Promise.all([
        SearchService.search(searchDataObject, 0, 1000),
        SearchService.searchContent(searchTerm),
      ]);

      // Build a map from content results
      const contentMap = new Map(contentRes.map(c => [c.id, c]));

      // Merge: attach snippet + matchCount to structured results
      const merged = structuredRes.documents.map(doc => ({
        ...doc,
        snippet: contentMap.get(doc.id)?.snippet,
        matchCount: contentMap.get(doc.id)?.matchCount ?? 0,
      }));

      // Add content-only results not in structured (in case ES found extras)
      contentRes.forEach(c => {
        if (!merged.find(d => d.id === c.id)) {
          merged.push({
            id: c.id, name: c.name, author: '', fileType: '', recordType: '',
            fileSizeBytes: 0, createdAt: '', updatedAt: '',
            snippet: c.snippet, matchCount: c.matchCount,
          });
        }
      });

      // Sort by matchCount descending, then by name
      merged.sort((a, b) => (b.matchCount ?? 0) - (a.matchCount ?? 0));

      SearchBehaviorService.setCachedSearch(merged);
      setHasSearched(true);
    } catch {
      setError('Search failed — is the backend running?');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch();
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-white">
      {/* Header */}
      <div className="px-8 py-4 border-b border-border bg-white sticky top-0 z-10">
        <div className="flex items-center gap-2 text-[10px] uppercase font-bold text-text-muted mb-4 tracking-widest">
          <span>Home</span><ChevronRight size={10} /><span>Repository</span><ChevronRight size={10} />
          <span className="text-primary">Search</span>
        </div>
        <div className="flex justify-between items-end">
          <div>
            <h1 className="text-3xl font-extrabold text-primary tracking-tight">Repository Search</h1>
            <p className="text-sm text-text-muted mt-1">Search by file name, metadata fields, or text content inside files.</p>
          </div>
          <button
            onClick={() => navigate('/new-document')}
            className="px-5 py-2.5 bg-primary text-white text-sm font-bold rounded-lg flex items-center gap-2 shadow-sm hover:bg-primary-dark transition-all"
          >
            <Plus size={16} /> New Record
          </button>
        </div>
      </div>

      {/* Search Panel */}
      <div className="px-8 py-5 border-b border-border bg-gray-50/50 shrink-0 space-y-4">

        {/* Main search bar */}
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted" size={16} />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search by name, author, or any keyword inside the file..."
              className="w-full bg-white border border-border rounded-xl py-3 pl-11 pr-4 text-sm focus:outline-none focus:border-accent transition-all shadow-sm"
              autoFocus
            />
          </div>
          <button
            onClick={() => setShowAdvanced(v => !v)}
            className={`flex items-center gap-2 px-4 py-3 border rounded-xl text-sm font-bold transition-all ${showAdvanced ? 'bg-primary text-white border-primary' : 'border-border text-text-muted hover:bg-bg'}`}
          >
            <SlidersHorizontal size={16} />
            Filters
          </button>
          <button
            onClick={handleSearch}
            disabled={loading}
            className="px-6 py-3 bg-primary text-white text-sm font-bold rounded-xl hover:bg-primary-dark transition-all disabled:opacity-50 flex items-center gap-2 shadow-sm"
          >
            {loading
              ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              : <Search size={16} />}
            Search
          </button>
        </div>

        {/* Advanced filters panel */}
        {showAdvanced && (
          <div className="bg-white border border-border rounded-xl p-5 space-y-4">
            {/* AND / OR / NONE toggle */}
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-text-muted uppercase tracking-widest">Match:</span>
              {(['all', 'any', 'none'] as AdvancedSearchOption[]).map(opt => (
                <button
                  key={opt}
                  onClick={() => setSearchOption(opt)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-widest transition-all ${searchOption === opt ? 'bg-primary text-white' : 'border border-border text-text-muted hover:bg-bg'}`}
                >
                  {opt === 'all' ? 'ALL (AND)' : opt === 'any' ? 'ANY (OR)' : 'NONE'}
                </button>
              ))}
              <button
                onClick={addCriteria}
                className="ml-auto flex items-center gap-1.5 text-xs font-bold text-accent hover:underline"
              >
                <Plus size={14} /> Add Filter
              </button>
            </div>

            {/* Criteria rows */}
            {criteria.map(row => {
              const prop = PROPERTY_DEFINITIONS.find(p => p.id === row.propertyDefinitionId)!;
              const ops = OPERATORS_BY_TYPE[row.valueType];
              const isEmptyOp = row.comparisonType === 5;

              return (
                <div key={row._id} className="flex items-center gap-3">
                  {/* Property selector */}
                  <select
                    value={row.propertyDefinitionId}
                    onChange={e => onPropertyChange(row._id, e.target.value)}
                    className="border border-border rounded-lg px-3 py-2 text-xs bg-bg focus:outline-none focus:border-accent"
                  >
                    {PROPERTY_DEFINITIONS.map(p => (
                      <option key={p.id} value={p.id}>{p.label}</option>
                    ))}
                  </select>

                  {/* Operator selector */}
                  <select
                    value={row.comparisonType}
                    onChange={e => updateCriteria(row._id, { comparisonType: Number(e.target.value) as ComparisonType })}
                    className="border border-border rounded-lg px-3 py-2 text-xs bg-bg focus:outline-none focus:border-accent"
                  >
                    {ops.map(op => (
                      <option key={op.value} value={op.value}>{op.label}</option>
                    ))}
                  </select>

                  {/* Value input */}
                  {!isEmptyOp && (
                    row.valueType === 'dateTime' ? (
                      <input
                        type="date"
                        value={row.value}
                        onChange={e => updateCriteria(row._id, { value: e.target.value })}
                        className="border border-border rounded-lg px-3 py-2 text-xs bg-bg focus:outline-none focus:border-accent"
                      />
                    ) : row.valueType === 'boolean' ? (
                      <select
                        value={row.value}
                        onChange={e => updateCriteria(row._id, { value: e.target.value })}
                        className="border border-border rounded-lg px-3 py-2 text-xs bg-bg focus:outline-none focus:border-accent"
                      >
                        <option value="true">True</option>
                        <option value="false">False</option>
                      </select>
                    ) : (
                      <input
                        type={row.valueType === 'integer' || row.valueType === 'decimal' ? 'number' : 'text'}
                        value={row.value}
                        onChange={e => updateCriteria(row._id, { value: e.target.value })}
                        placeholder="Value..."
                        className="flex-1 border border-border rounded-lg px-3 py-2 text-xs bg-bg focus:outline-none focus:border-accent"
                      />
                    )
                  )}

                  <button onClick={() => removeCriteria(row._id)} className="text-text-muted hover:text-red-500 transition-colors">
                    <X size={16} />
                  </button>
                </div>
              );
            })}

            {criteria.length === 0 && (
              <p className="text-xs text-text-muted italic">No filters added. Click "Add Filter" to narrow results by specific fields.</p>
            )}
          </div>
        )}

        {/* Error */}
        {error && <p className="text-xs font-bold text-red-500">{error}</p>}
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto">
        {!hasSearched && !loading ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-text-muted">
            <Filter size={48} className="opacity-20" />
            <div className="text-center">
              <p className="text-sm font-bold uppercase tracking-widest">Search the Vault</p>
              <p className="text-xs mt-1 opacity-70">Use the search bar above, or add filters for precise results</p>
            </div>
          </div>
        ) : loading ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-text-muted">
            <div className="w-8 h-8 border-4 border-accent/20 border-t-accent rounded-full animate-spin" />
            <p className="text-xs font-bold uppercase tracking-widest">Searching...</p>
          </div>
        ) : (
          <ResultTable />
        )}
      </div>
    </div>
  );
};
