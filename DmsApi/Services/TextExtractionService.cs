using Tesseract;
using UglyToad.PdfPig;
using DocumentFormat.OpenXml.Packaging;
using PDFtoImage;
using SkiaSharp;
using System.Text;

namespace DmsApi.Services
{
    public class TextExtractionService
    {
        private readonly string _tessDataPath;
        private readonly ILogger<TextExtractionService> _logger;

        // Minimum characters from PdfPig before we consider the PDF to have a real text layer
        private const int MinTextLayerLength = 50;

        public TextExtractionService(IConfiguration config, ILogger<TextExtractionService> logger)
        {
            _tessDataPath = config["Tesseract:DataPath"] ?? Path.Combine(AppContext.BaseDirectory, "tessdata");
            _logger = logger;
        }

        public async Task<string> ExtractAsync(IFormFile file)
        {
            var ext = Path.GetExtension(file.FileName).ToLowerInvariant();

            using var ms = new MemoryStream();
            await file.CopyToAsync(ms);
            var bytes = ms.ToArray();

            try
            {
                return ext switch
                {
                    ".pdf"  => ExtractFromPdf(bytes),
                    ".docx" => ExtractFromDocx(bytes),
                    ".png" or ".jpg" or ".jpeg" or ".bmp" or ".tiff" or ".tif" => ExtractFromImage(bytes),
                    _ => string.Empty
                };
            }
            catch (Exception ex)
            {
                _logger.LogWarning("Text extraction failed for {FileName}: {Message}", file.FileName, ex.Message);
                return string.Empty;
            }
        }

        private string ExtractFromPdf(byte[] bytes)
        {
            // Step 1: try embedded text layer via PdfPig
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

            var textLayerContent = sb.ToString().Trim();
            if (textLayerContent.Length >= MinTextLayerLength)
                return textLayerContent;

            // Step 2: scanned/image PDF — render each page to image and OCR
            _logger.LogInformation("PDF has no text layer — running Tesseract OCR on rendered pages.");
            return OcrPdfPages(bytes);
        }

        private string OcrPdfPages(byte[] bytes)
        {
            var sb = new StringBuilder();

            // Render each page as a PNG image then OCR it
            var pageImages = Conversion.ToImages(bytes);
            foreach (var bitmap in pageImages)
            {
                using var skBitmap = bitmap;
                using var data = skBitmap.Encode(SKEncodedImageFormat.Png, 100);
                var pngBytes = data.ToArray();

                try
                {
                    var pageText = ExtractFromImage(pngBytes);
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

        private string ExtractFromDocx(byte[] bytes)
        {
            using var ms = new MemoryStream(bytes);
            using var doc = WordprocessingDocument.Open(ms, false);
            return doc.MainDocumentPart?.Document?.Body?.InnerText ?? string.Empty;
        }

        private string ExtractFromImage(byte[] bytes)
        {
            if (!Directory.Exists(_tessDataPath))
                throw new DirectoryNotFoundException($"Tesseract tessdata not found at: {_tessDataPath}");

            using var engine = new TesseractEngine(_tessDataPath, "eng", EngineMode.Default);
            using var img = Pix.LoadFromMemory(bytes);
            using var page = engine.Process(img);
            return page.GetText().Trim();
        }
    }
}
