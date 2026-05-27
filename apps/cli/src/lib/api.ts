import axios from 'axios';
import { getConfig } from './config';

export function createApiClient() {
  const config = getConfig();
  
  if (!config) {
    throw new Error('Not logged in. Please run `nebula login` first.');
  }

  return axios.create({
    baseURL: config.masterUrl,
    headers: {
      'Authorization': `Bearer ${config.accessToken}`,
      'Content-Type': 'application/json'
    }
  });
}

export function createUnauthenticatedClient(masterUrl: string) {
  return axios.create({
    baseURL: masterUrl,
    headers: {
      'Content-Type': 'application/json'
    }
  });
}
