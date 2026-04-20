from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

from markitdown import MarkItDown
from pypdf import PdfReader


SUPPORTED_EXTENSIONS = {
    ".pdf",
    ".docx",
    ".html",
    ".htm",
    ".txt",
    ".md",
    ".csv",
    ".tsv",
    ".xml",
}

PDF_EXTENSIONS = {".pdf"}


def normalize_markdown(value: str | None) -> str:
    return (
        str(value or "")
        .replace("\r\n", "\n")
        .replace("\r", "\n")
        .strip()
    )


def strip_markdown_formatting(value: str) -> str:
    text = str(value or "")
    text = re.sub(r"```[\s\S]*?```", " ", text)
    text = re.sub(r"`([^`]*)`", r"\1", text)
    text = re.sub(r"!\[[^\]]*\]\([^)]+\)", " ", text)
    text = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", text)
    text = re.sub(r"(^|\s)[#>*_\-\|`~]+", " ", text)
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def has_usable_text(value: str | None) -> bool:
    candidate = strip_markdown_formatting(normalize_markdown(value or ""))
    return bool(re.search(r"[A-Za-z0-9]", candidate))


def get_title(path: Path) -> str:
    return path.stem.strip() or "Untitled document"


def wrap_plain_text_as_markdown(path: Path, text: str) -> str:
    normalized_text = normalize_markdown(text)
    lines = [f"# {get_title(path)}", "", normalized_text]
    return normalize_markdown("\n".join(lines))


def run_markitdown(path: Path) -> dict:
    converter = MarkItDown(enable_plugins=False)
    result = converter.convert_local(str(path))
    markdown = normalize_markdown(getattr(result, "markdown", None) or str(result))
    return {
        "converter": "markitdown",
        "markdown": markdown,
        "usable": has_usable_text(markdown),
        "title": getattr(result, "title", None),
    }


def extract_pdf_text_with_pypdf(path: Path) -> dict:
    reader = PdfReader(str(path))
    page_text = []
    for page in reader.pages:
        extracted = page.extract_text() or ""
        normalized = normalize_markdown(extracted)
        if normalized:
            page_text.append(normalized)

    combined = "\n\n".join(page_text)
    markdown = wrap_plain_text_as_markdown(path, combined) if has_usable_text(combined) else ""
    return {
        "converter": "pypdf",
        "markdown": markdown,
        "usable": has_usable_text(markdown),
        "page_count": len(reader.pages),
        "text_length": len(combined),
    }


def convert_document(path: Path) -> dict:
    extension = path.suffix.lower()
    if extension not in SUPPORTED_EXTENSIONS:
        raise ValueError("This file type is not supported yet. Please use PDF, DOCX, HTML, or TXT.")

    attempts = []

    try:
        primary = run_markitdown(path)
        attempts.append({
            "converter": primary["converter"],
            "usable": primary["usable"],
            "markdown_length": len(primary["markdown"]),
        })
        if primary["usable"]:
            return {
                "status": "success",
                "markdown": primary["markdown"],
                "converter": primary["converter"],
                "attempts": attempts,
            }
    except Exception as error:  # pragma: no cover - surfaced through JSON
        attempts.append({
            "converter": "markitdown",
            "usable": False,
            "error": str(error),
        })

    if extension in PDF_EXTENSIONS:
        try:
            fallback = extract_pdf_text_with_pypdf(path)
            attempts.append({
                "converter": fallback["converter"],
                "usable": fallback["usable"],
                "markdown_length": len(fallback["markdown"]),
                "page_count": fallback["page_count"],
                "text_length": fallback["text_length"],
            })
            if fallback["usable"]:
                return {
                    "status": "success",
                    "markdown": fallback["markdown"],
                    "converter": fallback["converter"],
                    "attempts": attempts,
                }
        except Exception as error:  # pragma: no cover - surfaced through JSON
            attempts.append({
                "converter": "pypdf",
                "usable": False,
                "error": str(error),
            })

        return {
            "status": "ocr_required",
            "error": "No extractable text was found in this PDF. It appears to be scanned or image-based and needs OCR fallback.",
            "attempts": attempts,
        }

    return {
        "status": "error",
        "error": "MarkItDown could not extract usable text from this file.",
        "attempts": attempts,
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True)
    args = parser.parse_args()

    path = Path(args.input)
    try:
        result = convert_document(path)
    except Exception as error:
        result = {
            "status": "error",
            "error": str(error),
            "attempts": [],
        }

    sys.stdout.write(json.dumps(result, ensure_ascii=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
