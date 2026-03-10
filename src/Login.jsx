import React from 'react';
import { supabase } from './supabase';

function Login({ onClose }) {
    const handleGoogleLogin = async () => {
        await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: window.location.origin,
            },
        });
    };

    return (
        <div style={{ width: '100%', height: '100%', position: 'relative', background: 'white', overflow: 'hidden', display: 'flex', justifyContent: 'center' }}>
            <div style={{ width: 402, height: '100%', position: 'relative' }}>

                {/* Close / Back button */}
                {onClose && (
                    <button
                        onClick={onClose}
                        style={{
                            position: 'absolute', top: 60, left: 28, zIndex: 20,
                            background: '#F4F4F5', border: 'none', borderRadius: '50%',
                            width: 36, height: 36, cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="15 18 9 12 15 6" />
                        </svg>
                    </button>
                )}

                {/* Google Sign In Button */}
                <button
                    onClick={handleGoogleLogin}
                    style={{
                        zIndex: 10,
                        width: 346, height: 47, left: 28, top: 580, position: 'absolute',
                        background: '#E8E8EA', borderRadius: 34.50, border: 'none', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
                        padding: 0
                    }}
                >
                    <div style={{ width: 208, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                        <svg style={{ width: 20, height: 20 }} viewBox="0 0 48 48">
                            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
                        </svg>
                        <span style={{ color: 'black', fontSize: 16, fontFamily: '"SF Pro", -apple-system, sans-serif', fontWeight: '510', letterSpacing: '-0.3px', marginTop: '-1px' }}>
                            Continue with Google
                        </span>
                    </div>
                </button>

                {/* Title */}
                <div style={{ pointerEvents: 'none', width: 246, height: 126, left: 78, top: 357, position: 'absolute', textAlign: 'center', justifyContent: 'center', display: 'flex', flexDirection: 'column', color: 'black', fontSize: 32, fontFamily: '"SF Pro", -apple-system, sans-serif', fontWeight: '510', lineHeight: '37px', wordWrap: 'break-word' }}>
                    Organize your<br />day with ease
                </div>

                {/* Logo */}
                <div style={{ pointerEvents: 'none', width: 106, height: 37, left: 142, top: 327, position: 'absolute', justifyContent: 'center', display: 'flex', flexDirection: 'column', color: 'black', fontSize: 26, fontFamily: '"LTC Bodoni 175", var(--font-serif)', fontStyle: 'italic', fontWeight: '400', wordWrap: 'break-word' }}>
                    IntoDay
                </div>

            </div>
        </div>
    );
}

export default Login;
