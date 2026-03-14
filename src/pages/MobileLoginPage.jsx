import React from 'react';
import { supabase, isSupabaseConfigured, supabaseConfigError } from '../lib/supabase';

function MobileLoginPage({ onClose, platform = 'web' }) {
    const isAndroid = platform === 'android';
    const handleGoogleLogin = async () => {
        if (!supabase) return;
        await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: window.location.origin,
            },
        });
    };

    return (
        <div style={{
            width: '100%',
            height: '100dvh',
            background: '#F9F9F9',
            display: 'flex',
            flexDirection: 'column',
            position: 'relative',
            overflow: 'hidden',
            fontFamily: isAndroid
                ? '"Segoe UI", Roboto, Helvetica, Arial, sans-serif'
                : '-apple-system, "SF Pro Display", "SF Pro Text", BlinkMacSystemFont, "Segoe UI", sans-serif',
        }}>

            {/* Top-left Logo */}
            <div style={{
                position: 'absolute',
                top: isAndroid ? 28 : 56,
                left: isAndroid ? 24 : 36,
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                zIndex: 10
            }}>
                <img
                    src="/logo.png"
                    alt="InToday logo"
                    style={{ width: 32, height: 32, objectFit: 'contain' }}
                    onError={(e) => { e.target.style.display = 'none'; }}
                />
                <span style={{
                    fontSize: 22,
                    fontWeight: '500',
                    color: '#1A1A1A',
                    letterSpacing: '-0.4px',
                }}>IntoDay</span>
            </div>

            {/* Vertically Centered Content Group */}
            <div style={{
                position: 'absolute',
                top: '48%', // Slightly adjusted for better centering
                left: isAndroid ? 24 : 40,
                right: isAndroid ? 24 : 40,
                transform: 'translateY(-50%)',
                display: 'flex',
                flexDirection: 'column',
                gap: 16,
            }}>
                {/* Center Logo/Icon */}
                <div style={{
                    width: 100,
                    height: 100,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'flex-start',
                }}>
                    <img
                        src="/logo.png"
                        alt="InToday icon"
                        style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'contain',
                        }}
                    />
                </div>

                {/* Main text block */}
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                    {/* Bold heading */}
                    <div style={{
                        fontSize: 42,
                        fontWeight: '500',
                        color: '#1A1A1A',
                        lineHeight: 1.1,
                        letterSpacing: '-1.5px',
                        marginBottom: 2,
                    }}>
                        Organize<br />your day
                    </div>

                    {/* Lighter subtitle with dash */}
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 14,
                        marginTop: -4,
                    }}>
                        <div style={{
                            width: 48,
                            height: 2,
                            background: '#B8B8B8',
                            borderRadius: 2,
                            flexShrink: 0,
                        }} />
                        <span style={{
                            fontSize: 42,
                            fontWeight: '400',
                            color: '#B8B8B8',
                            letterSpacing: '-1px',
                        }}>with ease</span>
                    </div>
                </div>
            </div>

            {/* Bottom Google Sign-in Button */}
            <div style={{
                position: 'absolute',
                bottom: isAndroid ? 24 : 40,
                left: isAndroid ? 24 : 32,
                right: isAndroid ? 24 : 32,
                display: 'flex',
                justifyContent: 'center',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 12,
            }}>
                {!isSupabaseConfigured && (
                    <div style={{
                        width: '100%',
                        maxWidth: 320,
                        padding: '12px 14px',
                        borderRadius: 16,
                        background: '#FFF1F1',
                        color: '#A12626',
                        fontSize: 13,
                        lineHeight: 1.4,
                        boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
                    }}>
                        {supabaseConfigError}
                    </div>
                )}
                <button
                    onClick={handleGoogleLogin}
                    disabled={!isSupabaseConfigured}
                    style={{
                        width: '100%',
                        maxWidth: 320,
                        height: 54,
                        background: isSupabaseConfigured ? 'white' : '#F2F2F2',
                        borderRadius: 19,
                        border: 'none',
                        cursor: isSupabaseConfigured ? 'pointer' : 'not-allowed',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 10,
                        boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
                        transition: 'transform 0.12s ease, box-shadow 0.12s ease',
                        opacity: isSupabaseConfigured ? 1 : 0.7,
                    }}
                    onMouseDown={e => { if (isSupabaseConfigured) e.currentTarget.style.transform = 'scale(0.97)' }}
                    onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
                >
                    <svg width="20" height="20" viewBox="0 0 48 48">
                        <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                        <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                        <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                        <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
                    </svg>
                    <span style={{
                        fontSize: 16,
                        fontWeight: '500',
                        color: '#1A1A1A',
                        letterSpacing: '-0.2px',
                    }}>Continue with Google</span>
                </button>
            </div>
        </div>
    );
}

export default MobileLoginPage;
