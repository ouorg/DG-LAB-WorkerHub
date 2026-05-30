export const sql = {
  insertSession: `
    INSERT INTO sessions (id, user_id, kind, state, token_hash, created_at, updated_at, expires_at)
    VALUES (?, ?, 'login', 'active', ?, ?, ?, ?)
  `,
  insertDevice: `
    INSERT INTO devices (id, owner_user_id, name, app_token, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `,
  selectDevice: `
    SELECT id, owner_user_id, name, app_token, created_at
    FROM devices
    WHERE id = ?
  `,
  selectDevicesByOwner: `
    SELECT id, owner_user_id, name, app_token, created_at
    FROM devices
    WHERE owner_user_id = ?
    ORDER BY created_at
  `,
  insertAuditLog: `
    INSERT INTO audit_logs (id, user_id, device_id, source, action, request_json, created_at)
    VALUES (?, ?, ?, 'worker', ?, ?, ?)
  `,
  selectAuditLogsByDevice: `
    SELECT id, device_id, user_id, action, request_json, created_at
    FROM audit_logs
    WHERE device_id = ?
    ORDER BY created_at DESC
    LIMIT 100
  `,
  upsertDeviceBinding: `
    INSERT INTO device_bindings (id, device_id, client_id, target_id, state, created_at, updated_at)
    VALUES (?, ?, ?, ?, 'active', ?, ?)
    ON CONFLICT(device_id) DO UPDATE SET
      client_id = excluded.client_id,
      target_id = excluded.target_id,
      state = 'active',
      updated_at = excluded.updated_at
  `,
  closeDeviceBinding: `
    UPDATE device_bindings
    SET state = 'closed', updated_at = ?
    WHERE device_id = ?
  `
} as const;
