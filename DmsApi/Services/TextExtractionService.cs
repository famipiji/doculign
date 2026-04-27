using UglyToad.PdfPig;
using DocumentFormat.OpenXml.Packaging;
using PDFtoImage;
using SkiaSharp;
using System.Diagnostics;
using System.Text;

namespace DmsApi.Services
{
    public class TextExtractionService
    {
        private readonly ILogger<TextExtractionService> _logger;

        private const int MinTextLayerLength = 0;

        public TextExtractionService(IConfiguration config, ILogger<TextExtractionService> logger)
        {
            _logger = logger;
        }

        public async Task<string> ExtractFromBytesAsync(byte[] bytes, string extension)
        {
            var ext = extension.ToLowerInvariant();
            if (!ext.StartsWith('.')) ext = "." + ext;
            try
            {
                return ext switch
                {
                    ".pdf"  => await ExtractFromPdfAsync(bytes),
                    ".docx" => ExtractFromDocx(bytes),
                    ".png" or ".jpg" or ".jpeg" or ".bmp" or ".tiff" or ".tif" => await ExtractFromImageCliAsync(bytes),
                    _ => string.Empty
                };
            }
            catch (Exception ex)
            {
                var inner = ex.InnerException ?? ex;
                _logger.LogWarning("Text extraction failed for {Ext}: {Message} | Inner: {Inner}", ext, ex.Message, inner.Message);
                return string.Empty;
            }
        }

        public async Task<string> ExtractAsync(IFormFile file)
        {
            using var ms = new MemoryStream();
            await file.CopyToAsync(ms);
            return await ExtractFromBytesAsync(ms.ToArray(), Path.GetExtension(file.FileName));
        }

        public async Task<string> ExtractFromFileAsync(string filePath)
        {
            if (!File.Exists(filePath))
            {
                _logger.LogWarning("ExtractFromFileAsync: file not found at {FilePath}", filePath);
                return string.Empty;
            }
            var bytes = await File.ReadAllBytesAsync(filePath);
            return await ExtractFromBytesAsync(bytes, Path.GetExtension(filePath));
        }

        private async Task<string> ExtractFromPdfAsync(byte[] bytes)
        {
            var sb = new StringBuilder();
            using (var doc = PdfDocument.Open(bytes))
            {
                foreach (var page in doc.GetPages())
                {
                    var text = page.Text;
                    if (!string.IsNullOrWhiteSpace(text))
                        sb.AppendLine(text);
                }
            }

            var textLayer = sb.ToString().Trim();
            if (textLayer.Length > MinTextLayerLength)
                return textLayer;

            _logger.LogInformation("PDF has no text layer — running Tesseract OCR on rendered pages.");
            return await OcrPdfPagesAsync(bytes);
        }

        private async Task<string> OcrPdfPagesAsync(byte[] bytes)
        {
            var sb = new StringBuilder();
            var pageImages = Conversion.ToImages(bytes);
            foreach (var bitmap in pageImages)
            {
                using var skBitmap = bitmap;
                using var data = skBitmap.Encode(SKEncodedImageFormat.Png, 100);
                try
                {
                    var pageText = await ExtractFromImageCliAsync(data.ToArray());
                    if (!string.IsNullOrWhiteSpace(pageText))
                        sb.AppendLine(pageText);
                }
                catch (Exception ex)
                {
                    _logger.LogWarning("OCR failed on a PDF page: {Message}", ex.Message);
                }
            }
            return sb.ToString().Trim();
        }

        private async Task<string> ExtractFromImageCliAsync(byte[] bytes)
        {
            var tempFile = Path.Combine(Path.GetTempPath(), $"{Guid.NewGuid()}.png");
            try
            {
                await File.WriteAllBytesAsync(tempFile, bytes);

                using var process = new Process
                {
                    StartInfo = new ProcessStartInfo
                    {
                        FileName = "tesseract",
                        Arguments = $"{tempFile} stdout -l eng",
                        RedirectStandardOutput = true,
                        RedirectStandardError = true,
                        UseShellExecute = false,
                        CreateNoWindow = true
                    }
                };

                process.Start();
                var text = await process.StandardOutput.ReadToEndAsync();
                await process.WaitForExitAsync();

                _logger.LogInformation("OCR extracted {Chars} chars from image", text.Trim().Length);
                return text.Trim();
            }
            finally
            {
                try { File.Delete(tempFile); } catch { }
            }
        }

        private string ExtractFromDocx(byte[] bytes)
        {
            using var ms = new MemoryStream(bytes);
            using var doc = WordprocessingDocument.Open(ms, false);
            return doc.MainDocumentPart?.Document?.Body?.InnerText ?? string.Empty;
        }
    }
}
