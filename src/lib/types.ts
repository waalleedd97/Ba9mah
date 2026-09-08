/** أنواع مشتركة بين السيرفر والواجهة — لا تستورد أي وحدة Node هنا */

export type Rating = 'liked' | 'disliked';
export type PostKind = 'generated' | 'seed' | 'reference' | 'imported' | 'own';
export type RuleKind = 'golden' | 'avoid' | 'image_style' | 'image_avoid';
export type RuleSource = 'onboarding' | 'manual' | 'learned' | 'imported';
export type ImageSource = 'post' | 'saved' | 'studio';
export type RoundStatus = 'rating' | 'done';

export interface Post {
  id: string;
  roundId: number | null;
  position: number | null;
  kind: PostKind;
  content: string;
  originalContent: string | null;
  topic: string;
  angle: string | null;
  hookType: string | null;
  exploratory: boolean;
  rating: Rating | null;
  ratedAt: number | null;
  verified: boolean;
  verificationNote: string | null;
  selectedImageId: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface ImageRecord {
  id: string;
  postId: string | null;
  savedPostId: string | null;
  source: ImageSource;
  styleKey: string | null;
  styleLabel: string | null;
  prompt: string;
  headline: string | null;
  mime: string;
  bytes: number;
  selected: boolean;
  rating: Rating | null;
  ratedAt: number | null;
  createdAt: number;
  /** مسار العرض عبر API */
  url: string;
}

export interface Rule {
  id: number;
  kind: RuleKind;
  text: string;
  source: RuleSource;
  active: boolean;
  createdAt: number;
}

/** ملخص خبر بحث عنه النظام (أو قرأه من رابط) قبل كتابة جولة عنه */
export interface NewsBrief {
  headline: string;
  brief: string;
  sources: Array<{ title: string; url: string }>;
  /** هل استُخدم البحث في الويب فعلاً؟ (غير متاح على الحصة المجانية) */
  searched: boolean;
  note: string | null;
}

export interface Round {
  id: number;
  topic: string | null;
  exploratory: number;
  status: RoundStatus;
  news: NewsBrief | null;
  createdAt: number;
  completedAt: number | null;
}

export interface StyleProfileData {
  summary: string;
  voice: string;
  structure: string;
  length: string;
  hooks: string[];
  formatting: string;
  vocabulary: string[];
  signature_moves: string[];
  do_not: string[];
  topics_that_work: string[];
  confidence: 'low' | 'medium' | 'high';
}

export interface StyleProfile {
  id: number;
  version: number;
  markdown: string;
  data: StyleProfileData;
  likedCount: number;
  dislikedCount: number;
  createdAt: number;
}

export interface SavedPost {
  id: string;
  postId: string | null;
  content: string;
  topic: string;
  imageId: string | null;
  image: ImageRecord | null;
  createdAt: number;
  updatedAt: number;
}

export interface StyleStat {
  styleKey: string;
  shown: number;
  selected: number;
  liked: number;
  disliked: number;
}

export interface ImageStylePreset {
  key: string;
  label: string;
  prompt: string;
}

export interface AppStats {
  spec: string;
  onboarded: boolean;
  liked: number;
  disliked: number;
  /** نصوص كتبها المستخدم بنفسه */
  own: number;
  rounds: number;
  goldenRules: number;
  avoidRules: number;
  imageRules: number;
  saved: number;
  profileVersion: number | null;
  profileConfidence: StyleProfileData['confidence'] | null;
  exploratoryNext: number;
  ratingsSinceProfile: number;
}

export interface PostWithImages extends Post {
  images: ImageRecord[];
  savedId: string | null;
}

export interface StyleOption {
  key: string;
  label: string;
}
