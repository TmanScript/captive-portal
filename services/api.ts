import { RegistrationPayload, LoginPayload } from "../types";
import { API_ENDPOINT } from "../constants";

/**
 * MULTI-PROXY FALLBACK SYSTEM
 * Public CORS proxies can be unstable or blocked by specific hotspots.
 * We try the primary proxy, and if it fails (network error), we switch to a fallback.
 */
const PROXIES = [
  "https://api.allorigins.win/raw?url=",
  "https://corsproxy.io/?",
];

async function fetchWithProxy(
  targetUrl: string,
  options: RequestInit,
): Promise<Response> {
  let lastError: any;

  for (const proxy of PROXIES) {
    try {
      const fullUrl = `${proxy}${encodeURIComponent(targetUrl)}`;
      const response = await fetch(fullUrl, options);
      // We return the response even if it's 4xx/5xx, as the API handler will deal with it.
      // We only catch actual network failures (like BLOCKED by firewall).
      return response;
    } catch (err) {
      console.warn(`Proxy ${proxy} failed, trying next...`, err);
      lastError = err;
      continue;
    }
  }
  throw (
    lastError ||
    new Error("All CORS proxies failed. Check hotspot walled garden.")
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
