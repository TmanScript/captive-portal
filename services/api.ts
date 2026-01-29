import { RegistrationPayload, LoginPayload } from "../types";
import { API_ENDPOINT } from "../constants";

/**
 * ROBUST MULTI-PROXY ROTATION
 * These services help bypass CORS and firewall restrictions.
 * If one times out or returns an error, we immediately try the next.
 */
const PROXIES = [
  "https://api.allorigins.win/raw?url=",
  "https://corsproxy.io/?",
  "https://api.codetabs.com/v1/proxy/?quest=",
];

async function fetchWithProxy(
  targetUrl: string,
  options: RequestInit,
): Promise<Response> {
  let lastError: any;

  for (const proxy of PROXIES) {
    try {
      const fullUrl = `${proxy}${encodeURIComponent(targetUrl)}`;

      // Use a shorter timeout for the proxy attempt to switch faster
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);

      const response = await fetch(fullUrl, {
        ...options,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // If we get a response (even a 4xx from the API), return it.
      // We only catch actual network failures (like TIMEOUT or BLOCKED).
      return response;
    } catch (err: any) {
      console.warn(
        `Proxy Attempt Failed: ${proxy}`,
        err.name === "AbortError" ? "Timed Out" : err.message,
      );
      lastError = err;
      continue; // Try next proxy
    }
  }

  // If we reach here, all proxies failed.
  throw (
    lastError ||
    new Error(
      "Connection failed. Ensure all bridge domains are in your uamallowed list.",
    )
  );
}

export const registerUser = async (
  data: RegistrationPayload,
): Promise<Response> => {
  return await fetchWithProxy(API_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(data),
  });
};

export const loginUser = async (data: LoginPayload): Promise<Response> => {
  const url = `${API_ENDPOINT}token/`;
  return await fetchWithProxy(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(data),
  });
};

export const getUsage = async (token: string): Promise<Response> => {
  const url = `${API_ENDPOINT}usage/`;
  return await fetchWithProxy(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  });
};

export const requestOtp = async (token: string): Promise<Response> => {
  const url = `${API_ENDPOINT}phone/token/`;
  return await fetchWithProxy(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: "",
  });
};

export const verifyOtp = async (
  token: string,
  code: string,
): Promise<Response> => {
  const url = `${API_ENDPOINT}phone/verify/`;
  return await fetchWithProxy(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ code }),
  });
};
