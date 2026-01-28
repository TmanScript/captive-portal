
import { RegistrationPayload, LoginPayload } from '../types';
import { API_ENDPOINT } from '../constants';

const PROXY_URL = 'https://corsproxy.io/?';

const getProxyUrl = (url: string) => `${PROXY_URL}${encodeURIComponent(url)}`;

export const registerUser = async (data: RegistrationPayload): Promise<Response> => {
  return await fetch(getProxyUrl(API_ENDPOINT), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify(data),
  });
};

export const loginUser = async (data: LoginPayload): Promise<Response> => {
  const url = `${API_ENDPOINT}token/`;
  return await fetch(getProxyUrl(url), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify(data),
  });
};

export const getUsage = async (token: string): Promise<Response> => {
  const url = `${API_ENDPOINT}usage/`;
  return await fetch(getProxyUrl(url), {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json',
    },
  });
};

export const requestOtp = async (token: string): Promise<Response> => {
  const url = `${API_ENDPOINT}phone/token/`;
  return await fetch(getProxyUrl(url), {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: '',
  });
};

export const verifyOtp = async (token: string, code: string): Promise<Response> => {
  const url = `${API_ENDPOINT}phone/verify/`;
  return await fetch(getProxyUrl(url), {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify({ code }),
  });
};
