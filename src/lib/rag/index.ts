export {
  buildProductHeader,
  chunkProduct,
  estimateTokenCount,
  hashContent,
  splitIntoSections,
  splitLongBody,
  type ChunkProductOptions,
  type ProductChunkDraft,
  type RagProductInput,
} from "./chunk-product";

export {
  buildRagContext,
  buildSiteRagContext,
  formatEuroFromCents,
  groupChunksByProduct,
  retrieveAll,
  retrieveProductChunks,
  retrieveSiteChunks,
  type MatchFilters,
  type RetrievedProduct,
  type RetrievedProductChunk,
  type RetrievedSiteChunk,
} from "./retrieve";

export { chunkSiteDoc, chunkStores, type SiteChunkDraft, type SiteDocInput } from "./chunk-site";

export { createRagChatSseStream, type ChatMessage, type ChatRequestBody } from "./chat-stream";

export {
  streamRagChat,
  type ChatUiMessage,
  type RagMetaProduct,
  type StreamChatHandlers,
} from "./client-chat";
