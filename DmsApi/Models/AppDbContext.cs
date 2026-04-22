using Microsoft.EntityFrameworkCore;
using DmsApi.Models;

namespace DmsApi.Data
{
    public class AppDbContext : DbContext
    {
        public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }
        public DbSet<User> Users { get; set; }
        public DbSet<Document> Documents { get; set; }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            modelBuilder.Entity<Document>(entity =>
            {
                entity.HasIndex(d => d.Author);
                entity.HasIndex(d => d.FileType);
                entity.HasIndex(d => d.RecordType);
                entity.HasIndex(d => d.UpdatedAt);
                entity.HasIndex(d => d.CreatedAt);
            });
        }
    }
}