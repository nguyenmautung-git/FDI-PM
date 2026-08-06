/**
 * Secure invitation utility functions
 * Uses Web Crypto API built into all modern browsers — no external libraries needed
 */

/**
 * Generate a cryptographically secure random token.
 * Returns a URL-safe base64 string (~48 characters, ~288 bits of entropy).
 */
export const generateToken = () => {
  const array = new Uint8Array(36);
  crypto.getRandomValues(array);
  return btoa(String.fromCharCode(...array))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
};

/**
 * Hash a token using SHA-256 (Web Crypto API, async).
 * This hash is what gets stored in Firestore — NEVER the plain token.
 */
export const hashToken = async (token) => {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

/**
 * Password strength checker.
 * Returns { checks, score 0–4, isStrong }
 */
export const checkPasswordStrength = (password) => {
  const checks = {
    length:    password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    number:    /[0-9]/.test(password),
    special:   /[!@#$%^&*()\-_=+[\]{};':"\\|,.<>/?]/.test(password),
  };
  const score = Object.values(checks).filter(Boolean).length;
  return { checks, score, isStrong: score === 4 };
};

/** App base URL for generating invite links */
export const getAppUrl = () => {
  try {
    if (import.meta?.env?.VITE_APP_URL) return import.meta.env.VITE_APP_URL;
  } catch (_) {}
  return 'https://nguyenmautung-git.github.io/QuanLyTaiLieu/';
};

/** Format time remaining until expiry (human-readable) */
export const formatTimeRemaining = (expiresAt) => {
  if (!expiresAt) return '';
  const expiry = expiresAt?.toDate ? expiresAt.toDate() : new Date(expiresAt);
  const diffMs = expiry - new Date();
  if (diffMs <= 0) return 'Đã hết hạn';
  const h = Math.floor(diffMs / (1000 * 60 * 60));
  const m = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  if (h >= 24) return `${Math.floor(h / 24)} ngày ${h % 24}g`;
  return `${h}g ${m}p`;
};

/** Status label mapping */
export const STATUS_LABELS = {
  pending: { label: 'Đang chờ',    color: '#f59e0b', bg: 'rgba(245,158,11,0.15)' },
  active:  { label: 'Đã kích hoạt', color: '#10b981', bg: 'rgba(16,185,129,0.15)' },
  revoked: { label: 'Đã thu hồi',  color: '#ef4444', bg: 'rgba(239,68,68,0.15)'  },
  expired: { label: 'Hết hạn',     color: '#64748b', bg: 'rgba(100,116,139,0.15)' },
};
