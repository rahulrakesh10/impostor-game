// frontend/src/ErrorToast.tsx — shared dismissible error banner for host/player screens
import React from 'react';

export function ErrorToast({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  return (
    <div className="error-toast" onClick={onDismiss} role="alert">
      {message}
    </div>
  );
}
