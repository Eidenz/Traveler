-- Unix seconds of the user's last password change. JWTs issued before this
-- moment (token iat < password_changed_at) are rejected, so changing or
-- resetting a password revokes every previously issued session token.
-- NULL means the password has never changed since this column landed —
-- existing sessions stay valid (backward compatible).
ALTER TABLE users ADD COLUMN password_changed_at INTEGER;
