namespace DmsApi.Models
{
    public class SearchRequest
    {
        public string SearchTerm { get; set; } = string.Empty;
        public int Skip { get; set; } = 0;
        public int Take { get; set; } = 10;
        public int Kind { get; set; } = 1; // 1=AND, 0=OR
        public List<SearchCriteriaItem> Items { get; set; } = new();
        public List<SortOption> SortOptions { get; set; } = new();
    }

    public class SearchCriteriaItem
    {
        public string Value { get; set; } = string.Empty;
        public int Operator { get; set; }
        public string PropertyDefinitionId { get; set; } = string.Empty;
    }

    public class SortOption
    {
        public string Field { get; set; } = string.Empty;
        public bool Descending { get; set; } = false;
    }

    public class SearchResponse
    {
        public List<Document> Documents { get; set; } = new();
        public int Count { get; set; }
    }

    public class ContentSearchResult
    {
        public int Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public string Snippet { get; set; } = string.Empty;
        public int MatchCount { get; set; }
    }
}
