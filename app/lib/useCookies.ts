'use client';

import { useState, useEffect } from 'react';

export function useCookies() {
  const [cookies, setCookies] = useState<Record<string, string>>({});

  useEffect(() => {
    // Parse cookies from document.cookie
    const parseCookies = () => {
      const cookieObj: Record<string, string> = {};
      const allCookies = document.cookie.split(';');
      
      for (let cookie of allCookies) {
        const [name, value] = cookie.trim().split('=');
        if (name && value) {
          cookieObj[name] = decodeURIComponent(value);
        }
      }
      
      setCookies(cookieObj);
    };

    parseCookies();
  }, []);

  // Function to get a cookie value
  const getCookie = (name: string): string | undefined => {
    return cookies[name];
  };

  // Function to set a cookie
  const setCookie = (name: string, value: string, options: any = {}) => {
    const defaultOptions = {
      path: '/',
      maxAge: 60 * 60 * 24 * 30, // 30 days
      secure: window.location.protocol === 'https:',
    };
    
    const cookieOptions = { ...defaultOptions, ...options };
    let cookieString = `${name}=${encodeURIComponent(value)}`;
    
    if (cookieOptions.path) {
      cookieString += `;path=${cookieOptions.path}`;
    }
    
    if (cookieOptions.maxAge) {
      cookieString += `;max-age=${cookieOptions.maxAge}`;
    }
    
    if (cookieOptions.secure) {
      cookieString += ';secure';
    }
    
    if (cookieOptions.httpOnly) {
      cookieString += ';httpOnly';
    }
    
    document.cookie = cookieString;
    
    // Update the state
    setCookies(prev => ({ ...prev, [name]: value }));
  };

  // Function to delete a cookie
  const deleteCookie = (name: string) => {
    document.cookie = `${name}=;path=/;expires=Thu, 01 Jan 1970 00:00:01 GMT`;
    
    // Update the state
    setCookies(prev => {
      const newCookies = { ...prev };
      delete newCookies[name];
      return newCookies;
    });
  };

  return { cookies, getCookie, setCookie, deleteCookie };
} 