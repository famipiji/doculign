using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using DmsApi.Data;
using DmsApi.Models;
using DmsApi.Services;
using Elastic.Clients.Elasticsearch;
using System.Text.Json;

namespace DmsApi.Controllers
{
    public class DocumentIndexModel
    {
        public int Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public string Author { get; set; } = string.Empty;
        public string RecordType { get; set; } = string.Empty;
        public string FileType { get; set; } = string.Empty;
        public long FileSizeBytes { get; set; }
        public string Content { get; set; } = string.Empty;
        public string ExtractedText { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; }
        public DateTime UpdatedAt { get; set; }
    }

    [ApiController]
    [Route("api/[controller]")]
    public class DocumentsController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly ElasticsearchClient _elastic;
        private readonly TextExtractionService _extractor;
        private const string IndexName = "doculign_documents";

        public DocumentsController(AppDbContext context, ElasticsearchClient elastic, TextExtractionService extractor)
        {
            _context = context;
            _elastic = elastic;
            _extractor = extractor;
        }

        private static string BuildContent(Document doc, string extractedText = "")
        {
            var parts = new List<string> { doc.Name, doc.Author, doc.RecordType, doc.FileType };

            try
            {
                var meta = JsonSerializer.Deserialize<JsonElement>(doc.Metadata);
                foreach (var prop in meta.EnumerateObject())
                {
                    var val = prop.Value.ToString();
                    if (!string.IsNullOrWhiteSpace(val))
                        parts.Add(val);
                }
            }
            catch { }

            if (!string.IsNullOrWhiteSpace(extractedText))
                parts.Add(extractedText);

            return string.Join(" ", parts.Where(p => !string.IsNullOrWhiteSpace(p)));
        }

        private static DocumentIndexModel ToIndexModel(Document doc, string extractedText = "") => new()
        {
            Id = doc.Id,
            Name = doc.Name,
            Author = doc.Author,
            RecordType = doc.RecordType,
            FileType = doc.FileType,
            FileSizeBytes = doc.FileSizeBytes,
            Content = BuildContent(doc, extractedText),
            ExtractedText = extractedText,
            CreatedAt = doc.CreatedAt,
            UpdatedAt = doc.UpdatedAt,
        };

        private async Task IndexDocument(Document doc, string extractedText = "")
        {
            var model = ToIndexModel(doc, extractedText);
            await _elastic.IndexAsync(model, i => i.Index(IndexName).Id(doc.Id.ToString()));
        }

        [HttpGet("{id}/content")]
        public async Task<IActionResult> GetContent(int id)
        {
            var doc = await _context.Documents.FindAsync(id);
            if (doc == null) return NotFound();

            var extractedText = string.Empty;
            try
            {
                var esResponse = await _elastic.GetAsync<DocumentIndexModel>(
                    id.ToString(), g => g.Index(IndexName));
                if (esResponse.IsValidResponse)
                    extractedText = esResponse.Source?.ExtractedText ?? string.Empty;
            }
            catch { }

            return Ok(new { document = doc, extractedText });
        }

        [HttpGet]
        public async Task<IActionResult> GetDocuments()
        {
            var documents = await _context.Documents
                .OrderByDescending(d => d.UpdatedAt)
                .Take(20)
                .ToListAsync();

            return Ok(documents);
        }

        [HttpGet("stats")]
        public async Task<IActionResult> GetStats()
        {
            var totalDocuments = await _context.Documents.CountAsync();
            var totalSizeBytes = await _context.Documents.SumAsync(d => d.FileSizeBytes);

            return Ok(new
            {
                totalDocuments,
                totalSizeBytes,
                storageLimitBytes = 10L * 1024 * 1024 * 1024
            });
        }

        [HttpGet("search")]
        public async Task<IActionResult> Search([FromQuery] string q)
        {
            if (string.IsNullOrWhiteSpace(q))
                return Ok(new List<object>());

            try
            {
                var response = await _elastic.SearchAsync<DocumentIndexModel>(s => s
                    .Indices(IndexName)
                    .Query(query => query
                        .MultiMatch(mm => mm
                            .Query(q)
                            .Fields(new[]
                            {
                                "name^3",
                                "author^2",
                                "recordType^2",
                                "content",
                                "extractedText"
                            })
                            .Fuzziness(new Fuzziness("AUTO"))
                            .MinimumShouldMatch("1")
                        )
                    )
                    .Size(20)
                );

                if (response.IsValidResponse && response.Documents.Any())
                    return Ok(response.Documents.ToList());
            }
            catch { }

            // Fallback: MySQL LIKE search across name, author, recordType and metadata
            var fallback = await _context.Documents
                .Where(d =>
                    d.Name.Contains(q) ||
                    d.Author.Contains(q) ||
                    d.RecordType.Contains(q) ||
                    d.Metadata.Contains(q))
                .OrderByDescending(d => d.UpdatedAt)
                .Take(20)
                .Select(d => new DocumentIndexModel
                {
                    Id = d.Id,
                    Name = d.Name,
                    Author = d.Author,
                    RecordType = d.RecordType,
                    FileType = d.FileType,
                    FileSizeBytes = d.FileSizeBytes,
                    Content = BuildContent(d),
                    CreatedAt = d.CreatedAt,
                    UpdatedAt = d.UpdatedAt,
                })
                .ToListAsync();

            return Ok(fallback);
        }

        [HttpGet("{id}/file")]
        public async Task<IActionResult> GetFile(int id)
        {
            var doc = await _context.Documents.FindAsync(id);
            if (doc == null || string.IsNullOrEmpty(doc.FilePath))
                return NotFound(new { message = "No file attached to this document." });

            if (!System.IO.File.Exists(doc.FilePath))
                return NotFound(new { message = "File not found on server." });

            var contentType = doc.FileType.ToLower() switch
            {
                "pdf"  => "application/pdf",
                "png"  => "image/png",
                "jpg" or "jpeg" => "image/jpeg",
                "gif"  => "image/gif",
                "bmp"  => "image/bmp",
                "docx" => "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                "xlsx" => "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                _      => "application/octet-stream"
            };

            var stream = System.IO.File.OpenRead(doc.FilePath);
            return File(stream, contentType, enableRangeProcessing: true);
        }

        [HttpPost]
        public async Task<IActionResult> CreateDocument([FromForm] string title, [FromForm] string recordType, [FromForm] string metadata, IFormFile? attachment)
        {
            var extractedText = string.Empty;
            var filePath = string.Empty;

            if (attachment != null)
            {
                // Save file to uploads folder
                var uploadsDir = Path.Combine(AppContext.BaseDirectory, "uploads");
                Directory.CreateDirectory(uploadsDir);
                var fileName = $"{Guid.NewGuid()}_{Path.GetFileName(attachment.FileName)}";
                filePath = Path.Combine(uploadsDir, fileName);
                using (var stream = System.IO.File.Create(filePath))
                    await attachment.CopyToAsync(stream);

                extractedText = await _extractor.ExtractAsync(attachment);
            }

            var document = new Document
            {
                Name = title,
                Author = "admin",
                RecordType = recordType,
                Metadata = metadata ?? "{}",
                FilePath = filePath,
                FileType = attachment != null ? Path.GetExtension(attachment.FileName).TrimStart('.').ToLower() : recordType.ToLower(),
                FileSizeBytes = attachment?.Length ?? 0,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow,
            };

            _context.Documents.Add(document);
            await _context.SaveChangesAsync();

            await IndexDocument(document, extractedText);

            return Ok(document);
        }

        // Index all existing DB documents into Elasticsearch
        [HttpPost("reindex")]
        public async Task<IActionResult> Reindex()
        {
            var documents = await _context.Documents.ToListAsync();
            foreach (var doc in documents)
                await IndexDocument(doc);

            return Ok(new { indexed = documents.Count });
        }
    }
}
