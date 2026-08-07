// frontend/src/QrJoinPanel.tsx — QR code so a player can scan straight into a case
import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';

export function joinUrlForPin(pin: string): string {
  return `${window.location.origin}${window.location.pathname}?pin=${pin}`;
}

export function QrJoinPanel({ pin }: { pin: string }) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(joinUrlForPin(pin), {
      margin: 0,
      width: 320,
      color: { dark: '#0e0f13', light: '#f2ede0' },
    }).then((url) => {
      if (!cancelled) setDataUrl(url);
    });
    return () => {
      cancelled = true;
    };
  }, [pin]);

  return (
    <div className="qr-panel">
      <div className="qr-frame">
        {dataUrl ? <img src={dataUrl} alt={`QR code to join case ${pin}`} /> : null}
      </div>
      <span className="qr-caption">Scan to enter the case</span>
    </div>
  );
}
