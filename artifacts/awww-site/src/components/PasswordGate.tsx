import { useState, useEffect, ReactNode } from 'react';

export default function PasswordGate({ children, siteName = "A Woman With a Welder" }: { children: ReactNode, siteName?: string }) {
  const [unlocked, setUnlocked] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (sessionStorage.getItem('site_unlocked') === 'true') {
      setUnlocked(true);
    }
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === 'TEMPORARY_ACCESS_123') {
      sessionStorage.setItem('site_unlocked', 'true');
      setUnlocked(true);
    } else {
      setError('Incorrect password');
      setPassword('');
    }
  };

  if (unlocked) {
    return <>{children}</>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', backgroundColor: '#111', color: '#fff', fontFamily: 'sans-serif' }}>
      <div style={{ maxWidth: '400px', width: '100%', padding: '2rem', textAlign: 'center' }}>
        <h1 style={{ fontSize: '1.5rem', marginBottom: '1rem', fontWeight: 'bold' }}>{siteName}</h1>
        <p style={{ marginBottom: '2rem', color: '#ccc' }}>This website is currently private.</p>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter password"
            style={{ padding: '0.75rem', borderRadius: '0.375rem', border: '1px solid #333', backgroundColor: '#222', color: '#fff', width: '100%' }}
          />
          {error && <p style={{ color: '#ef4444', fontSize: '0.875rem', margin: 0 }}>{error}</p>}
          <button type="submit" style={{ padding: '0.75rem', borderRadius: '0.375rem', backgroundColor: '#3b82f6', color: '#fff', fontWeight: 'bold', border: 'none', cursor: 'pointer' }}>
            Enter
          </button>
        </form>
      </div>
    </div>
  );
}
