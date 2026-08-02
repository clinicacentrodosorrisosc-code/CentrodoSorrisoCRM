-- ============================================================
-- Migration 038: Add QR Code WhatsApp connection support to `whatsapp_config`.
-- Supports connecting WhatsApp via QR Code (WhatsApp Web / Baileys / Evolution API)
-- alongside Meta Cloud API.
-- ============================================================

ALTER TABLE whatsapp_config
  ADD COLUMN IF NOT EXISTS connection_type text NOT NULL DEFAULT 'cloud_api'
    CHECK (connection_type IN ('cloud_api', 'qrcode')),
  ADD COLUMN IF NOT EXISTS qrcode_status text NOT NULL DEFAULT 'disconnected'
    CHECK (qrcode_status IN ('disconnected', 'connecting', 'qrcode_ready', 'connected')),
  ADD COLUMN IF NOT EXISTS qrcode_raw text,
  ADD COLUMN IF NOT EXISTS qrcode_url text,
  ADD COLUMN IF NOT EXISTS qrcode_instance_id text,
  ADD COLUMN IF NOT EXISTS qrcode_api_url text,
  ADD COLUMN IF NOT EXISTS qrcode_api_key text,
  ADD COLUMN IF NOT EXISTS connected_phone text,
  ADD COLUMN IF NOT EXISTS connected_name text,
  ADD COLUMN IF NOT EXISTS connected_avatar text;

-- Index for fast lookup by connection_type
CREATE INDEX IF NOT EXISTS idx_whatsapp_config_connection_type
  ON whatsapp_config (account_id, connection_type);
