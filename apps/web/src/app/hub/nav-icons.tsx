/**
 * The glyphs the three rails share — the hub's module list, the warehouse and
 * the sales desk. They live here rather than in whichever sidebar happened to
 * declare one first, so no rail has to import another rail to draw itself.
 */

export function FinanceIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className={className}>
      <path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4z" />
      <path
        fillRule="evenodd"
        d="M18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zm-5 3a1 1 0 100 2h2a1 1 0 100-2h-2z"
        clipRule="evenodd"
      />
    </svg>
  );
}

export function SkladIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className={className}>
      <path d="M10.394 2.08a1 1 0 00-.788 0l-7 3a1 1 0 000 1.84L5.25 8.051a.999.999 0 01.356-.257l4-1.714a1 1 0 11.788 1.838L7.667 9.088l1.94.831a1 1 0 00.787 0l7-3a1 1 0 000-1.838l-7-3zM3.31 9.397L5 10.12v4.102a8.969 8.969 0 00-1.05-.174 1 1 0 01-.89-.89 11.115 11.115 0 010-3.762zM9.3 16.573A9.026 9.026 0 007 14.935v-3.957l1.818.78a3 3 0 002.364 0l5.508-2.361a11.026 11.026 0 010 3.958 1 1 0 01-.89.89 8.968 8.968 0 00-5.35 2.517 1 1 0 01-1.15 0z" />
    </svg>
  );
}

/** Sotuv bo'limi — a hand offering goods across a counter. */
export function SalesIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className={className}>
      <path d="M3 1a1 1 0 000 2h1.22l.305 1.222a.997.997 0 00.01.042l1.358 5.43-.893.892C3.74 11.846 4.632 14 6.414 14H15a1 1 0 000-2H6.414l1-1H14a1 1 0 00.894-.553l3-6A1 1 0 0017 3H6.28l-.31-1.243A1 1 0 005 1H3zM16 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM6.5 18a1.5 1.5 0 100-3 1.5 1.5 0 000 3z" />
    </svg>
  );
}

export function OverviewIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className={className}>
      <path d="M3 3h6v7H3V3zm8 0h6v4h-6V3zM3 12h6v5H3v-5zm8-3h6v8h-6V9z" />
    </svg>
  );
}

export function OrdersIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className={className}>
      <path
        fillRule="evenodd"
        d="M5 2a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V6.414A2 2 0 0016.414 5L14 2.586A2 2 0 0012.586 2H5zm1 6a1 1 0 000 2h8a1 1 0 100-2H6zm0 4a1 1 0 100 2h5a1 1 0 100-2H6z"
        clipRule="evenodd"
      />
    </svg>
  );
}

export function InboundIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className={className}>
      <path
        fillRule="evenodd"
        d="M10 2a1 1 0 011 1v7.586l2.293-2.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L9 10.586V3a1 1 0 011-1zM3 15a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z"
        clipRule="evenodd"
      />
    </svg>
  );
}

export function OutboundIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className={className}>
      <path
        fillRule="evenodd"
        d="M10 15a1 1 0 01-1-1V6.414L6.707 8.707a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L11 6.414V14a1 1 0 01-1 1zm-7 2a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z"
        clipRule="evenodd"
      />
    </svg>
  );
}

export function InvoiceIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className={className}>
      <path
        fillRule="evenodd"
        d="M4 2a1 1 0 00-1 1v14a1 1 0 001.447.894L6 17.118l1.553.776a1 1 0 00.894 0L10 17.118l1.553.776a1 1 0 00.894 0L14 17.118l1.553.776A1 1 0 0017 17V3a1 1 0 00-1-1H4zm2 4a1 1 0 000 2h8a1 1 0 100-2H6zm0 4a1 1 0 100 2h5a1 1 0 100-2H6z"
        clipRule="evenodd"
      />
    </svg>
  );
}

export function ClientsIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className={className}>
      <path d="M7 8a3 3 0 100-6 3 3 0 000 6zM14.5 9a2.5 2.5 0 100-5 2.5 2.5 0 000 5zM1.615 16.428a1.224 1.224 0 01-.569-1.175 6.002 6.002 0 0111.908 0c.058.467-.172.92-.57 1.174A9.953 9.953 0 017 18a9.953 9.953 0 01-5.385-1.572zM14.5 16h-.106c.07-.297.088-.611.048-.933a7.47 7.47 0 00-1.588-3.755 4.502 4.502 0 015.874 2.636.818.818 0 01-.36.98A7.465 7.465 0 0114.5 16z" />
    </svg>
  );
}

export function SettingsIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className={className}>
      <path
        fillRule="evenodd"
        d="M11.078 2.25c.917 0 1.699.663 1.85 1.567l.091.549a.798.798 0 00.517.608 7.45 7.45 0 01.478.2.798.798 0 00.796-.064l.453-.324a1.875 1.875 0 012.416.2l.577.577a1.875 1.875 0 01.2 2.416l-.324.453a.798.798 0 00-.064.796c.078.156.148.316.2.478a.798.798 0 00.608.517l.549.09a1.875 1.875 0 011.567 1.851v.815c0 .917-.663 1.699-1.567 1.85l-.549.091a.798.798 0 00-.608.517 7.45 7.45 0 01-.2.478.798.798 0 00.064.796l.324.453a1.875 1.875 0 01-.2 2.416l-.577.577a1.875 1.875 0 01-2.416.2l-.453-.324a.798.798 0 00-.796-.064 7.45 7.45 0 01-.478.2.798.798 0 00-.517.608l-.09.549a1.875 1.875 0 01-1.851 1.567h-.815a1.875 1.875 0 01-1.85-1.567l-.091-.549a.798.798 0 00-.517-.608 7.45 7.45 0 01-.478-.2.798.798 0 00-.796.064l-.453.324a1.875 1.875 0 01-2.416-.2l-.577-.577a1.875 1.875 0 01-.2-2.416l.324-.453a.798.798 0 00.064-.796 7.45 7.45 0 01-.2-.478.798.798 0 00-.608-.517l-.549-.09A1.875 1.875 0 012.25 11.893v-.815c0-.917.663-1.699 1.567-1.85l.549-.091a.798.798 0 00.608-.517c.052-.162.122-.322.2-.478a.798.798 0 00-.064-.796l-.324-.453a1.875 1.875 0 01.2-2.416l.577-.577a1.875 1.875 0 012.416-.2l.453.324a.798.798 0 00.796.064c.156-.078.316-.148.478-.2a.798.798 0 00.517-.608l.09-.549a1.875 1.875 0 011.851-1.567h.815zM10 13.25a3.25 3.25 0 100-6.5 3.25 3.25 0 000 6.5z"
        clipRule="evenodd"
      />
    </svg>
  );
}

export function SignOutIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className={className}>
      <path
        fillRule="evenodd"
        d="M3 3a1 1 0 011-1h6a1 1 0 010 2H5v12h5a1 1 0 010 2H4a1 1 0 01-1-1V3zm10.293 3.293a1 1 0 011.414 0l3 3a1 1 0 010 1.414l-3 3a1 1 0 01-1.414-1.414L14.586 11H8a1 1 0 010-2h6.586l-1.293-1.293a1 1 0 010-1.414z"
        clipRule="evenodd"
      />
    </svg>
  );
}

export function BackIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className={className}>
      <path
        fillRule="evenodd"
        d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z"
        clipRule="evenodd"
      />
    </svg>
  );
}
