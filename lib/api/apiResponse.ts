export type ApiSuccess<T> = {
  success: true;
  data: T;
};

export type ApiFailure = {
  success: false;
  message: string;
  error?: string;
};

export function ok<T>(data: T): ApiSuccess<T> {
  return { success: true, data };
}

export function fail(message: string, error?: string): ApiFailure {
  return { success: false, message, error };
}
