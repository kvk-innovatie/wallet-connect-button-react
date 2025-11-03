import React, { useState, useEffect, useRef } from "react";
import { useSearchParams } from "./useSearchParams";
import axios from "axios";

// Global cache to prevent duplicate requests
const credentialsCache = new Map<string, { 
  data?: any; 
  promise?: Promise<any>; 
  subscribers?: Set<Function>;
}>();

interface AttributeData {
  age_over_18?: boolean;
  [key: string]: any;
}

interface RequestedCredential {
  credentialKey: string;
  credentialName: {
    en: string;
    nl: string;
  };
  websiteUrl: string;
  vct: string;
}

interface RequestedCredentialsResponse {
  success: boolean;
  data: {
    clientId: string;
    companyName: string;
    requestedCredentials: RequestedCredential[];
  };
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
  label?: string;
  clientId: string;
  onSuccess: (attributes: AttributeData | undefined) => void;
  apiKey?: string;
  useLocalWcServer?: boolean;
  business?: boolean;
  lang?: string;
  helpBaseUrl?: string;
  issuance?: boolean;
}


// Define custom events
interface WalletButtonSuccessEvent extends CustomEvent {
  detail: [string, string]; // [session_token, session_type]
}

interface WalletButtonFailedEvent extends CustomEvent {
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
        'same-device-ul'?: string;
        'cross-device-ul'?: string;
        'help-base-url'?: string;
        onClick?: (event: Event) => void;
      };
    }
  }
}

function getDefaultHost(useLocalWcServer: boolean, business: boolean, issuance: boolean) {
  // If useLocalWcServer is set, use local server
  if (useLocalWcServer) {
    if (business) {
      return issuance ? 'http://localhost:4007' : 'http://bw.localhost:3021';
    }

    return issuance ? 'http://localhost:3007' : 'http://localhost:3021';
  }

  // Otherwise use remote servers
  if (business) {
    return issuance ? 'https://bw.issuance.wallet-connect.eu' : 'https://bw.wallet-connect.eu';
  }

  return issuance ? 'https://issuance.wallet-connect.eu' : 'https://wallet-connect.eu';
}

function constructURI(clientId: string, session_type: string, walletConnectHost: string, business: boolean) {
  let request_uri = `${walletConnectHost}/disclosure/${clientId}/request_uri?session_type=${session_type}`;
  let request_uri_method = "post";
  let client_id_uri = `${clientId}.example.com`;

  const deepLinkScheme = business
    ? 'businesswalletdebuginteraction://wallet.kvk.rijksoverheid.nl'
    : 'walletdebuginteraction://wallet.edi.rijksoverheid.nl';

  return `${deepLinkScheme}/disclosure_based_issuance?request_uri=${encodeURIComponent(
    request_uri
  )}&request_uri_method=${request_uri_method}&client_id=${client_id_uri}`;
}

function WalletConnectButton({ label, clientId, onSuccess, apiKey, useLocalWcServer = false, business = false, lang, helpBaseUrl, issuance = false }: WalletConnectButtonProps) {
  const [searchParams, setSearchParams, removeSearchParam] = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const buttonRef = useRef<HTMLElement>(null);

  const walletConnectHost = getDefaultHost(useLocalWcServer, business, issuance);

  const sameDeviceUl = constructURI(clientId, "same_device", walletConnectHost, business);
  const crossDeviceUl = constructURI(clientId, "cross_device", walletConnectHost, business);

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
          
          // Add click listener directly to the element
          button.addEventListener("click", handleButtonClick as EventListener);
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
        button.removeEventListener("click", handleButtonClick as EventListener);
      }
    };
  }, []);

  const fetchRequestedCredentials = async () => {
    if (!apiKey || !clientId) return [];

    const cacheKey = `${clientId}-${walletConnectHost}`;

    // Check if we already have data in cache
    const cached = credentialsCache.get(cacheKey);
    if (cached?.data) {
      return cached.data;
    }

    // Check if there's already a request in progress
    if (cached?.promise) {
      return await cached.promise;
    }

    const fetchPromise = (async () => {
      try {
        const url = `${walletConnectHost}/api/client/${clientId}/requested-credentials`;
        const headers = { 'Authorization': `Bearer ${apiKey}` };

        const response = await axios.get<RequestedCredentialsResponse>(url, { headers });

        // Extract credentials from the response
        const credentials = response.data?.data?.requestedCredentials || [];

        // Cache the result
        credentialsCache.set(cacheKey, { data: credentials });
        return credentials;
      } catch (error: any) {
        // Remove failed request from cache
        credentialsCache.delete(cacheKey);
        throw error;
      }
    })();

    // Cache the promise to prevent duplicate requests
    credentialsCache.set(cacheKey, { promise: fetchPromise });

    return await fetchPromise;
  };

  const injectCredentialsIntoShadowDOM = (credentials: RequestedCredential[], retryCount = 0) => {
    const maxRetries = 10;
    const walletButton = buttonRef.current;
    
    if (!walletButton || !walletButton.shadowRoot) {
      return;
    }

    // Remove any existing credential info
    const existingCredentials = walletButton.shadowRoot.querySelector('.required-credentials');
    if (existingCredentials) {
      existingCredentials.remove();
    }

    if (credentials.length === 0) return;

    // Look for the modal and website section
    const modal = walletButton.shadowRoot.querySelector('.modal');
    if (!modal) {
      // Retry if modal not found yet
      if (retryCount < maxRetries) {
        setTimeout(() => {
          injectCredentialsIntoShadowDOM(credentials, retryCount + 1);
        }, 200);
        return;
      }
      return;
    }

    const websiteSection = modal.querySelector('.website');

    // Determine language and translations
    const isNL = lang === 'nl';
    const headerText = isNL ? 'Benodigde Attestaties:' : 'Required Credentials:';
    const getLinkText = isNL ? '→ Verkrijg attestatie' : '→ Get credential';

    // Create credential info element
    const credentialsDiv = document.createElement('div');
    credentialsDiv.className = 'required-credentials';
    credentialsDiv.innerHTML = `
      <div style="
        background: #f8f9fa;
        border: 1px solid #e9ecef;
        border-radius: 6px;
        padding: 12px;
        font-family: inherit;
        font-size: 13px;
        line-height: 1.4;
      ">
        <div style="margin: 0 0 8px 0; color: #212529; font-size: 14px; font-weight: 600;">${headerText}</div>
        ${credentials.map(credential => {
          const credentialName = isNL ? credential.credentialName.nl : credential.credentialName.en;
          return `
            <div style="margin-bottom: 6px; display: flex; align-items: center; flex-wrap: wrap; gap: 8px;">
              <span style="color: #495057; font-weight: 500;">${credentialName}</span>
              ${credential.websiteUrl ? `
                <a href="${credential.websiteUrl}" target="_blank" rel="noopener noreferrer" style="
                  color: #0066cc;
                  text-decoration: none;
                  font-size: 12px;
                  white-space: nowrap;
                ">${getLinkText}</a>
              ` : ''}
            </div>
          `;
        }).join('')}
      </div>
    `;

    // Insert the credentials div after the website section
    if (websiteSection) {
      websiteSection.insertAdjacentElement('afterend', credentialsDiv);
    } else {
      // Fallback: insert at the beginning of modal
      modal.insertBefore(credentialsDiv, modal.firstChild);
    }
  };

  const handleButtonClick = async (_event: Event) => {
    try {
      const credentials = await fetchRequestedCredentials();
      
      if (credentials && credentials.length > 0) {
        // Inject credentials into the shadow DOM with multiple attempts
        setTimeout(() => {
          injectCredentialsIntoShadowDOM(credentials);
        }, 100);
      }
    } catch (error) {
      console.error('Failed to fetch credentials:', error);
    }
  };

  // Function to handle the 'success' event
  const handleSuccess = (e: Event) => {
    const customEvent = e as WalletButtonSuccessEvent;
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
    const customEvent = e as WalletButtonFailedEvent;
    console.log("Failed event received:", customEvent.detail);
  };

  useEffect(() => {
    const session_token = searchParams.get("session_token");
    const nonce = searchParams.get("nonce");

    if (!session_token) return;

    setLoading(true);
    const baseUrl = apiKey ? walletConnectHost : "";
    let url = baseUrl + `/api/disclosed-attributes?session_token=${session_token}&client_id=${clientId}`;
    if (nonce) url = `${url}&nonce=${nonce}`;

    const headers = apiKey ? { 'Authorization': `Bearer ${apiKey}` } : {};
    axios
      .get<DisclosedAttributesResponse>(url, { headers })
      .then(({ data }) => {
        console.log("Disclosed attributes:", data);
        // Extract age_over_18 from nested response structure
        onSuccess(data);
        // Remove session_token and nonce from URL after successful retrieval
        removeSearchParam('session_token');
        if (nonce) removeSearchParam('nonce');
        setLoading(false);
      })
      .catch((error: Error) => {
        console.log(error.message);
        setError(error.message);
        // Remove session_token from URL after failed request
        removeSearchParam('session_token');
        if (nonce) removeSearchParam('nonce');
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
      text={label}
      usecase={issuance ? "" : clientId}
      start-url={`${walletConnectHost}/api/create-session?lang=en&return_url=${encodeURIComponent(
        window.location.href
      )}`}
      lang={lang || "nl"}
      same-device-ul={sameDeviceUl}
      cross-device-ul={crossDeviceUl}
      help-base-url={helpBaseUrl}
      onClick={handleButtonClick}
    ></nl-wallet-button>
  );
}

export default WalletConnectButton;