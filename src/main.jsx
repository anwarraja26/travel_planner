import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { createBrowserRouter , RouterProvider} from 'react-router-dom'
import CreateTrip from './create-trip/index.jsx'
import Header from './components/custom/Header.jsx'
import {Toaster} from 'react-hot-toast'
import { GoogleOAuthProvider } from '@react-oauth/google';
import Viewtrip from './view-trip/[tripId]/index.jsx'

const router=createBrowserRouter([
  {
    path:'/',
    element:<App />
  },
  {
    path:'/create-trip',
    element:<CreateTrip />
  },
  {
    path:'/view-trip/:tripId',
    element:<Viewtrip />
  }
])
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID}>
      <Header />
      <Toaster />
      <RouterProvider router={router} />
    </GoogleOAuthProvider>;
  </StrictMode>,
)

// import { StrictMode } from 'react';
// import { createRoot } from 'react-dom/client';
// import './index.css';
// import { createBrowserRouter, RouterProvider } from 'react-router-dom';
// import App from './App.jsx';
// import CreateTrip from './create-trip/index.jsx';
// import Header from './components/custom/Header.jsx';
// import { Toaster } from 'react-hot-toast';
// import { GoogleOAuthProvider } from '@react-oauth/google';

// const router = createBrowserRouter([
//   { path: '/', element: <App /> },
//   { path: '/create-trip', element: <CreateTrip /> }
// ]);

// createRoot(document.getElementById('root')).render(
//   <StrictMode>
//     <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID}>
//       <Header />
//       <Toaster />
//       <RouterProvider router={router} />
//     </GoogleOAuthProvider>
//   </StrictMode>
// );