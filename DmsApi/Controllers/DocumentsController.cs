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
        private readonly IServiceScopeFactory _scopeFactory;
        private const string IndexName = "doculign_documents";

        // Seed progress state (process-wide)
        private static volatile bool _seeding = false;
        private static volatile int _seedProgress = 0;
        private static volatile int _seedTarget = 0;
        private static string _seedMessage = string.Empty;

        public DocumentsController(AppDbContext context, ElasticsearchClient elastic, TextExtractionService extractor, IServiceScopeFactory scopeFactory)
        {
            _context = context;
            _elastic = elastic;
            _extractor = extractor;
            _scopeFactory = scopeFactory;
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

            // Fallback: PostgreSQL search across name, author, recordType and metadata
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

                // Extract from the saved file — IFormFile stream is exhausted after CopyToAsync
                extractedText = await _extractor.ExtractFromFileAsync(filePath);
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

        [HttpGet("{id}/debug")]
        public async Task<IActionResult> Debug(int id)
        {
            var doc = await _context.Documents.FindAsync(id);
            if (doc == null) return NotFound();

            try
            {
                var esResponse = await _elastic.GetAsync<DocumentIndexModel>(id.ToString(), g => g.Index(IndexName));
                if (esResponse.IsValidResponse && esResponse.Source != null)
                {
                    var src = esResponse.Source;
                    return Ok(new
                    {
                        indexedInEs = true,
                        extractedTextLength = src.ExtractedText?.Length ?? 0,
                        extractedTextPreview = src.ExtractedText?.Length > 0
                            ? src.ExtractedText[..Math.Min(300, src.ExtractedText.Length)]
                            : "(empty)",
                        contentLength = src.Content?.Length ?? 0,
                        fileOnDisk = !string.IsNullOrEmpty(doc.FilePath) && System.IO.File.Exists(doc.FilePath),
                        filePath = doc.FilePath
                    });
                }
                return Ok(new { indexedInEs = false, fileOnDisk = !string.IsNullOrEmpty(doc.FilePath) && System.IO.File.Exists(doc.FilePath), filePath = doc.FilePath });
            }
            catch (Exception ex)
            {
                return Ok(new { error = ex.Message, filePath = doc.FilePath });
            }
        }

        // Index all existing DB documents into Elasticsearch using bulk API
        [HttpPost("reindex")]
        public async Task<IActionResult> Reindex()
        {
            const int dbPageSize = 1000;
            const int esBulkSize = 500;
            var indexed = 0;
            var skip = 0;

            while (true)
            {
                var docs = await _context.Documents
                    .OrderBy(d => d.Id)
                    .Skip(skip)
                    .Take(dbPageSize)
                    .ToListAsync();

                if (docs.Count == 0) break;

                // Extract text from files that exist on disk
                var models = new List<DocumentIndexModel>(docs.Count);
                foreach (var doc in docs)
                {
                    var extractedText = string.Empty;
                    if (!string.IsNullOrEmpty(doc.FilePath) && System.IO.File.Exists(doc.FilePath))
                        extractedText = await _extractor.ExtractFromFileAsync(doc.FilePath);
                    models.Add(ToIndexModel(doc, extractedText));
                }

                // Bulk index into ES in sub-batches
                for (int i = 0; i < models.Count; i += esBulkSize)
                {
                    var batch = models.Skip(i).Take(esBulkSize).ToList();
                    await _elastic.BulkAsync(b => b
                        .Index(IndexName)
                        .IndexMany(batch, (op, m) => op.Id(m.Id.ToString()))
                    );
                }

                indexed += docs.Count;
                skip += dbPageSize;
                if (docs.Count < dbPageSize) break;
            }

            return Ok(new { indexed });
        }

        [HttpGet("seed-status")]
        public IActionResult SeedStatus() =>
            Ok(new
            {
                seeding = _seeding,
                progress = _seedProgress,
                total = _seedTarget,
                percent = _seedTarget > 0 ? Math.Round((double)_seedProgress / _seedTarget * 100, 1) : 0.0,
                message = _seedMessage
            });

        [HttpPost("seed")]
        public IActionResult SeedDocuments([FromQuery] int count = 100_000)
        {
            if (_seeding)
                return Conflict(new { message = "Seeding already running.", progress = _seedProgress, total = _seedTarget });

            count = Math.Clamp(count, 1, 1_000_000);
            _seedProgress = 0;
            _seedTarget = count;
            _seedMessage = "Starting...";
            _seeding = true;

            _ = Task.Run(async () =>
            {
                try
                {
                    using var scope = _scopeFactory.CreateScope();
                    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
                    db.ChangeTracker.AutoDetectChangesEnabled = false;

                    var rng = new Random();
                    const int batchSize = 1000;

                    string[] recordTypes = ["Invoice", "Employee", "Resume", "ComplianceAudit", "General"];
                    string[] fileTypes   = ["pdf", "docx", "xlsx", "png", "jpg", "txt"];
                    string[] authors     = ["admin", "hr_manager", "finance_dept", "legal_team", "ops_team", "sarah_j", "john_d", "mike_r", "alice_w", "bob_k"];
                    string[] departments = ["HR", "Finance", "Legal", "Operations", "Engineering", "Sales", "Marketing", "IT"];
                    string[] statuses    = ["Active", "Archived", "Pending", "Draft", "Final", "Under Review"];
                    string[] prefixes    = ["Q1", "Q2", "Q3", "Q4", "FY2023", "FY2024", "FY2025", "Annual", "Monthly", "Weekly", "Project_Alpha", "Project_Beta", "Phase1", "Phase2", "Rev"];
                    string[] docWords    = ["Report", "Contract", "Agreement", "Invoice", "Proposal", "Summary", "Analysis", "Audit", "Plan", "Policy", "Handbook", "Manual", "Review", "Notice", "Assessment"];

                    var now = DateTime.UtcNow;
                    var inserted = 0;

                    while (inserted < count)
                    {
                        var thisBatch = Math.Min(batchSize, count - inserted);
                        var batch = new List<Document>(thisBatch);

                        for (int i = 0; i < thisBatch; i++)
                        {
                            var rt = recordTypes[rng.Next(recordTypes.Length)];
                            var ft = fileTypes[rng.Next(fileTypes.Length)];
                            var dept = departments[rng.Next(departments.Length)];
                            var status = statuses[rng.Next(statuses.Length)];
                            var prefix = prefixes[rng.Next(prefixes.Length)];
                            var word = docWords[rng.Next(docWords.Length)];
                            var createdAt = now.AddDays(-rng.Next(730)).AddHours(-rng.Next(24));

                            var metadata = rt switch
                            {
                                "Invoice"         => $@"{{""invoiceNumber"":""{dept}-{rng.Next(10000, 99999)}"",""amount"":""{rng.Next(100, 100000)}"",""status"":""{status}""}}",
                                "Employee"        => $@"{{""department"":""{dept}"",""position"":""{word} Specialist"",""status"":""{status}""}}",
                                "Resume"          => $@"{{""position"":""{word} Engineer"",""department"":""{dept}""}}",
                                "ComplianceAudit" => $@"{{""auditType"":""{dept} Compliance"",""result"":""{status}"",""year"":""{2023 + rng.Next(3)}""}}",
                                _                 => $@"{{""department"":""{dept}"",""status"":""{status}""}}",
                            };

                            batch.Add(new Document
                            {
                                Name         = $"{prefix}_{word}_{rng.Next(1000, 9999)}.{ft}",
                                Author       = authors[rng.Next(authors.Length)],
                                RecordType   = rt,
                                FileType     = ft,
                                FileSizeBytes = rng.NextInt64(10_000, 15_000_000),
                                Metadata     = metadata,
                                FilePath     = string.Empty,
                                CreatedAt    = createdAt,
                                UpdatedAt    = createdAt.AddDays(rng.Next(0, 30)),
                            });
                        }

                        db.Documents.AddRange(batch);
                        await db.SaveChangesAsync();
                        db.ChangeTracker.Clear();

                        inserted += thisBatch;
                        _seedProgress = inserted;
                        _seedMessage = $"Inserted {inserted:N0} / {count:N0}";
                    }

                    _seedMessage = $"Done — {inserted:N0} documents inserted. Run POST /api/documents/reindex to index in Elasticsearch.";
                }
                catch (Exception ex)
                {
                    _seedMessage = $"Error: {ex.Message}";
                }
                finally
                {
                    _seeding = false;
                }
            });

            return Accepted(new
            {
                message = $"Seeding {count:N0} documents in background.",
                statusUrl = "/api/documents/seed-status"
            });
        }
    }
}
