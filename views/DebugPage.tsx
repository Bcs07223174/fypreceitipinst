import React from 'react';

export default function DebugPage() {
  return (
    <div style={{padding:40,fontFamily:'Inter,system-ui,Arial'}}>
      <h1 style={{fontSize:24,marginBottom:8}}>Debug Page</h1>
      <p style={{color:'#334155'}}>This is a simple debug route to verify the SPA renders.</p>
      <ul>
        <li>Path: <strong>/debug</strong></li>
        <li>Try refreshing and opening in incognito.</li>
      </ul>
    </div>
  );
}
