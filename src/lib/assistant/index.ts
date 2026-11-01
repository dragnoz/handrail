export type { Assistant, AskPayload, Card, FeedEntry, NotePayload, Notice, Reply } from './types';
export { AssistantError, parseCard, parseFeed, parseNotices, parseReply, absolute, sameOrigin, hostOf } from './parse';
export { looksLikeKey } from './guard';
export { fetchCard, fetchFeed, fetchNotices, fetchGuideText, postAsk, postNote, type Target } from './client';
export { guideForPage, newCount, noteText, noteFileName, mailtoFor } from './notes';
