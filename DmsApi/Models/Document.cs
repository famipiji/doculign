namespace DmsApi.Models
{
    public class Document
    {
        public int Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public string Author { get; set; } = string.Empty;
        public long FileSizeBytes { get; set; }
        public string FileType { get; set; } = string.Empty;
        public string RecordType { get; set; } = "General";
        public string Metadata { get; set; } = "{}";
        public string FilePath { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    }
}
