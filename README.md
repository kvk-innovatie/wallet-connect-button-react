# wallet-connect-button-react

A React component for NL Wallet integration.

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
  clientId="your-client-id"
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

- `clientId: string` - Required. Your client ID for wallet connection
- `onSuccess: (attributes: AttributeData | undefined) => void` - Required. Callback function called when wallet connection succeeds
- `apiKey?: string` - Optional. API key for authentication
- `walletConnectHost?: string` - Optional. Custom wallet connect host URL (defaults to https://wallet-connect.eu)
- `children?: React.ReactNode` - Optional. Custom button content

For further explanation and documentation, visit: https://wallet-connect.eu