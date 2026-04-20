using Microsoft.EntityFrameworkCore;
using DmsApi.Data;
using DmsApi.Models;
using System.Text.Json;

namespace DmsApi.Repositories
{
    public class SearchRepository
    {
        private readonly AppDbContext _context;

        public SearchRepository(AppDbContext context)
        {
            _context = context;
        }

        public async Task<(List<Document> documents, int count)> SearchAsync(SearchRequest request)
        {
            IQueryable<Document> query = _context.Documents;

            // Initial broad filter on searchTerm
            if (!string.IsNullOrWhiteSpace(request.SearchTerm))
            {
                var term = request.SearchTerm.ToLower();
                query = query.Where(d =>
                    d.Name.ToLower().Contains(term) ||
                    d.Author.ToLower().Contains(term) ||
                    d.RecordType.ToLower().Contains(term) ||
                    d.Metadata.ToLower().Contains(term));
            }

            var docs = await query.ToListAsync();

            // Apply criteria filters in memory
            if (request.Items.Any())
            {
                docs = request.Kind == 1
                    ? AndOperator(docs, request.Items)
                    : OrOperator(docs, request.Items);
            }

            var count = docs.Count;

            docs = ApplyOrder(docs, request.SortOptions);
            docs = docs.Skip(request.Skip).Take(request.Take).ToList();

            return (docs, count);
        }

        // AND: every criterion must match
        private List<Document> AndOperator(List<Document> docs, List<SearchCriteriaItem> items)
        {
            return docs.Where(doc =>
                items.All(item => PropertyPredicate(doc, item))
            ).ToList();
        }

        // OR: at least one criterion must match
        private List<Document> OrOperator(List<Document> docs, List<SearchCriteriaItem> items)
        {
            return docs.Where(doc =>
                items.Any(item => PropertyPredicate(doc, item))
            ).ToList();
        }

        private bool PropertyPredicate(Document doc, SearchCriteriaItem item)
        {
            var rawValue = GetFieldValue(doc, item.PropertyDefinitionId);
            var filterValue = item.Value?.Trim() ?? string.Empty;
            var op = item.Operator;

            // Date operators (31–34)
            if (op >= 31 && op <= 34)
            {
                if (!DateTime.TryParse(rawValue, out var docDate)) return false;
                if (!DateTime.TryParse(filterValue, out var filterDate)) return false;
                return op switch
                {
                    31 => docDate > filterDate,
                    32 => docDate >= filterDate,
                    33 => docDate < filterDate,
                    34 => docDate <= filterDate,
                    _ => false
                };
            }

            // Numeric operators (21–24)
            if (op >= 21 && op <= 24)
            {
                if (!double.TryParse(rawValue, out var docNum)) return false;
                if (!double.TryParse(filterValue, out var filterNum)) return false;
                return op switch
                {
                    21 => docNum > filterNum,
                    22 => docNum >= filterNum,
                    23 => docNum < filterNum,
                    24 => docNum <= filterNum,
                    _ => false
                };
            }

            // String operators (0–5)
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

        private string GetFieldValue(Document doc, string propertyId)
        {
            return propertyId.ToLower() switch
            {
                "name" => doc.Name,
                "author" => doc.Author,
                "filetype" => doc.FileType,
                "recordtype" => doc.RecordType,
                "filesizebytes" => doc.FileSizeBytes.ToString(),
                "createdat" => doc.CreatedAt.ToString("o"),
                "updatedat" => doc.UpdatedAt.ToString("o"),
                _ => GetMetadataValue(doc.Metadata, propertyId)
            };
        }

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
                "name" => first.Descending ? docs.OrderByDescending(d => d.Name) : docs.OrderBy(d => d.Name),
                "author" => first.Descending ? docs.OrderByDescending(d => d.Author) : docs.OrderBy(d => d.Author),
                "createdat" => first.Descending ? docs.OrderByDescending(d => d.CreatedAt) : docs.OrderBy(d => d.CreatedAt),
                "updatedat" => first.Descending ? docs.OrderByDescending(d => d.UpdatedAt) : docs.OrderBy(d => d.UpdatedAt),
                "filesizebytes" => first.Descending ? docs.OrderByDescending(d => d.FileSizeBytes) : docs.OrderBy(d => d.FileSizeBytes),
                _ => docs.OrderByDescending(d => d.UpdatedAt)
            };

            return ordered.ToList();
        }
    }
}
