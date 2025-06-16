const API_BASE_URL = '/api';

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  private async request(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<Response> {
    const url = `${this.baseUrl}${endpoint}`;
    
    const config: RequestInit = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      credentials: 'include', // Include cookies for authentication
      ...options,
    };

    try {
      const response = await fetch(url, config);
      return response;
    } catch (error) {
      console.error('API request failed:', error);
      throw error;
    }
  }

  async get(endpoint: string, options: RequestInit = {}): Promise<Response> {
    return this.request(endpoint, {
      method: 'GET',
      ...options,
    });
  }

  async post(
    endpoint: string,
    data?: any,
    options: RequestInit = {}
  ): Promise<Response> {
    return this.request(endpoint, {
      method: 'POST',
      ...(data && { body: JSON.stringify(data) }),
      ...options,
    });
  }

  async put(
    endpoint: string,
    data?: any,
    options: RequestInit = {}
  ): Promise<Response> {
    return this.request(endpoint, {
      method: 'PUT',
      ...(data && { body: JSON.stringify(data) }),
      ...options,
    });
  }

  async delete(endpoint: string, options: RequestInit = {}): Promise<Response> {
    return this.request(endpoint, {
      method: 'DELETE',
      ...options,
    });
  }

  async patch(
    endpoint: string,
    data?: any,
    options: RequestInit = {}
  ): Promise<Response> {
    return this.request(endpoint, {
      method: 'PATCH',
      ...(data && { body: JSON.stringify(data) }),
      ...options,
    });
  }
}

export const api = new ApiClient();
