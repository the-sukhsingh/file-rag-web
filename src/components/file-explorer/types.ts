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

export type FileNode =
  | { type: "file"; name: string; path: string; file: VirtualFile }
  | { type: "folder"; name: string; path: string; children: FileNode[] };

export function buildFileTree(files: VirtualFile[]): FileNode[] {
  const root: FileNode[] = [];

  for (const file of files) {
    const parts = file.path.split("/").filter(Boolean);
    let currentLevel = root;
    let currentPath = "";

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isLast = i === parts.length - 1;
      currentPath = currentPath ? `${currentPath}/${part}` : part;

      if (isLast) {
        if (part === ".gitkeep") continue;
        currentLevel.push({
          type: "file",
          name: file.name,
          path: file.path,
          file,
        });
      } else {
        let existingFolder = currentLevel.find(
          (node): node is Extract<FileNode, { type: "folder" }> =>
            node.type === "folder" && node.name === part
        );

        if (!existingFolder) {
          existingFolder = {
            type: "folder",
            name: part,
            path: currentPath,
            children: [],
          };
          currentLevel.push(existingFolder);
        }

        currentLevel = existingFolder.children;
      }
    }
  }

  function sortNodes(nodes: FileNode[]) {
    nodes.sort((a, b) => {
      if (a.type !== b.type) {
        return a.type === "folder" ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });
    for (const node of nodes) {
      if (node.type === "folder") {
        sortNodes(node.children);
      }
    }
  }

  sortNodes(root);
  return root;
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
