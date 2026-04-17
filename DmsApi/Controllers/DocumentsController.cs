using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using DmsApi.Data;

namespace DmsApi.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class DocumentsController : ControllerBase
    {
        private readonly AppDbContext _context;

        public DocumentsController(AppDbContext context)
        {
            _context = context;
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
    }
}
