from fastapi import FastAPI, UploadFile, File, HTTPException
from paddleocr import PaddleOCR
from PIL import Image, ImageEnhance, ImageFilter
import numpy as np
import io
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI()
ocr: PaddleOCR | None = None


@app.on_event("startup")
def load_model():
    global ocr
    logger.info("[OCR] Loading PaddleOCR model (may download on first run)...")
    ocr = PaddleOCR(
        use_angle_cls=True,
        lang="en",
        show_log=False,
    )
    logger.info("[OCR] Model ready.")


def preprocess_for_ocr(img: Image.Image) -> np.ndarray:
    img = img.convert("RGB")

    # Scale up small images — PaddleOCR detector needs sufficient resolution
    w, h = img.size
    if max(w, h) < 1200:
        scale = 1200 / max(w, h)
        img = img.resize((int(w * scale), int(h * scale)), Image.LANCZOS)

    img = ImageEnhance.Contrast(img).enhance(1.5)
    img = img.filter(ImageFilter.SHARPEN)
    return np.array(img)


@app.get("/health")
def health():
    if ocr is None:
        raise HTTPException(status_code=503, detail="Model not ready")
    return {"status": "ok"}


@app.post("/ocr")
async def run_ocr(file: UploadFile = File(...)):
    if ocr is None:
        raise HTTPException(status_code=503, detail="Model not ready")

    contents = await file.read()
    if not contents:
        raise HTTPException(status_code=400, detail="Empty file")

    try:
        img = Image.open(io.BytesIO(contents))
        img_array = preprocess_for_ocr(img)
        logger.info(f"[OCR] processing image shape={img_array.shape}")
        result = ocr.ocr(img_array, cls=True)
    except Exception as e:
        logger.error(f"[OCR] EXCEPTION {type(e).__name__}: {e}", exc_info=True)
        raise HTTPException(status_code=422, detail=f"OCR failed: {e}")

    # PaddleOCR 2.7.x result: [page_results]
    # page_results: [[box, (text, confidence)], ...] or None
    lines = []
    if result and result[0]:
        for line in result[0]:
            try:
                text = line[1][0] if line and len(line) >= 2 else None
                if text and text.strip():
                    lines.append(text.strip())
            except (IndexError, TypeError):
                pass

    logger.info(f"[OCR] extracted {len(lines)} lines")
    return {"text": "\n".join(lines)}
