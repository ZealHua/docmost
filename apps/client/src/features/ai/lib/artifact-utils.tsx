import {
  IconFileCode,
  IconFileTypeJs,
  IconFileTypeTsx,
  IconMarkdown,
  IconFile,
  IconBrandHtml5,
  IconBrandCss3,
} from "@tabler/icons-react";
import { ReactNode } from "react";

export const extensionMap: Record<string, string> = {
  ".html": "html",
  ".htm": "html",
  ".js": "javascript",
  ".jsx": "javascript",
  ".mjs": "javascript",
  ".cjs": "javascript",
  ".ts": "typescript",
  ".tsx": "typescript",
  ".json": "json",
  ".css": "css",
  ".scss": "scss",
  ".md": "markdown",
  ".markdown": "markdown",
  ".skill": "markdown",
  ".py": "python",
  ".rb": "ruby",
  ".go": "go",
  ".rs": "rust",
  ".java": "java",
  ".c": "c",
  ".cpp": "cpp",
  ".h": "c",
  ".hpp": "cpp",
  ".sh": "bash",
  ".bash": "bash",
  ".zsh": "bash",
  ".sql": "sql",
  ".xml": "xml",
  ".yaml": "yaml",
  ".yml": "yaml",
  ".toml": "toml",
  ".svg": "svg",
  ".png": "image",
  ".jpg": "image",
  ".jpeg": "image",
  ".gif": "image",
  ".txt": "text",
  ".log": "text",
};

export interface CodeFileCheck {
  isCodeFile: boolean;
  language: string;
}

export function checkCodeFile(filepath: string): CodeFileCheck {
  const ext = getFileExtension(filepath);
  const language = extensionMap[ext] || "text";

  const isCodeFile =
    language !== "text" &&
    language !== "markdown" &&
    language !== "image" &&
    ext !== "";

  return {
    isCodeFile,
    language,
  };
}

export function getFileExtension(filepath: string): string {
  const match = filepath.match(/\.[^.]+$/);
  return match ? match[0].toLowerCase() : "";
}

export function getFileName(filepath: string): string {
  const withoutPrefix = filepath.replace(/^write-file:/, "");
  const parts = withoutPrefix.split("/");
  return parts[parts.length - 1] || filepath;
}

export function getFileExtensionDisplayName(filepath: string): string {
  const ext = getFileExtension(filepath);
  const displayNames: Record<string, string> = {
    ".html": "HTML",
    ".htm": "HTML",
    ".js": "JavaScript",
    ".jsx": "JavaScript",
    ".mjs": "JavaScript",
    ".cjs": "JavaScript",
    ".ts": "TypeScript",
    ".tsx": "TypeScript",
    ".css": "CSS",
    ".md": "Markdown",
    ".skill": "Skill",
    ".py": "Python",
    ".json": "JSON",
    ".svg": "SVG",
  };

  return displayNames[ext] || (ext ? ext.slice(1).toUpperCase() : "File");
}

export function isWriteFileArtifact(filepath: string): boolean {
  return filepath.startsWith("write-file:");
}

export function isSkillFile(filepath: string): boolean {
  return filepath.endsWith(".skill");
}

export function isPreviewable(filepath: string): boolean {
  const ext = getFileExtension(filepath);
  return (
    ext === ".html" || ext === ".htm" || ext === ".md" || ext === ".markdown"
  );
}

export function getFileIcon(
  filepath: string,
  size: string = "size-6",
): ReactNode {
  const ext = getFileExtension(filepath);

  const iconProps = {
    className: size,
    size: 24,
  };

  const iconMap: Record<string, ReactNode> = {
    ".html": <IconBrandHtml5 {...iconProps} />,
    ".htm": <IconBrandHtml5 {...iconProps} />,
    ".js": <IconFileTypeJs {...iconProps} />,
    ".jsx": <IconFileTypeJs {...iconProps} />,
    ".mjs": <IconFileTypeJs {...iconProps} />,
    ".cjs": <IconFileTypeJs {...iconProps} />,
    ".ts": <IconFileTypeTsx {...iconProps} />,
    ".tsx": <IconFileTypeTsx {...iconProps} />,
    ".css": <IconBrandCss3 {...iconProps} />,
    ".scss": <IconBrandCss3 {...iconProps} />,
    ".md": <IconMarkdown {...iconProps} />,
    ".markdown": <IconMarkdown {...iconProps} />,
    ".skill": <IconFileCode {...iconProps} />,
    ".json": <IconFileTypeJs {...iconProps} />,
    ".svg": <IconFileCode {...iconProps} />,
  };

  const codeFile = checkCodeFile(filepath);
  if (codeFile.isCodeFile) {
    return <IconFileCode {...iconProps} />;
  }

  return iconMap[ext] || <IconFile {...iconProps} />;
}

export interface ArtifactUrlOptions {
  filepath: string;
  sessionId: string;
  download?: boolean;
}

export function urlOfArtifact({
  filepath,
  sessionId,
  download,
}: ArtifactUrlOptions): string {
  const encodedPath = encodeURIComponent(filepath);
  const baseUrl = `/api/ai/sessions/${sessionId}/artifacts/${encodedPath}`;
  return download ? `${baseUrl}?download=true` : baseUrl;
}
