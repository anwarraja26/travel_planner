// src/components/Header.jsx
import React from 'react';
import { useGoogleLogin } from '@react-oauth/google';
import axios from 'axios';
import toast from 'react-hot-toast';
import logo from '../../assets/logo.svg'; // Adjust the path to your logo


function Header() {
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
        toast.success("Signed in successfully!");
        window.location.reload(); // optional, if you want the UI to refresh after login

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

  return (
    <header className="flex justify-between items-center px-4 py-3 shadow-md">
      <img src={logo} alt="Logo" className="h-10" />
      <button
        onClick={login}
        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded transition"
      >
        Sign In
      </button>
    </header>
  );
}

export default Header;
