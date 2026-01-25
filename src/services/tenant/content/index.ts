/**
 * Content Module Index
 *
 * Exports all content planner services and types
 */

// Content calendar service
export {
  ContentCalendarService,
  ContentEntry,
  MediaAsset,
  PlatformCaption,
  ContentCampaign,
  CampaignGoals,
  BrandGuidelines,
  ContentFilters,
  CreateContentDTO,
  UpdateContentDTO,
  CreateCampaignDTO,
} from './content-calendar.service';

// Content generator service
export {
  ContentGeneratorService,
  ContentIdea,
  CaptionParams,
  ScriptParams,
  GeneratedScript,
  ScriptScene,
  HashtagSuggestion,
  OptimalPostingTime,
} from './content-generator.service';

// Social publisher service
export {
  SocialPublisherService,
  SocialAccount,
  ConnectAccountDTO,
  PublishResult,
  AccountStats,
} from './social-publisher.service';

// Trending service
export {
  TrendingService,
  TrendingItem,
  TrendingSound,
  TrendingHashtag,
  TrendingChallenge,
  TrendFilters,
} from './trending.service';
