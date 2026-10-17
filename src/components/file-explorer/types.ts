export interface VirtualFile {
  id: string;
  name: string;
  path: string;
  content: string;
  language: string;
  size?: number;
  updatedAt?: string;
}

export interface VirtualFolder {
  id: string;
  name: string;
  path: string;
  children: (VirtualFile | VirtualFolder)[];
}

export type FileSystemNode = VirtualFile | VirtualFolder;

export function isFolder(node: FileSystemNode): node is VirtualFolder {
  return "children" in node;
}

export function detectLanguage(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "ts":
    case "tsx":
      return "typescript";
    case "js":
    case "jsx":
      return "javascript";
    case "json":
      return "json";
    case "md":
    case "markdown":
      return "markdown";
    case "css":
      return "css";
    case "html":
      return "html";
    case "py":
      return "python";
    case "sql":
      return "sql";
    case "yaml":
    case "yml":
      return "yaml";
    default:
      return "plaintext";
  }
}
