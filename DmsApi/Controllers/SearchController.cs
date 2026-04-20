using Microsoft.AspNetCore.Mvc;
using DmsApi.Models;
using DmsApi.Repositories;
using Elastic.Clients.Elasticsearch;
using Elastic.Clients.Elasticsearch.Core.Search;
using System.Text.RegularExpressions;

namespace DmsApi.Controllers
{
    [ApiController]
    [Route("api")]
    public class SearchController : ControllerBase
    {
        private readonly SearchRepository _searchRepo;
        private readonly ElasticsearchClient _elastic;
        private const string IndexName = "doculign_documents";

        public SearchController(SearchRepository searchRepo, ElasticsearchClient elastic)
        {
            _searchRepo = searchRepo;
            _elastic = elastic;
        }

        [HttpPost("search")]
        public async Task<IActionResult> Search([FromBody] DmsApi.Models.SearchRequest request)
        {
            var (documents, count) = await _searchRepo.SearchAsync(request);
            return Ok(new SearchResponse { Documents = documents, Count = count });
        }

        [HttpGet("search-content")]
        public async Task<IActionResult> SearchContent([FromQuery] string q)
        {
            if (string.IsNullOrWhiteSpace(q))
                return Ok(new List<ContentSearchResult>());

            try
            {
                var response = await _elastic.SearchAsync<DocumentIndexModel>(s => s
                    .Indices(IndexName)
                    .Query(query => query
                        .MultiMatch(mm => mm
                            .Query(q)
                            .Fields(new[] { "name^3", "author^2", "recordType^2", "content", "extractedText" })
                            .Fuzziness(new Fuzziness("AUTO"))
                        )
                    )
                    .Highlight(h => h
                        .Fields(f => f
                            .Add("content", hf => hf.NumberOfFragments(1).FragmentSize(200))
                            .Add("extractedText", hf => hf.NumberOfFragments(1).FragmentSize(200))
                            .Add("name", hf => hf.NumberOfFragments(1))
                        )
                        .PreTags(["<em>"])
                        .PostTags(["</em>"])
                    )
                    .Size(50)
                );

                if (!response.IsValidResponse)
                    return Ok(new List<ContentSearchResult>());

                var results = response.Hits.Select(hit =>
                {
                    var snippet = string.Empty;
                    var matchCount = 0;

                    if (hit.Highlight != null)
                    {
                        var allFragments = hit.Highlight.Values.SelectMany(v => v).ToList();
                        snippet = allFragments.FirstOrDefault() ?? string.Empty;
                        matchCount = allFragments.Sum(f =>
                            System.Text.RegularExpressions.Regex.Matches(f, "<em>").Count);
                    }

                    return new ContentSearchResult
                    {
                        Id = hit.Source?.Id ?? 0,
                        Name = hit.Source?.Name ?? string.Empty,
                        Snippet = snippet,
                        MatchCount = matchCount
                    };
                }).ToList();

                return Ok(results);
            }
            catch
            {
                return Ok(new List<ContentSearchResult>());
            }
        }
    }
}
