using System.Text.Json.Serialization;

namespace DmsApi.Services
{
    public class SeaweedFsService
    {
        private readonly HttpClient _http;
        private readonly string _masterUrl;
        private readonly string _volumeUrl;
        private readonly ILogger<SeaweedFsService> _logger;

        public SeaweedFsService(HttpClient http, IConfiguration config, ILogger<SeaweedFsService> logger)
        {
            _http = http;
            _masterUrl = config["SeaweedFS:MasterUrl"] ?? "http://seaweedfs-master:9333";
            _volumeUrl = config["SeaweedFS:VolumeUrl"] ?? "http://seaweedfs-volume:8080";
            _logger = logger;
        }

        public async Task<string> UploadAsync(byte[] bytes, string fileName)
        {
            var assign = await _http.GetFromJsonAsync<AssignResult>($"{_masterUrl}/dir/assign");
            if (assign is null) throw new Exception("SeaweedFS assign returned null");

            using var content = new MultipartFormDataContent();
            content.Add(new ByteArrayContent(bytes), "file", fileName);
            var response = await _http.PostAsync($"{_volumeUrl}/{assign.Fid}", content);
            response.EnsureSuccessStatusCode();

            _logger.LogInformation("Uploaded {FileName} to SeaweedFS fid={Fid}", fileName, assign.Fid);
            return assign.Fid;
        }

        public Task<Stream> DownloadAsync(string fid) =>
            _http.GetStreamAsync($"{_volumeUrl}/{fid}");

        public async Task DeleteAsync(string fid)
        {
            try { await _http.DeleteAsync($"{_volumeUrl}/{fid}"); }
            catch (Exception ex) { _logger.LogWarning("Delete fid {Fid} failed: {Message}", fid, ex.Message); }
        }

        // SeaweedFS fids look like "3,01637037d6" — no slashes or backslashes
        public static bool IsFid(string? path) =>
            !string.IsNullOrEmpty(path) && path.Contains(',') && !path.Contains('/') && !path.Contains('\\');

        private record AssignResult([property: JsonPropertyName("fid")] string Fid);
    }
}
