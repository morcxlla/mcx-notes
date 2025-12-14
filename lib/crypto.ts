// Client-side E2E encryption using Web Crypto API

const PBKDF2_ITERATIONS = 100000
const AES_KEY_LENGTH = 256
const SALT_LENGTH = 16
const NONCE_LENGTH = 12

export interface EncryptedData {
  encryptedContent: string // base64
  salt: string // base64
  nonce: string // base64
  authTag: string // base64
}

// Convert ArrayBuffer to base64
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

// Convert base64 to ArrayBuffer
function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes.buffer
}

// Derive encryption key from password
async function deriveKey(
  password: string,
  salt: Uint8Array
): Promise<CryptoKey> {
  const encoder = new TextEncoder()
  const passwordKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits', 'deriveKey']
  )

  const safeSalt = new Uint8Array(salt)

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: safeSalt.buffer,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    passwordKey,
    { name: 'AES-GCM', length: AES_KEY_LENGTH },
    false,
    ['encrypt', 'decrypt']
  )
}

// Encrypt content with password
export async function encryptContent(
  content: string,
  password: string
): Promise<EncryptedData> {
  const encoder = new TextEncoder()
  const data = encoder.encode(content)

  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH))
  const nonce = crypto.getRandomValues(new Uint8Array(NONCE_LENGTH))

  const key = await deriveKey(password, salt)

  // Encrypt data
  const encryptedBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: nonce },
    key,
    data
  )

  // AES-GCM includes auth tag in the last 16 bytes
  const encryptedBytes = new Uint8Array(encryptedBuffer)
  const tagLength = 16
  const ciphertext = encryptedBytes.slice(0, encryptedBytes.length - tagLength)
  const authTag = encryptedBytes.slice(encryptedBytes.length - tagLength)

  return {
    encryptedContent: arrayBufferToBase64(ciphertext.buffer),
    salt: arrayBufferToBase64(salt.buffer),
    nonce: arrayBufferToBase64(nonce.buffer),
    authTag: arrayBufferToBase64(authTag.buffer),
  }
}

// Decrypt content with password
export async function decryptContent(
  encryptedData: EncryptedData,
  password: string
): Promise<string> {
  const salt = new Uint8Array(base64ToArrayBuffer(encryptedData.salt))
  const nonce = new Uint8Array(base64ToArrayBuffer(encryptedData.nonce))
  const ciphertext = new Uint8Array(
    base64ToArrayBuffer(encryptedData.encryptedContent)
  )
  const authTag = new Uint8Array(base64ToArrayBuffer(encryptedData.authTag))

  // Combine ciphertext and auth tag for AES-GCM
  const encrypted = new Uint8Array(ciphertext.length + authTag.length)
  encrypted.set(ciphertext)
  encrypted.set(authTag, ciphertext.length)

  const key = await deriveKey(password, salt)

  try {
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: nonce },
      key,
      encrypted
    )

    const decoder = new TextDecoder()
    return decoder.decode(decrypted)
  } catch (error) {
    throw new Error(`Invalid password or corrupted data: ${error}`)
  }
}

// Password cache (in-memory only)
const PASSWORD_CACHE_DURATION = 30 * 60 * 1000 // 30 minutes

interface CachedPassword {
  password: string
  expiresAt: number
}

const passwordCache = new Map<string, CachedPassword>()

export function cachePassword(noteId: string, password: string) {
  passwordCache.set(noteId, {
    password,
    expiresAt: Date.now() + PASSWORD_CACHE_DURATION,
  })
}

export function getCachedPassword(noteId: string): string | null {
  const cached = passwordCache.get(noteId)
  if (!cached) return null

  if (Date.now() > cached.expiresAt) {
    passwordCache.delete(noteId)
    return null
  }

  return cached.password
}

export function clearPasswordCache(noteId?: string) {
  if (noteId) {
    passwordCache.delete(noteId)
  } else {
    passwordCache.clear()
  }
}

// Clean expired passwords periodically
setInterval(() => {
  const now = Date.now()
  for (const [noteId, cached] of passwordCache.entries()) {
    if (now > cached.expiresAt) {
      passwordCache.delete(noteId)
    }
  }
}, 60000) // Check every minute
