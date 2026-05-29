"use client"

import { useState } from 'react';

export function useQRScanner() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<any>(null);

  return { loading, setLoading, error, setError, result, setResult };
}
