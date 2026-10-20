# Quarry

A retrieval-augmented chat over your own documents. Import a PDF, let it be
split into chapters and chunks, then ask questions of any folder. Everything
runs in the browser, and the model is called with your own Groq key.

## Why it works this way

There is no server in the loop. Not for the documents, not for the key.

- **PDFs are parsed on your device.** PDF.js reads the file, the outline
  becomes chapter folders, and every chapter is split into overlapping chunks.
- **The library is stored in IndexedDB.** Folders, documents, chunks and their
  vectors live in your browser, and nowhere else.
- **Retrieval is local.** BM25 runs over the chunk tokens, and a small
  sentence-transformer (`all-MiniLM-L6-v2`, ~23 MB) runs in WebAssembly to
  embed the chunks and the question. The model is downloaded once and cached.
- **The model call is BYOK.** Your Groq key is stored on your device and sent
  only to `api.groq.com`.

## Getting started

```bash
npm install
npm run dev
```

Then open the app, add your Groq key under **API key**, and import a PDF.

The key is verified against Groq before it is saved, so a typo is caught now
rather than at the first question.

## Light and dark

The app follows your system by default, and the switch in the navigation bar
sets it to light or dark outright. The choice is stored on your device and
applied before the first paint, so there is no flash of the wrong theme when
the page loads.

The palette keeps its meaning in both themes. `text-charcoal` is always the
main text colour and `bg-paper-white` is always the raised surface, whatever
the theme - the values behind those names change, the roles do not.

## The folder is an editor

The folder page is three columns, the way a text editor is put together:

```
┌────────────┬────────────────────────┬──────────────┐
│  Explorer  │      The passage        │     Chat     │
│            │                        │              │
│ documents  │  read it, rewrite it,   │  ask it      │
│ chapters   │  move it, pin it       │              │
│ passages   │                        │              │
└────────────┴────────────────────────┴──────────────┘
```

Everything happens on one screen. A PDF can be dropped anywhere on the page,
a passage opened and rewritten, and a question asked without leaving the
folder. The chat is a panel beside the work, not a separate page.

A passage is the unit of the library, so it is the unit of the screen. It can
be edited, moved between chapters, pinned, excluded, added and deleted. An
edit re-embeds the passage, so the search keeps describing what it now says.

## How a question is answered

The agent has two ways of reaching the library, and it uses both.

1. **The vector search** embeds the question and finds the passages that mean
   the right thing, blended with BM25 over the chunk tokens.
2. **The shell** reaches the same passages as files, mounted under
   `/workspace` as one markdown file per passage, so the agent can `grep` an
   exact term, `ls` the chapters, or `cat` a passage in full.

The shell runs entirely in the browser, in an in-memory filesystem
(`just-bash`). Nothing is written to disk and nothing leaves the machine.

If the best match is weak, the model is asked whether the passages answer the
question and, if not, for a better search query. Up to three rounds.

**Only the passages the answer actually used are cited.** The answer is
scanned for its `[1]`, `[2]` markers and the sources list is filtered down to
those, so a question that leans on one passage shows one source.

## The context panel

Every passage in a folder has one of three states:

| State      | Meaning                                        |
| ---------- | ---------------------------------------------- |
| `auto`     | the retriever decides, on the score            |
| `pinned`   | always sent to the model, whatever the score   |
| `excluded` | never sent to the model                        |

Pin a passage to force it in, exclude one to keep it out. Both are per
folder, and both survive the conversation.

## Managing the library

The library is a tree of folders, and a folder is the unit you chat with.

```
/                          the library: a card for every folder
/folder/<id>               the editor: the passages, and the chat beside them
```

**A folder** holds documents. It can be renamed, moved, nested under another
folder, or deleted - and the delete says what will go with it.

**A document** is a PDF that was split into chapters and passages. It can be
moved to another folder, or deleted. Moving one carries its passages with it.

**The import containers are not yours to manage.** When a PDF is imported it
brings a folder for the document and a folder per chapter, and the passages
live in those. They stay out of the tree and out of the move picker: the
document is what you put in a folder, and that is what you see.

## Layout of the code

```
src/
  app/
    page.tsx                    the library dashboard
    folder/[folder]/page.tsx    the editor
  components/
    chat/                       the conversation, the prompt
    layout/                     the nav, the settings, the progress popup
    library/                    the explorer, the passage pane, the drop zone
  lib/
    library/                    the model, the IndexedDB store, the importer
    retrieval/                  the tokenizer, the embeddings, the hybrid search
    groq/                       the BYOK client and the retrieval agent
    shell/                      the in-browser bash over the passages
    pdf.ts                      PDF.js extraction and chunking
```

## Scripts

| Command         | What it does                       |
| --------------- | ---------------------------------- |
| `npm run dev`   | the development server             |
| `npm run build` | the production build               |
| `npm run start` | the production server              |
| `npm run lint`  | eslint                             |
