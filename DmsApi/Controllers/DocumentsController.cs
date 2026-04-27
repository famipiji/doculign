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
        private readonly SeaweedFsService _seaweedFs;
        private readonly IServiceScopeFactory _scopeFactory;
        private const string IndexName = "doculign_documents";

        // Seed progress state (process-wide)
        private static volatile bool _seeding = false;
        private static volatile int _seedProgress = 0;
        private static volatile int _seedTarget = 0;
        private static string _seedMessage = string.Empty;

        private readonly ILogger<DocumentsController> _logger;

        public DocumentsController(AppDbContext context, ElasticsearchClient elastic, TextExtractionService extractor, SeaweedFsService seaweedFs, IServiceScopeFactory scopeFactory, ILogger<DocumentsController> logger)
        {
            _context = context;
            _elastic = elastic;
            _extractor = extractor;
            _seaweedFs = seaweedFs;
            _scopeFactory = scopeFactory;
            _logger = logger;
        }

        private static string GenerateBodyText(string recordType, string dept, string author, string status, int seed)
        {
            var rng = new Random(seed);

            string Pick(string[] arr) => arr[rng.Next(arr.Length)];
            string Num(int min, int max) => rng.Next(min, max).ToString();
            string Amount() => $"${rng.Next(500, 250_000):N0}";
            string Date(int daysBack) => DateTime.UtcNow.AddDays(-rng.Next(1, daysBack)).ToString("MMMM d, yyyy");

            return recordType switch
            {
                "Invoice" => $"""
                    INVOICE DOCUMENT
                    Prepared by: {author} | Department: {dept} | Status: {status}

                    This invoice covers professional services rendered during the billing period ending {Date(60)}.
                    The total amount due is {Amount()}, payable within 30 days of receipt.

                    Services include {Pick(["consulting", "system integration", "data migration", "software licensing", "maintenance support"])},
                    {Pick(["technical training", "project management", "audit services", "compliance review", "infrastructure setup"])},
                    and {Pick(["documentation", "quality assurance", "reporting", "stakeholder coordination", "risk assessment"])}.

                    Invoice reference {dept}-INV-{Num(1000,9999)} was approved by {Pick(["finance director", "department head", "procurement manager"])} on {Date(30)}.
                    Payment should be directed to accounts payable. Late payments incur a {Num(1,3)}% monthly interest charge.
                    All amounts are exclusive of applicable taxes. Please retain this document for your records.
                    """,

                "Employee" => $"""
                    EMPLOYEE RECORD
                    Department: {dept} | Prepared by: {author} | Employment Status: {status}

                    This record documents the employment details and performance assessment for the period ending {Date(90)}.
                    The employee has been with the organisation for {Num(1,15)} years and holds the position of
                    {Pick(["Senior Analyst", "Team Lead", "Principal Engineer", "Department Coordinator", "Operations Manager", "Junior Associate"])}.

                    Performance review score: {Num(65,99)}/100.
                    Key competencies assessed include communication, technical proficiency, team collaboration, and project delivery.
                    The employee completed {Num(2,8)} training courses this quarter including
                    {Pick(["workplace safety", "data privacy", "leadership development", "technical certification", "compliance awareness"])}.

                    Salary band: {Pick(["Band 3", "Band 4", "Band 5", "Grade A", "Grade B"])}.
                    Annual leave balance: {Num(3,25)} days remaining.
                    Next review scheduled for {Date(-90)}.
                    """,

                "Resume" => $"""
                    CANDIDATE RESUME
                    Submitted to: {dept} | Reviewed by: {author} | Application Status: {status}

                    Professional Summary:
                    Experienced professional with {Num(3,20)} years in {Pick(["software development", "financial analysis", "operations management", "human resources", "data engineering", "project management"])}.
                    Proven track record delivering {Pick(["scalable systems", "cost reductions", "process improvements", "compliance frameworks", "high-impact projects"])}.

                    Education: {Pick(["Bachelor of Science", "Master of Business Administration", "Bachelor of Engineering", "Master of Science"])} from
                    {Pick(["University of Technology", "National University", "City College", "State University", "Business School"])}, graduated {Num(2000,2022)}.

                    Key Skills: {Pick(["Python, SQL, Azure", "Java, Kubernetes, CI/CD", "Excel, PowerBI, Tableau", "SAP, Oracle, ERP systems", "Agile, Scrum, JIRA"])},
                    {Pick(["stakeholder management", "budget planning", "risk assessment", "team leadership", "vendor negotiation"])}.

                    Most recent role: {Pick(["Senior Engineer", "Lead Analyst", "Project Manager", "Operations Lead"])} at {Pick(["TechCorp", "FinanceCo", "GlobalOps", "DataSystems"])},
                    {Date(365)} to {Date(30)}.
                    Reason for leaving: {Pick(["seeking new challenges", "relocation", "company restructuring", "career growth", "contract ended"])}.
                    """,

                "ComplianceAudit" => $"""
                    COMPLIANCE AUDIT REPORT
                    Auditing Authority: {dept} | Lead Auditor: {author} | Audit Result: {status}

                    This audit was conducted in accordance with regulatory requirements effective {Date(180)}.
                    Scope covers {Pick(["data protection", "financial controls", "operational safety", "environmental standards", "IT security", "anti-money laundering"])} compliance.

                    Findings Summary:
                    Total controls evaluated: {Num(20,80)}.
                    Controls passing: {Num(15,70)}.
                    Minor non-conformances: {Num(0,5)}.
                    Major non-conformances: {Num(0,2)}.

                    Key observations:
                    1. {Pick(["Data retention policies are not consistently applied.", "Access control logs show irregular patterns.", "Training records are incomplete for Q3.", "Third-party vendor agreements require renewal.", "Incident response procedures need updating."])}
                    2. {Pick(["Documentation gaps found in change management process.", "Risk register was last updated over 6 months ago.", "Backup verification tests were not performed quarterly.", "User access reviews are overdue for 12 accounts.", "Policy acknowledgements pending for new staff."])}

                    Recommended remediation deadline: {Date(-60)}.
                    Next scheduled audit: {Date(-365)}.
                    This report is confidential and intended for authorised personnel only.
                    """,

                _ => $"""
                    GENERAL DOCUMENT
                    Department: {dept} | Author: {author} | Status: {status}

                    This document was prepared on {Date(30)} as part of the {dept} department's standard operating procedures.
                    It covers {Pick(["quarterly performance targets", "project delivery milestones", "resource allocation plans", "process improvement initiatives", "strategic objectives"])}.

                    Summary of contents:
                    This document outlines the {Pick(["goals", "procedures", "guidelines", "requirements", "outcomes"])} established by the {dept} team.
                    Approvals were obtained from {Pick(["senior management", "the steering committee", "department heads", "the board"])} on {Date(45)}.

                    Key points:
                    - Budget allocated: {Amount()}
                    - Timeline: {Num(1,12)} months
                    - Team size: {Num(2,20)} members
                    - Priority: {Pick(["High", "Medium", "Critical", "Standard"])}

                    This document is subject to review every {Pick(["6 months", "12 months", "quarter"])}.
                    For questions, contact {author} in the {dept} department.
                    All stakeholders must acknowledge receipt by {Date(-30)}.
                    """
            };
        }

        private static string? TryGetMetaField(string metadataJson, string key)
        {
            try
            {
                var el = System.Text.Json.JsonSerializer.Deserialize<System.Text.Json.JsonElement>(metadataJson);
                foreach (var prop in el.EnumerateObject())
                    if (prop.Name.Equals(key, StringComparison.OrdinalIgnoreCase))
                        return prop.Value.GetString();
            }
            catch { }
            return null;
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
            try
            {
                var model = ToIndexModel(doc, extractedText);
                var response = await _elastic.IndexAsync(model, i => i.Index(IndexName).Id(doc.Id.ToString()));
                if (!response.IsValidResponse)
                    _logger.LogError("ES index failed for doc {Id}: {Error}", doc.Id, response.ElasticsearchServerError?.Error?.Reason ?? response.DebugInformation);
                else
                    _logger.LogInformation("ES indexed doc {Id} ({Chars} chars)", doc.Id, extractedText.Length);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "ES index threw for doc {Id}", doc.Id);
            }
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

            var stream = await _seaweedFs.DownloadAsync(doc.FilePath);
            return File(stream, contentType, enableRangeProcessing: true);
        }

        [HttpPost]
        public async Task<IActionResult> CreateDocument([FromForm] string title, [FromForm] string recordType, [FromForm] string metadata, IFormFile? attachment)
        {
            var extractedText = string.Empty;
            var filePath = string.Empty;

            if (attachment != null)
            {
                using var ms = new MemoryStream();
                await attachment.CopyToAsync(ms);
                var bytes = ms.ToArray();

                extractedText = await _extractor.ExtractFromBytesAsync(bytes, Path.GetExtension(attachment.FileName));
                filePath = await _seaweedFs.UploadAsync(bytes, attachment.FileName);
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
                        fileInSeaweedFs = SeaweedFsService.IsFid(doc.FilePath),
                        filePath = doc.FilePath
                    });
                }
                return Ok(new { indexedInEs = false, fileInSeaweedFs = SeaweedFsService.IsFid(doc.FilePath), filePath = doc.FilePath });
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

                // Extract text from files stored in SeaweedFS
                var models = new List<DocumentIndexModel>(docs.Count);
                foreach (var doc in docs)
                {
                    var extractedText = string.Empty;
                    if (SeaweedFsService.IsFid(doc.FilePath))
                    {
                        try
                        {
                            var stream = await _seaweedFs.DownloadAsync(doc.FilePath);
                            using var ms = new MemoryStream();
                            await stream.CopyToAsync(ms);
                            extractedText = await _extractor.ExtractFromBytesAsync(ms.ToArray(), "." + doc.FileType);
                        }
                        catch (Exception ex)
                        {
                            _logger.LogWarning("Reindex: failed to download fid {Fid}: {Message}", doc.FilePath, ex.Message);
                        }
                    }
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
        public IActionResult SeedDocuments([FromQuery] int count = 100_000, [FromQuery] bool clear = false)
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

                    if (clear)
                    {
                        _seedMessage = "Clearing existing documents...";
                        await db.Database.ExecuteSqlRawAsync("TRUNCATE TABLE \"Documents\" RESTART IDENTITY CASCADE");
                        await _elastic.DeleteByQueryAsync<DocumentIndexModel>(d => d.Indices(IndexName).Query(q => q.MatchAll(new Elastic.Clients.Elasticsearch.QueryDsl.MatchAllQuery())));
                        _seedMessage = "Cleared. Starting insert...";
                    }

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

                    _seedMessage = $"Done — {inserted:N0} documents inserted. Now reindexing into Elasticsearch...";

                    // Auto-reindex into Elasticsearch in bulk
                    var reindexed = 0;
                    var reindexSkip = 0;
                    const int reindexPage = 1000;
                    const int reindexBulk = 500;
                    while (true)
                    {
                        var page = await db.Documents.OrderBy(d => d.Id).Skip(reindexSkip).Take(reindexPage).ToListAsync();
                        if (page.Count == 0) break;
                        var models2 = page.Select(d =>
                        {
                            var dept = TryGetMetaField(d.Metadata, "department") ?? "General";
                            var status = TryGetMetaField(d.Metadata, "status") ?? "Active";
                            var body = GenerateBodyText(d.RecordType, dept, d.Author, status, d.Id);
                            return ToIndexModel(d, body);
                        }).ToList();
                        for (int j = 0; j < models2.Count; j += reindexBulk)
                        {
                            var sub = models2.Skip(j).Take(reindexBulk).ToList();
                            await _elastic.BulkAsync(b => b.Index(IndexName).IndexMany(sub, (op, m) => op.Id(m.Id.ToString())));
                        }
                        reindexed += page.Count;
                        reindexSkip += reindexPage;
                        _seedMessage = $"Inserted {inserted:N0} docs. Reindexing: {reindexed:N0} / {inserted:N0}";
                        if (page.Count < reindexPage) break;
                    }

                    _seedMessage = $"Done — {inserted:N0} documents inserted and indexed in Elasticsearch.";
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
                message = $"{(clear ? "Clearing then seeding" : "Seeding")} {count:N0} documents in background. Will auto-reindex into Elasticsearch when done.",
                statusUrl = "/api/documents/seed-status"
            });
        }
    }
}
