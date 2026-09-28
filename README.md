# wallet-connect-button-react

A React component for NP Wallet integration.

## Installation

```bash
npm install wallet-connect-button-react
```

## Usage

1. Import the component in your React app:

```typescript
import { WalletConnectButton } from 'wallet-connect-button-react';
```

2. Use the component in your JSX:

```jsx
<WalletConnectButton 
  serviceId="your-service-id"
  apiKey="your-api-key"
  walletConnectHost="https://wallet-connect.eu"
  onSuccess={(attributes) => console.log('Success:', attributes)}
>
  Connect Wallet
</WalletConnectButton>
```

3. Handle the success callback in your component:

```typescript
const handleWalletSuccess = (attributes: any) => {
  console.log('Wallet connected successfully:', attributes);
};
```

## API

### Props

- `serviceId: string` - The registration's identifier. NB Wallet Connect calls it a
  **service id**: one company registers a service per website or application.
- `clientId: string` - The original name for the same value, still fully supported.
  Give either one; `serviceId` wins when both are set.

With the `nbwallet` attribute the button talks to NB Wallet Connect, which has renamed
this identifier throughout its API (`service_id`, `/api/service/...`). Every other
variant still calls its host with `client_id`. That switch is automatic; you only
choose which prop name to write.
- `onSuccess: (attributes: AttributeData | undefined) => void` - Required. Callback function called when wallet connection succeeds
- `apiKey?: string` - Optional. API key for authentication
- `walletConnectHost?: string` - Optional. Custom wallet connect host URL (defaults to https://wallet-connect.eu)
- `children?: React.ReactNode` - Optional. Custom button content

For further explanation and documentation, visit: https://wallet-connect.eu

## Changes

### 1.1.25
- Pass the `clientId` prop through to the embedded `<nl-wallet-button>` as `client-id`, so the "No app yet?" link under the QR code becomes `<help-base-url>?client_id=<clientId>` (employee onboarding hand-off).
- NB Wallet (`nbwallet`) issuance deep links now use the https universal link base `https://nbwallet.org/deeplink/...` instead of the custom `businesswalletdebuginteraction://` scheme. Business Wallet and NL Wallet links are unchanged.
