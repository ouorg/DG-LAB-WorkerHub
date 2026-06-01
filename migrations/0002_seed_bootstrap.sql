INSERT INTO settings (key, value, updated_at) VALUES
  ('bootstrap.completed', 'true', CURRENT_TIMESTAMP),
  ('app.name', 'DG-LAB Cloud Console', CURRENT_TIMESTAMP),
  ('security.max_strength_step', '10', CURRENT_TIMESTAMP),
  ('security.max_message_length', '1950', CURRENT_TIMESTAMP),
  ('security.session_ttl_minutes', '30', CURRENT_TIMESTAMP),
  ('security.qr_ttl_seconds', '180', CURRENT_TIMESTAMP),
  ('audit.hot_retention_days', '7', CURRENT_TIMESTAMP),
  ('audit.archive_enabled', 'true', CURRENT_TIMESTAMP)
ON CONFLICT(key) DO NOTHING;

INSERT INTO users (id, username, display_name, role, created_at, updated_at)
VALUES ('bootstrap', 'admin', 'Administrator', 'admin', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT(id) DO NOTHING;
