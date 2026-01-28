import { RegistrationPayload, LoginPayload } from "../types";
import { API_ENDPOINT } from "../constants";

/**
 * CORS PROXY NECESSITY:
 * The console logs show that the Onetel server (device.onetel.co.za)
 * does not support direct browser requests from external domains (CORS).
 * We use corsproxy.io to bypass this.
 * This domain MUST be in the router's uamallowed list.
 */
const PROXY = "https://corsproxy.io/?";

export const registerUser = async (
  data: RegistrationPayload,
): Promise<Response> => {
  return await fetch(`${PROXY}${encodeURIComponent(API_ENDPOINT)}`, {
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
  return await fetch(`${PROXY}${encodeURIComponent(url)}`, {
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
  return await fetch(`${PROXY}${encodeURIComponent(url)}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  });
};

export const requestOtp = async (token: string): Promise<Response> => {
  const url = `${API_ENDPOINT}phone/token/`;
  return await fetch(`${PROXY}${encodeURIComponent(url)}`, {
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
  return await fetch(`${PROXY}${encodeURIComponent(url)}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ code }),
  });
};
