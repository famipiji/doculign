from fastapi import FastAPI, UploadFile, File, HTTPException
from paddleocr import PaddleOCR
from PIL import Image
import numpy as np
import io

app = FastAPI()

ocr = PaddleOCR(
    use_doc_orientation_classify=False,
    use_doc_unwarping=False,
    use_textline_orientation=False,
    lang="en",
)


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/ocr")
async def run_ocr(file: UploadFile = File(...)):
    contents = await file.read()
    if not contents:
        raise HTTPException(status_code=400, detail="Empty file")

    try:
        img = Image.open(io.BytesIO(contents)).convert("RGB")
        img_array = np.array(img)
        result = ocr.ocr(img_array)
    except Exception as e:
        print(f"[OCR] EXCEPTION {type(e).__name__}: {e}", flush=True)
        raise HTTPException(status_code=422, detail=f"OCR failed: {e}")

    lines = []
    if result:
        for res in result:
            if hasattr(res, "rec_texts"):
                lines.extend(res.rec_texts)
            elif isinstance(res, list):
                for line in res:
                    if line and len(line) >= 2:
                        lines.append(line[1][0])
    print(f"[OCR] extracted {len(lines)} lines", flush=True)

    return {"text": "\n".join(lines)}
