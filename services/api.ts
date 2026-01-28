import { RegistrationPayload, LoginPayload } from "../types";
import { API_ENDPOINT } from "../constants";

/**
 * We are removing the CORS proxy because in a hotspot environment,
 * adding more external domains like corsproxy.io increases the chance of
 * being blocked by the Walled Garden.
 *
 * The Onetel API at device.onetel.co.za is expected to handle CORS
 * for its own captive portal users.
 */

export const registerUser = async (
  data: RegistrationPayload,
): Promise<Response> => {
  return await fetch(API_ENDPOINT, {
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
  return await fetch(url, {
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
  return await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  });
};

export const requestOtp = async (token: string): Promise<Response> => {
  const url = `${API_ENDPOINT}phone/token/`;
  return await fetch(url, {
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
  return await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ code }),
  });
};
