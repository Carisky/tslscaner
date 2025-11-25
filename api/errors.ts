import axios from 'axios';

export const getRequestErrorMessage = (error: unknown, fallback: string) => {
  if (axios.isAxiosError(error)) {
    if (error.response) {
      if (typeof error.response.data === 'string') {
        return `${error.response.status} ${error.response.statusText}: ${error.response.data}`;
      }
      if (error.response.data && typeof error.response.data === 'object') {
        try {
          return `${error.response.status} ${error.response.statusText}: ${JSON.stringify(
            error.response.data,
          )}`;
        } catch {
          // fallthrough
        }
      }
    }
    if (error.message) {
      return error.message;
    }
  }
  if (error instanceof Error && error.message.length) {
    return error.message;
  }
  return fallback;
};
