import React, { useState, useEffect, useRef } from "react";
import { useSearchParams } from "./useSearchParams";
import axios from "axios";

interface AttributeData {
  age_over_18?: boolean;
  [key: string]: any;
}

interface DisclosedAttributesResponse {
  attributes?: {
    [key: string]: {
      attributes?: {
        [key: string]: AttributeData;
      };
      issuerUri?: string;
      ca?: string;
      validityInfo?: {
        signed?: string;
        validFrom?: string;
        validUntil?: string;
      };
    };
  };
}

export interface WalletConnectButtonProps {
  children?: React.ReactNode;
  clientId: string;
  onSuccess: (attributes: AttributeData | undefined) => void;
  apiKey?: string;
  walletConnectHost?: string;
}


// Define custom events
interface NLWalletSuccessEvent extends CustomEvent {
  detail: [string, string]; // [session_token, session_type]
}

interface NLWalletFailedEvent extends CustomEvent {
  detail: any;
}

declare global {
  namespace JSX {
    interface IntrinsicElements {
      'nl-wallet-button': {
        ref?: React.RefObject<HTMLElement>;
        text?: React.ReactNode;
        usecase?: string;
        'start-url'?: string;
        lang?: string;
      };
    }
  }
}

function WalletConnectButton({ children, clientId, onSuccess, apiKey, walletConnectHost }: WalletConnectButtonProps) {
  const [searchParams, setSearchParams, removeSearchParam] = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const buttonRef = useRef<HTMLElement>(null);

  useEffect(() => {
    // Dynamically import the web component
    const loadWebComponent = async () => {
      try {
        await import("./nl-wallet-web.js");
        const button = buttonRef.current;

        // Attach the event listener when the component mounts
        if (button) {
          button.addEventListener("success", handleSuccess as EventListener);
          button.addEventListener("failed", handleFailed as EventListener);
        }
      } catch (error) {
        console.warn('Could not load nl-wallet-web.js:', error);
      }
    };
    
    loadWebComponent();

    // Cleanup the event listener when the component unmounts
    return () => {
      const button = buttonRef.current;
      if (button) {
        button.removeEventListener("success", handleSuccess as EventListener);
        button.removeEventListener("failed", handleFailed as EventListener);
      }
    };
  }, []);

  // Function to handle the 'success' event
  const handleSuccess = (e: Event) => {
    const customEvent = e as NLWalletSuccessEvent;
    if (customEvent.detail && customEvent.detail.length > 1) {
      const session_token = customEvent.detail[0];
      const session_type = customEvent.detail[1];

      // this only works for cross_device without a configured return URL
      if (session_type === "cross_device") {
        setSearchParams({ session_token });
      }
    }
    console.log("Success event received:", customEvent.detail);
  };

  const handleFailed = (e: Event) => {
    const customEvent = e as NLWalletFailedEvent;
    console.log("Failed event received:", customEvent.detail);
  };

  useEffect(() => {
    const session_token = searchParams.get("session_token");
    const nonce = searchParams.get("nonce");

    if (!session_token) return;

    setLoading(true);
    const baseUrl = walletConnectHost || "https://wallet-connect.eu";
    let url = baseUrl + `/disclosed-attributes?session_token=${session_token}&client_id=${clientId}`;
    if (nonce) url = `${url}&nonce=${nonce}`;

    const headers = apiKey ? { 'Authorization': `Bearer ${apiKey}` } : {};
    axios
      .get<DisclosedAttributesResponse>(url, { headers })
      .then(({ data }) => {
        console.log("Disclosed attributes:", data);
        // Extract age_over_18 from nested response structure
        onSuccess(data);
        // Remove session_token from URL after successful retrieval
        removeSearchParam('session_token');
        setLoading(false);
      })
      .catch((error: Error) => {
        console.log(error.message);
        setError(error.message);
        setLoading(false);
      });
  }, [searchParams, onSuccess]);

  if (loading) {
    return (
      <div className="attributes">
        <div className="verification-card">
          <h2>Checking attributes...</h2>
          <p>Please wait while we verify your attributes.</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="attributes">
        <div className="verification-card">
          <h2>Error</h2>
          <p>An error occurred while verifying your attributes: {error}</p>
        </div>
      </div>
    );
  }
  
  return (
    <nl-wallet-button
      ref={buttonRef}
      text={children}
      usecase={clientId}
      start-url={`${walletConnectHost || "https://wallet-connect.eu"}/create-session?lang=en&return_url=${encodeURIComponent(
        window.location.href
      )}`}
      lang="nl"
    ></nl-wallet-button>
  );
}

export default WalletConnectButton;