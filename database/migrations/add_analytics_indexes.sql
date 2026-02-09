-- Analytics performance indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_tenant_created_status 
  ON orders(tenant_id, created_at, status);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_tenant_created_completed 
  ON orders(tenant_id, created_at) WHERE status = 'completed';

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_order_items_order_menu 
  ON order_items(order_id, menu_item_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_reviews_tenant_created_sentiment 
  ON reviews(tenant_id, created_at, sentiment);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ai_usage_tenant_created_operation 
  ON ai_usage(tenant_id, created_at, operation);
