/**
 * Server-side content extraction from uploaded files. Extracted text becomes
 * grounding context for DeepSeek generation.
 */

export interface ExtractedFile {
  name: string;
  kind: string;
  content: string;
}

const MAX_CHARS = 20000;

export const ACCEPTED_EXTENSIONS = [
  ".pdf", ".docx", ".pptx", ".csv", ".tsv", ".txt", ".md", ".json",
  ".png", ".jpg", ".jpeg", ".gif", ".webp", ".html", ".htm",
];

export const MAX_FILE_BYTES = 20 * 1024 * 1024;

export function fileKind(name: string): string {
  const ext = name.slice(name.lastIndexOf(".")).toLowerCase();
  switch (ext) {
    case ".pdf": return "pdf";
    case ".docx": return "document";
    case ".pptx": return "powerpoint";
    case ".csv":
    case ".tsv": return "data";
    case ".txt":
    case ".md": return "text";
    case ".json": return "data";
    case ".html":
    case ".htm": return "html";
    case ".png":
    case ".jpg":
    case ".jpeg":
    case ".gif":
    case ".webp": return "image";
    default: return "unknown";
  }
}

async function extractPdf(bytes: ArrayBuffer): Promise<string> {
  const { extractText, getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(new Uint8Array(bytes));
  const { text } = await extractText(pdf, { mergePages: true });
  return text;
}

async function extractDocx(bytes: ArrayBuffer): Promise<string> {
  const mammoth = await import("mammoth");
  const result = await mammoth.extractRawText({ buffer: Buffer.from(bytes) });
  return result.value;
}

/** Extract slide text from a .pptx (zip of XML) without a heavy parser. */
async function extractPptx(bytes: ArrayBuffer): Promise<string> {
  const JSZip = (await import("jszip")).default;
  const zip = await JSZip.loadAsync(bytes);
  const slideFiles = Object.keys(zip.files)
    .filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n))
    .sort((a, b) => {
      const na = Number(a.match(/slide(\d+)/)?.[1] ?? 0);
      const nb = Number(b.match(/slide(\d+)/)?.[1] ?? 0);
      return na - nb;
    });

  const parts: string[] = [];
  for (const name of slideFiles) {
    const xml = await zip.files[name].async("text");
    const texts = [...xml.matchAll(/<a:t>([^<]*)<\/a:t>/g)].map((m) => decodeXml(m[1]));
    const slideNum = name.match(/slide(\d+)/)?.[1];
    if (texts.length) parts.push(`[Slide ${slideNum}]\n${texts.join("\n")}`);
  }
  return parts.join("\n\n");
}

function decodeXml(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function extractCsv(text: string): string {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length > 120) {
    return [...lines.slice(0, 100), `... (${lines.length - 100} more rows)`].join("\n");
  }
  return lines.join("\n");
}

export async function extractContent(
  name: string,
  bytes: ArrayBuffer
): Promise<ExtractedFile> {
  const kind = fileKind(name);
  let content = "";

  try {
    switch (kind) {
      case "pdf":
        content = await extractPdf(bytes);
        break;
      case "document":
        content = await extractDocx(bytes);
        break;
      case "powerpoint":
        content = await extractPptx(bytes);
        break;
      case "data":
        content = extractCsv(new TextDecoder().decode(bytes));
        break;
      case "text":
      case "html":
        content = new TextDecoder().decode(bytes);
        break;
      case "image":
        // Images are uploaded to storage separately; here we just note it.
        content = `(Image file "${name}" — available to place on slides.)`;
        break;
      default:
        throw new Error(`Unsupported file type: ${name}`);
    }
  } catch (e) {
    throw new Error(
      `Could not read "${name}": ${e instanceof Error ? e.message : "unknown error"}`
    );
  }

  content = content.replace(/\s{3,}/g, "  ").trim();
  if (!content) throw new Error(`"${name}" appears to be empty.`);
  if (content.length > MAX_CHARS) {
    content = content.slice(0, MAX_CHARS) + "\n... (content truncated)";
  }
  return { name, kind, content };
}
