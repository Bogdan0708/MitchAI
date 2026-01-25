/**
 * Reviews Module Index
 *
 * Exports all review management services and types
 */

// Review aggregator service
export {
  ReviewAggregatorService,
  AggregatedReview,
  PlatformCredentials,
  PlatformConnection,
  SyncResult,
  ReviewFilters,
  ExportParams,
} from './review-aggregator.service';

// Review analysis service
export {
  ReviewAnalysisService,
  SentimentAnalysis,
  AspectSentiment,
  TopicExtraction,
  ComplianceFlag,
  AnalysisResult,
  TopicTrend,
  SentimentTrend,
  CorrelationResult,
} from './review-analysis.service';

// Review response service
export {
  ReviewResponseService,
  ResponseTemplate,
  TemplateVariable,
  CreateTemplateDTO,
  UpdateTemplateDTO,
  GenerateResponseParams,
  GeneratedResponse,
} from './review-response.service';

// Review insights service
export {
  ReviewInsightsService,
  ReviewInsights,
  TopicInsight,
  Recommendation,
  DashboardStats,
  LocationComparison,
  PlatformStats,
} from './review-insights.service';
