using Microsoft.EntityFrameworkCore;
using DmsApi.Data;
using DmsApi.Models;
using Elastic.Clients.Elasticsearch;
using DmsApi.Services;
using DmsApi.Repositories;

var builder = WebApplication.CreateBuilder(args);

var connectionString = builder.Configuration.GetConnectionString("DefaultConnection");
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql(connectionString));

var elasticUrl = builder.Configuration["Elasticsearch:Url"] ?? "http://localhost:9200";
var elasticSettings = new ElasticsearchClientSettings(new Uri(elasticUrl))
    .DefaultIndex("documents");
builder.Services.AddSingleton(new ElasticsearchClient(elasticSettings));

builder.Services.AddScoped<TextExtractionService>();
builder.Services.AddScoped<SearchRepository>();

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAll", policy =>
    {
        policy.AllowAnyOrigin().AllowAnyMethod().AllowAnyHeader();
    });
});

var app = builder.Build();

// Auto-create tables and seed initial data
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    for (var attempt = 1; attempt <= 10; attempt++)
    {
        try { db.Database.EnsureCreated(); break; }
        catch (Exception ex) when (attempt < 10)
        {
            Console.WriteLine($"DB not ready (attempt {attempt}/10): {ex.Message}. Retrying in 3s...");
            Thread.Sleep(3000);
        }
    }
    try
    {
        db.Database.EnsureCreated();

        if (!db.Users.Any())
        {
            db.Users.Add(new User { Username = "admin", PasswordHash = "admin123", Email = "admin@doculign.com" });
            db.SaveChanges();
            Console.WriteLine("Seeded admin user.");
        }

        if (!db.Documents.Any())
        {
            db.Documents.AddRange(
                new Document { Name = "Project_Alpha_Contract.pdf", Author = "admin", FileSizeBytes = 2516582, FileType = "pdf", UpdatedAt = DateTime.UtcNow.AddHours(-2) },
                new Document { Name = "Q1_Financial_Report.xlsx", Author = "finance_dept", FileSizeBytes = 1153433, FileType = "xlsx", UpdatedAt = DateTime.UtcNow.AddHours(-5) },
                new Document { Name = "System_Architecture_v2.vsdx", Author = "admin", FileSizeBytes = 16568729, FileType = "vsdx", UpdatedAt = DateTime.UtcNow.AddDays(-1) },
                new Document { Name = "Team_Meeting_Notes.docx", Author = "sarah_j", FileSizeBytes = 460800, FileType = "docx", UpdatedAt = DateTime.UtcNow.AddDays(-1) },
                new Document { Name = "Employee_Handbook.pdf", Author = "hr_manager", FileSizeBytes = 3354214, FileType = "pdf", UpdatedAt = DateTime.UtcNow.AddDays(-3) }
            );
            db.SaveChanges();
            Console.WriteLine("Seeded sample documents.");
        }
    }
    catch (Exception ex)
    {
        Console.WriteLine($"Seed error: {ex.Message}");
    }
}

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseCors("AllowAll");
app.UseAuthorization();
app.MapControllers();

app.Run();
