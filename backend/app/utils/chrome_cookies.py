"""Утиліта для експорту Chrome cookies у Netscape формат.

Chrome 146+ шифрує cookies ключем з GNOME Keyring.
yt-dlp потребує XDG_CURRENT_DESKTOP=GNOME для доступу до keyring,
але це не завжди працює. Цей модуль робить експорт напряму.
"""

import os
import shutil
import sqlite3
import tempfile
from pathlib import Path


def export_chrome_cookies(output_path: Path, domains: list[str] | None = None) -> int:
    """Експортувати Chrome cookies в Netscape format cookies.txt.

    Returns: кількість експортованих cookies.
    """
    try:
        from Crypto.Cipher import AES
        from Crypto.Protocol.KDF import PBKDF2
        import secretstorage
    except ImportError:
        return 0

    # Get Chrome Safe Storage key from GNOME keyring
    try:
        bus = secretstorage.dbus_init()
        collection = secretstorage.get_default_collection(bus)
        chrome_key = None
        for item in collection.get_all_items():
            if item.get_label() == "Chrome Safe Storage":
                chrome_key = item.get_secret()
                break
        if not chrome_key:
            return 0
    except Exception:
        return 0

    derived_key = PBKDF2(chrome_key, b"saltysalt", dkLen=16, count=1)

    def decrypt_v11(encrypted_value: bytes) -> str:
        if not encrypted_value or len(encrypted_value) < 4:
            return ""
        version = encrypted_value[:3]
        if version not in (b"v10", b"v11"):
            return ""
        data = encrypted_value[3:]
        if not data or len(data) % 16 != 0:
            return ""
        iv = b" " * 16
        cipher = AES.new(derived_key, AES.MODE_CBC, iv)
        decrypted = cipher.decrypt(data)
        # PKCS7 padding
        pad_len = decrypted[-1]
        if isinstance(pad_len, int) and 0 < pad_len <= 16:
            if all(b == pad_len for b in decrypted[-pad_len:]):
                decrypted = decrypted[:-pad_len]
        decrypted = decrypted.rstrip(b"\x00")
        try:
            result = decrypted.decode("utf-8")
            result.encode("latin-1")
            return result
        except (UnicodeDecodeError, UnicodeEncodeError):
            return ""

    # Copy cookies DB (Chrome locks the original)
    chrome_cookies = Path.home() / ".config/google-chrome/Default/Cookies"
    if not chrome_cookies.exists():
        return 0

    tmp = tempfile.mktemp(suffix=".db")
    shutil.copy2(chrome_cookies, tmp)

    try:
        conn = sqlite3.connect(tmp)
        cursor = conn.cursor()

        if domains:
            placeholders = " OR ".join(
                f"host_key LIKE '%{d}'" for d in domains
            )
            query = f"SELECT host_key, name, path, expires_utc, is_secure, encrypted_value FROM cookies WHERE {placeholders}"
        else:
            query = "SELECT host_key, name, path, expires_utc, is_secure, encrypted_value FROM cookies"

        cursor.execute(query)
        rows = cursor.fetchall()

        output_path.parent.mkdir(parents=True, exist_ok=True)
        count = 0
        with open(output_path, "w") as f:
            f.write("# Netscape HTTP Cookie File\n")
            for host, name, path, expires, secure, encrypted_value in rows:
                value = decrypt_v11(encrypted_value)
                if not value:
                    continue
                secure_str = "TRUE" if secure else "FALSE"
                http_only = "TRUE" if host.startswith(".") else "FALSE"
                if expires > 0:
                    unix_expires = max(0, int((expires / 1000000) - 11644473600))
                else:
                    unix_expires = 0
                f.write(f"{host}\t{http_only}\t{path}\t{secure_str}\t{unix_expires}\t{name}\t{value}\n")
                count += 1

        conn.close()
        return count
    finally:
        os.unlink(tmp)
