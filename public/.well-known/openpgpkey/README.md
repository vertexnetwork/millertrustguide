# OpenPGP key — Web Key Directory (WKD) for support@millertrustguide.com

This directory publishes the public encryption key referenced by
[`/.well-known/security.txt`](../security.txt), so security reporters can send
encrypted mail.

## What's here
- `hu/mxqp8ogw4jfq83a58pn1wy1ccc1cx3f5` — the **binary** public key, served at
  the WKD "direct method" path. The filename is `zbase32(sha1("support"))`.
- `policy` — required (empty) WKD policy marker.
- `support-pubkey.asc` — ASCII-armored copy (human-friendly; what `security.txt`
  links via `Encryption:`).

## Key identity
- **User ID:** `Miller Trust Guide Security <support@millertrustguide.com>`
- **Primary fingerprint:** `E97AC1D7B4DB46066BDDA382D36B2416214A4BA6`
- **Algorithm:** ed25519 (cert/sign) + cv25519 (encrypt)

## How a reporter uses it
```
gpg --locate-keys support@millertrustguide.com      # auto-discovers via WKD
# or
curl -s https://millertrustguide.com/.well-known/openpgpkey/support-pubkey.asc | gpg --import
```

## Operator notes (NOT committed)
- The private key + revocation cert live in the **gitignored** `_secrets/`
  directory (`_secrets/gnupg/` keyring, `_secrets/support-SECRET-KEY.asc`).
  Move that into your real keyring (`gpg --import`) and store the backup
  offline. Consider adding a passphrase (`gpg --change-passphrase <fpr>`); it
  was generated without one for unattended setup.
- To rotate/revoke: import `_secrets/gnupg/openpgp-revocs.d/<FPR>.rev` and
  re-export. WKD serves whatever binary key sits at the `hu/<hash>` path.
- WKD requires this path to be reachable over HTTPS at the apex domain. On
  Vercel that is automatic for files in `public/`.
