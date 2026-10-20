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

## How a question is answered

1. The question is embedded and run through the same retriever as the
   documents.
2. BM25 and cosine similarity are blended into one score, so an exact
   identifier and a paraphrase both find their passage.
3. If the best match is weak, the model is asked whether the passages answer
   the question and, if not, for a better search query. Up to three rounds.
4. The model writes the answer from the retrieved passages and cites them.

The search never waits for the embedding model to download. Until the vectors
are ready, retrieval runs on BM25 alone and the answer is still correct - it
just matches on words rather than on meaning.

## The context panel

Every passage in a folder has one of three states:

| State      | Meaning                                        |
| ---------- | ---------------------------------------------- |
| `auto`     | the retriever decides, on the score            |
| `pinned`   | always sent to the model, whatever the score   |
| `excluded` | never sent to the model                        |

Pin a passage to force it in, exclude one to keep it out. Both are per
folder, and both survive the conversation.

## Layout of the code

```
src/
  app/
    page.tsx                  the library dashboard
    folder/[folder]/page.tsx  a folder and its chat
  components/
    chat/                     the conversation, the prompt, the context panel
    layout/                   the nav, the settings, the showcase card
    library/                  the tree, the providers, the import dialog
  lib/
    library/                  the model, the IndexedDB store, the importer
    retrieval/                the tokenizer, the embeddings, the hybrid search
    groq/                     the BYOK client and the retrieval agent
    pdf.ts                    PDF.js extraction and chunking
```

## Scripts

| Command         | What it does                       |
| --------------- | ---------------------------------- |
| `npm run dev`   | the development server             |
| `npm run build` | the production build               |
| `npm run start` | the production server              |
| `npm run lint`  | eslint                             |
