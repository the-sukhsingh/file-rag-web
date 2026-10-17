"use client";

import * as React from "react";
import {
  FileIcon,
  FileCodeIcon,
  FileTextIcon,
  FileJsonIcon,
  FolderIcon,
  FolderOpenIcon,
  PlusIcon,
  Trash2Icon,
  Edit2Icon,
  SearchIcon,
  UploadIcon,
  RotateCcwIcon,
  MoreVerticalIcon,
  FolderPlusIcon,
  FilePlusIcon,
} from "lucide-react";

import { VirtualFile, detectLanguage } from "./types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface FileExplorerProps {
  files: VirtualFile[];
  selectedFileId: string | null;
  onSelectFile: (file: VirtualFile) => void;
  onAddFile: (file: { name: string; path: string; content: string; language: string }) => void;
  onRemoveFile: (id: string) => void;
  onRenameFile: (id: string, newName: string, newPath: string) => void;
  onResetFiles?: () => void;
}

function getFileIcon(filename: string) {
  const ext = filename.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "ts":
    case "tsx":
    case "js":
    case "jsx":
      return <FileCodeIcon className="size-4 text-blue-500 shrink-0" />;
    case "json":
      return <FileJsonIcon className="size-4 text-yellow-500 shrink-0" />;
    case "md":
    case "markdown":
    case "txt":
      return <FileTextIcon className="size-4 text-emerald-500 shrink-0" />;
    case "css":
    case "scss":
      return <FileCodeIcon className="size-4 text-cyan-500 shrink-0" />;
    default:
      return <FileIcon className="size-4 text-muted-foreground shrink-0" />;
  }
}

export function FileExplorer({
  files,
  selectedFileId,
  onSelectFile,
  onAddFile,
  onRemoveFile,
  onRenameFile,
  onResetFiles,
}: FileExplorerProps) {
  const [search, setSearch] = React.useState("");
  const [collapsedFolders, setCollapsedFolders] = React.useState<Record<string, boolean>>({});

  // Dialog States
  const [isNewFileDialogOpen, setIsNewFileDialogOpen] = React.useState(false);
  const [newFileName, setNewFileName] = React.useState("");
  const [newFilePath, setNewFilePath] = React.useState("");
  const [newFileContent, setNewFileContent] = React.useState("");

  const [isNewFolderDialogOpen, setIsNewFolderDialogOpen] = React.useState(false);
  const [newFolderName, setNewFolderName] = React.useState("");

  // Rename Dialog State
  const [fileToRename, setFileToRename] = React.useState<VirtualFile | null>(null);
  const [renameValue, setRenameValue] = React.useState("");

  // Delete Alert Dialog State
  const [fileToDelete, setFileToDelete] = React.useState<VirtualFile | null>(null);

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const toggleFolder = (folderName: string) => {
    setCollapsedFolders((prev) => ({
      ...prev,
      [folderName]: !prev[folderName],
    }));
  };

  const handleCreateFile = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = newFileName.trim();
    if (!trimmedName) return;

    const fullPath = newFilePath.trim()
      ? `${newFilePath.trim().replace(/\/$/, "")}/${trimmedName}`
      : trimmedName;

    const lang = detectLanguage(trimmedName);
    onAddFile({
      name: trimmedName,
      path: fullPath,
      content: newFileContent || `// ${trimmedName}\n`,
      language: lang,
    });

    setNewFileName("");
    setNewFilePath("");
    setNewFileContent("");
    setIsNewFileDialogOpen(false);
  };

  const handleCreateFolder = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newFolderName.trim();
    if (!trimmed) return;

    // Create a placeholder .gitkeep inside folder so it appears in explorer
    const placeholderName = ".gitkeep";
    const fullPath = `${trimmed}/${placeholderName}`;
    onAddFile({
      name: placeholderName,
      path: fullPath,
      content: "",
      language: "plaintext",
    });

    setNewFolderName("");
    setIsNewFolderDialogOpen(false);
  };

  const handleRenameConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fileToRename) return;
    const trimmed = renameValue.trim();
    if (!trimmed) return;

    const parts = fileToRename.path.split("/");
    parts[parts.length - 1] = trimmed;
    const newPath = parts.join("/");

    onRenameFile(fileToRename.id, trimmed, newPath);
    setFileToRename(null);
    setRenameValue("");
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFiles = e.target.files;
    if (!uploadedFiles || uploadedFiles.length === 0) return;

    Array.from(uploadedFiles).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = (event.target?.result as string) || "";
        onAddFile({
          name: file.name,
          path: file.name,
          content: text,
          language: detectLanguage(file.name),
        });
      };
      reader.readAsText(file);
    });

    e.target.value = "";
  };

  // Group files by root folder / directory
  const filteredFiles = files.filter(
    (f) =>
      f.name.toLowerCase().includes(search.toLowerCase()) ||
      f.path.toLowerCase().includes(search.toLowerCase())
  );

  // Organize into folder groups
  const groups: { [key: string]: VirtualFile[] } = {};
  filteredFiles.forEach((file) => {
    const parts = file.path.split("/");
    const folder = parts.length > 1 ? parts.slice(0, parts.length - 1).join("/") : "";
    if (!groups[folder]) {
      groups[folder] = [];
    }
    groups[folder].push(file);
  });

  const sortedFolders = Object.keys(groups).sort((a, b) => {
    if (a === "") return 1;
    if (b === "") return -1;
    return a.localeCompare(b);
  });

  return (
    <div className="flex h-full w-full flex-col bg-sidebar text-sidebar-foreground border-r border-border select-none overflow-hidden">
      {/* Hidden File Input for uploading files */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={handleFileUpload}
      />

      {/* Explorer Header */}
      <div className="flex items-center justify-between border-b border-border/60 px-3 py-2.5">
        <div className="flex items-center gap-2">
          <FolderIcon className="size-4 text-primary" />
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Explorer
          </span>
          <Badge variant="secondary" className="px-1.5 py-0 text-[10px] h-4">
            {files.length}
          </Badge>
        </div>

        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger render={
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={() => setIsNewFileDialogOpen(true)}
                aria-label="New File"
              >
                <FilePlusIcon className="size-3.5" />
              </Button>
            } />
            <TooltipContent>New File</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger render={
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={() => setIsNewFolderDialogOpen(true)}
                aria-label="New Folder"
              >
                <FolderPlusIcon className="size-3.5" />
              </Button>
            } />
            <TooltipContent>New Folder</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger render={
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={() => fileInputRef.current?.click()}
                aria-label="Upload Files"
              >
                <UploadIcon className="size-3.5" />
              </Button>
            } />
            <TooltipContent>Upload Files</TooltipContent>
          </Tooltip>

          {onResetFiles && (
            <Tooltip>
              <TooltipTrigger render={
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={onResetFiles}
                  aria-label="Reset Files"
                >
                  <RotateCcwIcon className="size-3.5" />
                </Button>
              } />
              <TooltipContent>Reset to Sample Files</TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>

      {/* Search Bar */}
      <div className="p-2 border-b border-border/40">
        <div className="relative flex items-center">
          <SearchIcon className="absolute left-2.5 size-3.5 text-muted-foreground pointer-events-none" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search files..."
            className="h-7 pl-8 text-xs bg-muted/40"
          />
          {search && (
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={() => setSearch("")}
              className="absolute right-1 text-muted-foreground hover:text-foreground"
            >
              ×
            </Button>
          )}
        </div>
      </div>

      {/* File Tree List */}
      <ScrollArea className="flex-1 px-1 py-1.5">
        {filteredFiles.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-6 text-center text-xs text-muted-foreground">
            <p>No files found</p>
            {search && (
              <Button
                variant="link"
                size="sm"
                onClick={() => setSearch("")}
                className="mt-1 text-xs"
              >
                Clear filter
              </Button>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-0.5">
            {sortedFolders.map((folderPath) => {
              const isRoot = folderPath === "";
              const folderFiles = groups[folderPath];
              const isCollapsed = collapsedFolders[folderPath] || false;

              return (
                <div key={folderPath || "root-folder"} className="flex flex-col">
                  {!isRoot && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleFolder(folderPath)}
                      className="group flex h-7 w-full items-center justify-start gap-1.5 px-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60"
                    >
                      {isCollapsed ? (
                        <FolderIcon className="size-3.5 text-muted-foreground" />
                      ) : (
                        <FolderOpenIcon className="size-3.5 text-primary" />
                      )}
                      <span className="truncate">{folderPath}</span>
                      <span className="ml-auto text-[10px] text-muted-foreground/60">
                        {folderFiles.length}
                      </span>
                    </Button>
                  )}

                  {(!isCollapsed || isRoot) && (
                    <div className={!isRoot ? "ml-3.5 pl-1.5 border-l border-border/40 flex flex-col gap-0.5" : "flex flex-col gap-0.5"}>
                      {folderFiles.map((file) => {
                        const isSelected = selectedFileId === file.id;

                        return (
                          <div
                            key={file.id}
                            className={`group relative flex items-center justify-between rounded-md px-2 py-1 text-xs transition-colors cursor-pointer ${
                              isSelected
                                ? "bg-accent text-accent-foreground font-medium shadow-xs"
                                : "text-muted-foreground hover:bg-muted/70 hover:text-foreground"
                            }`}
                            onClick={() => onSelectFile(file)}
                          >
                            <div className="flex min-w-0 items-center gap-2">
                              {getFileIcon(file.name)}
                              <span className="truncate" title={file.path}>
                                {file.name}
                              </span>
                            </div>

                            {/* Item Actions */}
                            <div
                              className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <DropdownMenu>
                                <DropdownMenuTrigger render={
                                  <Button
                                    variant="ghost"
                                    size="icon-xs"
                                    className="size-5 p-0 text-muted-foreground hover:text-foreground"
                                  >
                                    <MoreVerticalIcon className="size-3" />
                                  </Button>
                                } />
                                <DropdownMenuContent align="end" className="w-36">
                                  <DropdownMenuItem
                                    onClick={() => {
                                      setFileToRename(file);
                                      setRenameValue(file.name);
                                    }}
                                  >
                                    <Edit2Icon className="size-3.5 mr-2" />
                                    Rename
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    variant="destructive"
                                    onClick={() => setFileToDelete(file)}
                                  >
                                    <Trash2Icon className="size-3.5 mr-2" />
                                    Delete
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </ScrollArea>

      {/* Explorer Footer summary */}
      <div className="border-t border-border/40 px-3 py-2 text-[11px] text-muted-foreground flex items-center justify-between">
        <span>{files.length} {files.length === 1 ? "file" : "files"}</span>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 text-[11px] px-2 text-muted-foreground hover:text-foreground"
          onClick={() => setIsNewFileDialogOpen(true)}
        >
          <PlusIcon className="size-3 mr-1" /> Add File
        </Button>
      </div>

      {/* New File Dialog */}
      <Dialog open={isNewFileDialogOpen} onOpenChange={setIsNewFileDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleCreateFile}>
            <DialogHeader>
              <DialogTitle>Create New File</DialogTitle>
              <DialogDescription>
                Enter the file name and optional folder path.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-3 py-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-foreground">File Name</label>
                <Input
                  autoFocus
                  required
                  placeholder="e.g. index.ts or styles.css"
                  value={newFileName}
                  onChange={(e) => setNewFileName(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-foreground">Folder Path (Optional)</label>
                <Input
                  placeholder="e.g. src/components"
                  value={newFilePath}
                  onChange={(e) => setNewFilePath(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsNewFileDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit">Create File</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* New Folder Dialog */}
      <Dialog open={isNewFolderDialogOpen} onOpenChange={setIsNewFolderDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleCreateFolder}>
            <DialogHeader>
              <DialogTitle>Create New Folder</DialogTitle>
              <DialogDescription>
                Enter the name or relative path of the new folder.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-3 py-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-foreground">Folder Name / Path</label>
                <Input
                  autoFocus
                  required
                  placeholder="e.g. src/hooks"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsNewFolderDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit">Create Folder</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Rename File Dialog */}
      <Dialog open={!!fileToRename} onOpenChange={(open) => !open && setFileToRename(null)}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleRenameConfirm}>
            <DialogHeader>
              <DialogTitle>Rename File</DialogTitle>
              <DialogDescription>
                Enter the new name for &quot;{fileToRename?.name}&quot;.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-3 py-4">
              <Input
                autoFocus
                required
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setFileToRename(null)}
              >
                Cancel
              </Button>
              <Button type="submit">Rename</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Alert Dialog */}
      <AlertDialog open={!!fileToDelete} onOpenChange={(open) => !open && setFileToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete &quot;{fileToDelete?.name}&quot;?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove &quot;{fileToDelete?.path}&quot;? This action will remove the file from your workspace.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setFileToDelete(null)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                if (fileToDelete) {
                  onRemoveFile(fileToDelete.id);
                  setFileToDelete(null);
                }
              }}
            >
              Delete File
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
