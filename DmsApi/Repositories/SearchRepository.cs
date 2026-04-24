using Microsoft.EntityFrameworkCore;
using DmsApi.Data;
using DmsApi.Models;
using Elastic.Clients.Elasticsearch;
using System.Text.Json;
using EsSearchRequest = Elastic.Clients.Elasticsearch.SearchRequest;

namespace DmsApi.Repositories
{
    public class SearchRepository
    {
        private readonly AppDbContext _context;
        private readonly ElasticsearchClient _elastic;
        private const string IndexName = "doculign_documents";

        public SearchRepository(AppDbContext context, ElasticsearchClient elastic)
        {
            _context = context;
            _elastic = elastic;
        }

        public async Task<(List<Document> documents, int count)> SearchAsync(DmsApi.Models.SearchRequest request)
        {
            // Text search: try Elasticsearch first, fall back to PostgreSQL ILIKE
            if (!string.IsNullOrWhiteSpace(request.SearchTerm))
            {
                var ids = await GetElasticsearchIds(request.SearchTerm);
                List<Document> candidates;

                if (ids.Count > 0)
                {
                    candidates = await _context.Documents
                        .Where(d => ids.Contains(d.Id))
                        .ToListAsync();
                }
                else
                {
                    var term = request.SearchTerm.ToLower();
                    candidates = await _context.Documents
                        .Where(d => d.Name.ToLower().Contains(term)
                                 || d.Author.ToLower().Contains(term)
                                 || d.RecordType.ToLower().Contains(term)
                                 || d.FileType.ToLower().Contains(term))
                        .ToListAsync();
                }

                if (request.Items.Any())
                    candidates = request.Kind == 1
                        ? AndOperator(candidates, request.Items)
                        : OrOperator(candidates, request.Items);

                candidates = ApplyOrder(candidates, request.SortOptions);
                return (candidates.Skip(request.Skip).Take(request.Take).ToList(), candidates.Count);
            }

            // Criteria-only search: push simple filters to SQL, paginate at DB level
            IQueryable<Document> query = _context.Documents;

            if (request.Items.Any())
            {
                var (sqlItems, memItems) = PartitionCriteria(request.Items);
                query = ApplySqlFilters(query, sqlItems);

                if (memItems.Any())
                {
                    var allDocs = await query.ToListAsync();
                    allDocs = request.Kind == 1
                        ? AndOperator(allDocs, memItems)
                        : OrOperator(allDocs, memItems);
                    allDocs = ApplyOrder(allDocs, request.SortOptions);
                    return (allDocs.Skip(request.Skip).Take(request.Take).ToList(), allDocs.Count);
                }
            }

            var count = await query.CountAsync();
            query = ApplyOrderToQuery(query, request.SortOptions);
            var docs = await query.Skip(request.Skip).Take(request.Take).ToListAsync();
            return (docs, count);
        }

        private async Task<List<int>> GetElasticsearchIds(string searchTerm)
        {
            try
            {
                var response = await _elastic.SearchAsync<EsDoc>(s => s
                    .Indices(IndexName)
                    .Query(q => q.MultiMatch(mm => mm
                        .Query(searchTerm)
                        .Fields(new[] { "name^3", "author^2", "recordType^2", "content", "extractedText" })
                        .Fuzziness(new Fuzziness("AUTO"))))
                    .Size(10000));

                if (!response.IsValidResponse) return [];
                return response.Hits
                    .Select(h => h.Source?.Id ?? 0)
                    .Where(id => id > 0)
                    .ToList();
            }
            catch { return []; }
        }

        private (List<SearchCriteriaItem> sql, List<SearchCriteriaItem> mem) PartitionCriteria(List<SearchCriteriaItem> items)
        {
            var sqlColumns = new HashSet<string>(StringComparer.OrdinalIgnoreCase) { "author", "filetype", "recordtype" };
            return (
                items.Where(i => sqlColumns.Contains(i.PropertyDefinitionId) && i.Operator is 0 or 4).ToList(),
                items.Where(i => !sqlColumns.Contains(i.PropertyDefinitionId) || i.Operator is not (0 or 4)).ToList()
            );
        }

        private IQueryable<Document> ApplySqlFilters(IQueryable<Document> query, List<SearchCriteriaItem> items)
        {
            foreach (var item in items)
            {
                var value = item.Value?.Trim() ?? string.Empty;
                query = (item.PropertyDefinitionId.ToLower(), item.Operator) switch
                {
                    ("author",     0) => query.Where(d => d.Author == value),
                    ("author",     4) => query.Where(d => d.Author.Contains(value)),
                    ("filetype",   0) => query.Where(d => d.FileType == value),
                    ("filetype",   4) => query.Where(d => d.FileType.Contains(value)),
                    ("recordtype", 0) => query.Where(d => d.RecordType == value),
                    ("recordtype", 4) => query.Where(d => d.RecordType.Contains(value)),
                    _ => query
                };
            }
            return query;
        }

        private IQueryable<Document> ApplyOrderToQuery(IQueryable<Document> query, List<SortOption> sortOptions)
        {
            if (!sortOptions.Any())
                return query.OrderByDescending(d => d.UpdatedAt);

            var first = sortOptions[0];
            return first.Field.ToLower() switch
            {
                "name"          => first.Descending ? query.OrderByDescending(d => d.Name)          : query.OrderBy(d => d.Name),
                "author"        => first.Descending ? query.OrderByDescending(d => d.Author)        : query.OrderBy(d => d.Author),
                "createdat"     => first.Descending ? query.OrderByDescending(d => d.CreatedAt)     : query.OrderBy(d => d.CreatedAt),
                "updatedat"     => first.Descending ? query.OrderByDescending(d => d.UpdatedAt)     : query.OrderBy(d => d.UpdatedAt),
                "filesizebytes" => first.Descending ? query.OrderByDescending(d => d.FileSizeBytes) : query.OrderBy(d => d.FileSizeBytes),
                _               => query.OrderByDescending(d => d.UpdatedAt)
            };
        }

        private List<Document> AndOperator(List<Document> docs, List<SearchCriteriaItem> items) =>
            docs.Where(doc => items.All(item => PropertyPredicate(doc, item))).ToList();

        private List<Document> OrOperator(List<Document> docs, List<SearchCriteriaItem> items) =>
            docs.Where(doc => items.Any(item => PropertyPredicate(doc, item))).ToList();

        private bool PropertyPredicate(Document doc, SearchCriteriaItem item)
        {
            var rawValue = GetFieldValue(doc, item.PropertyDefinitionId);
            var filterValue = item.Value?.Trim() ?? string.Empty;
            var op = item.Operator;

            if (op >= 31 && op <= 34)
            {
                if (!DateTime.TryParse(rawValue, out var docDate)) return false;
                if (!DateTime.TryParse(filterValue, out var filterDate)) return false;
                return op switch { 31 => docDate > filterDate, 32 => docDate >= filterDate, 33 => docDate < filterDate, 34 => docDate <= filterDate, _ => false };
            }

            if (op >= 21 && op <= 24)
            {
                if (!double.TryParse(rawValue, out var docNum)) return false;
                if (!double.TryParse(filterValue, out var filterNum)) return false;
                return op switch { 21 => docNum > filterNum, 22 => docNum >= filterNum, 23 => docNum < filterNum, 24 => docNum <= filterNum, _ => false };
            }

            return op switch
            {
                0 => rawValue.Equals(filterValue, StringComparison.OrdinalIgnoreCase),
                1 => rawValue.StartsWith(filterValue, StringComparison.OrdinalIgnoreCase),
                2 => rawValue.EndsWith(filterValue, StringComparison.OrdinalIgnoreCase),
                3 => !rawValue.Equals(filterValue, StringComparison.OrdinalIgnoreCase),
                4 => rawValue.Contains(filterValue, StringComparison.OrdinalIgnoreCase),
                5 => string.IsNullOrWhiteSpace(rawValue),
                _ => false
            };
        }

        private string GetFieldValue(Document doc, string propertyId) =>
            propertyId.ToLower() switch
            {
                "name"          => doc.Name,
                "author"        => doc.Author,
                "filetype"      => doc.FileType,
                "recordtype"    => doc.RecordType,
                "filesizebytes" => doc.FileSizeBytes.ToString(),
                "createdat"     => doc.CreatedAt.ToString("o"),
                "updatedat"     => doc.UpdatedAt.ToString("o"),
                _               => GetMetadataValue(doc.Metadata, propertyId)
            };

        private string GetMetadataValue(string metadataJson, string key)
        {
            try
            {
                var meta = JsonSerializer.Deserialize<JsonElement>(metadataJson);
                foreach (var prop in meta.EnumerateObject())
                    if (prop.Name.Equals(key, StringComparison.OrdinalIgnoreCase))
                        return prop.Value.ToString();
            }
            catch { }
            return string.Empty;
        }

        private List<Document> ApplyOrder(List<Document> docs, List<SortOption> sortOptions)
        {
            if (!sortOptions.Any())
                return docs.OrderByDescending(d => d.UpdatedAt).ToList();

            var first = sortOptions[0];
            IOrderedEnumerable<Document> ordered = first.Field.ToLower() switch
            {
                "name"          => first.Descending ? docs.OrderByDescending(d => d.Name)          : docs.OrderBy(d => d.Name),
                "author"        => first.Descending ? docs.OrderByDescending(d => d.Author)        : docs.OrderBy(d => d.Author),
                "createdat"     => first.Descending ? docs.OrderByDescending(d => d.CreatedAt)     : docs.OrderBy(d => d.CreatedAt),
                "updatedat"     => first.Descending ? docs.OrderByDescending(d => d.UpdatedAt)     : docs.OrderBy(d => d.UpdatedAt),
                "filesizebytes" => first.Descending ? docs.OrderByDescending(d => d.FileSizeBytes) : docs.OrderBy(d => d.FileSizeBytes),
                _               => docs.OrderByDescending(d => d.UpdatedAt)
            };
            return ordered.ToList();
        }

        private record EsDoc(int Id);
    }
}
