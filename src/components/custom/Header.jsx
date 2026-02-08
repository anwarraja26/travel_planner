// src/components/Header.jsx
import React, { useState, useEffect } from 'react';
import { useGoogleLogin } from '@react-oauth/google';
import axios from 'axios';
import toast from 'react-hot-toast';
import logo from '../../assets/logo.svg'; // Adjust the path to your logo


function Header() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (userData) {
      setUser(JSON.parse(userData));
    }
  }, []);

  const login = useGoogleLogin({
    onSuccess: async (codeResponse) => {
      try {
        const res = await axios.get(`https://www.googleapis.com/oauth2/v1/userinfo?access_token=${codeResponse?.access_token}`, {
          headers: {
            Authorization: `Bearer ${codeResponse?.access_token}`,
            Accept: 'application/json',
          },
        });

        const userData = res.data;
        localStorage.setItem('user', JSON.stringify(userData));
        setUser(userData);
        toast.success("Signed in successfully!");

      } catch (error) {
        console.error("Profile Fetch Error", error);
        toast.error("Failed to fetch user profile");
      }
    },
    onError: (error) => {
      console.error("Login Error", error);
      toast.error("Failed to sign in with Google");
    }
  });

  const handleLogout = () => {
    localStorage.removeItem('user');
    setUser(null);
    toast.success("Logged out successfully!");
  };

  return (
    <header className="flex justify-between items-center px-4 py-3 shadow-md">
      <img src={logo} alt="Logo" className="h-10" />
      
      {user ? (
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white font-semibold">
                {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
              </div>
            {/* {user.picture ? (
              <img 
                src={user.picture} 
                alt={user.name} 
                className="w-8 h-8 rounded-full"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white font-semibold">
                {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
              </div>
            )} */}
            <span className="text-sm font-medium text-gray-700">
              {user.name}
            </span>
          </div>
          <button
            onClick={handleLogout}
            className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-sm transition"
          >
            Logout
          </button>
        </div>
      ) : (
        <button
          onClick={login}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded transition"
        >
          Sign In
        </button>
      )}
    </header>
  );
}

export default Header;
