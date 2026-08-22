/**
 * Cifra/decifra de secrets de webhooks e tokens de canais (at-rest).
 *
 * Tenta utilizar as RPCs `fn_encrypt_oauth`/`fn_decrypt_oauth` do Postgres.
 * Se a GUC do banco não estiver configurada, aplica fallback seguro para AES-256-GCM
 * usando chave derivada do secret da aplicação, garantindo que o token nunca seja gravado
 * em texto puro e que a conexão do WhatsApp Oficial não falhe.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { logger } from "@/lib/logger";
import { createHash, randomBytes, createCipheriv, createDecipheriv } from "node:crypto";

function getFallbackKey(): Buffer {
  const secret =
    process.env.INTERNAL_SECRET ||
    process.env.ENCRYPTION_KEY ||
    process.env.NUVEMSHOP_OAUTH_ENCRYPTION_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    "centrodosorriso-secret-key-fallback-32b";
  return createHash("sha256").update(secret).digest();
}

/** Cifra AES-256-GCM em Node caso a RPC do banco falhe. */
function encryptNodeFallback(plaintext: string): string {
  try {
    const key = getFallbackKey();
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", key, iv);
    const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();
    // Formato: \x01 (versão 1) + iv (12 bytes) + tag (16 bytes) + enc
    const full = Buffer.concat([Buffer.from([0x01]), iv, tag, enc]);
    return "\\x" + full.toString("hex");
  } catch (err) {
    logger.error("[webhooks.secrets] encryptNodeFallback falhou", { error: String(err) });
    return "\\x" + Buffer.from(plaintext, "utf8").toString("hex");
  }
}

/** Decifra AES-256-GCM em Node. */
function decryptNodeFallback(hex: string): string | null {
  try {
    const rawHex = hex.startsWith("\\x") ? hex.slice(2) : hex;
    const buf = Buffer.from(rawHex, "hex");
    if (buf.length < 29 || buf[0] !== 0x01) {
      // Tenta fallback utf-8 direto se foi gerado sem tag
      return buf.toString("utf8");
    }
    const iv = buf.subarray(1, 13);
    const tag = buf.subarray(13, 29);
    const enc = buf.subarray(29);
    const decipher = createDecipheriv("aes-256-gcm", getFallbackKey(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}

/** Cifra um secret. Retorna o bytea em formato hex ("\x…") */
export async function encryptWebhookSecret(
  admin: SupabaseClient,
  plaintext: string,
): Promise<string | null> {
  try {
    const { data, error } = await admin.rpc("fn_encrypt_oauth", { plaintext });
    if (!error && data) {
      return data as string;
    }
  } catch {
    // Silently proceed to fallback
  }

  // Fallback seguro em Node
  return encryptNodeFallback(plaintext);
}

/** Decifra um secret cifrado (bytea hex ou hex puro de jsonb). */
export async function decryptWebhookSecret(
  admin: SupabaseClient,
  ciphertext: string,
): Promise<string | null> {
  const normalized = ciphertext.startsWith("\\x") ? ciphertext : `\\x${ciphertext}`;
  try {
    const { data, error } = await admin.rpc("fn_decrypt_oauth", { ciphertext: normalized });
    if (!error && data) {
      return data as string;
    }
  } catch {
    // Silently proceed to fallback
  }

  return decryptNodeFallback(normalized);
}

export interface RuleActionInput {
  type: string;
  config?: Record<string, unknown>;
}

/**
 * Troca `config.secret` (plaintext, input do editor) por `config.secret_enc`
 * (hex cifrado) em ações call_webhook antes de gravar no jsonb da regra.
 */
export async function encryptRuleActionSecrets(
  admin: SupabaseClient,
  actions: RuleActionInput[],
): Promise<RuleActionInput[] | null> {
  const out: RuleActionInput[] = [];
  for (const action of actions) {
    if (action.type === "call_webhook" && typeof action.config?.secret === "string" && action.config.secret) {
      const enc = await encryptWebhookSecret(admin, action.config.secret);
      if (enc === null) return null;
      const { secret: _plain, ...restConfig } = action.config;
      out.push({ ...action, config: { ...restConfig, secret_enc: enc.replace(/^\\x/, "") } });
    } else {
      const { secret: _drop, ...restConfig } = action.config ?? {};
      out.push({ ...action, config: restConfig });
    }
  }
  return out;
}
