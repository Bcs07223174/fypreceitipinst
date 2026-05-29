import { NextResponse } from 'next/server';
import { ApiError } from './apiError';

export function asyncHandler<T>(handler: () => Promise<T>) {
  return handler().then(
    (data) => NextResponse.json({ success: true, data }),
    (error) => {
      if (error instanceof ApiError) {
        return NextResponse.json({ success: false, message: error.message }, { status: error.status });
      }

      console.error('[api] unhandled error', error);
      return NextResponse.json({ success: false, message: 'Unexpected server error' }, { status: 500 });
    }
  );
}
