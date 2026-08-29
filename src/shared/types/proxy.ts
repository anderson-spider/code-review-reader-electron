// -----------------------------------------------------------------------------
// Proxy Configuration Types
// -----------------------------------------------------------------------------

export type ProxyType = 'none' | 'socks5' | 'http';

export interface ProxySettings {
  enabled: boolean;
  type: ProxyType;
  host: string;
  port: number;
}
